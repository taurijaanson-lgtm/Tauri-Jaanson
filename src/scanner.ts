import { snapshot } from './indicators.js';
import type { Provider } from './providers/types.js';
import type { SeriesCache } from './providers/cache.js';
import type { Hit, Series, Strategy } from './types.js';

export interface Filters {
  /** Skip symbols trading below this price. */
  minPrice?: number;
  maxPrice?: number;
  /** Skip symbols whose 20-day average volume is below this. */
  minAvgVolume?: number;
  /** Drop hits scoring below this, after strategies have run. */
  minScore?: number;
}

export interface ScanOptions {
  symbols: string[];
  strategies: Strategy[];
  provider: Provider;
  cache?: SeriesCache | null;
  filters?: Filters;
  /** Bars of history to request per symbol. */
  bars?: number;
  /** Symbols fetched in parallel. Keep this modest: data sources rate-limit. */
  concurrency?: number;
  /** Cap on returned hits, applied after ranking. */
  limit?: number;
  onProgress?: (done: number, total: number, symbol: string) => void;
}

export interface ScanError {
  symbol: string;
  message: string;
}

export interface ScanResult {
  hits: Hit[];
  /** Symbols that fetched cleanly but matched nothing. */
  scanned: number;
  skipped: number;
  errors: ScanError[];
  startedAt: string;
  finishedAt: string;
}

/** Runs `worker` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** True when the symbol is liquid and priced inside the requested range. */
function passesFilters(series: Series, filters: Filters): boolean {
  const snap = snapshot(series);
  if (!snap) return false;
  if (filters.minPrice !== undefined && snap.close < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && snap.close > filters.maxPrice) return false;
  if (filters.minAvgVolume !== undefined) {
    const avg = snap.avgVolume20 ?? snap.volume;
    if (avg < filters.minAvgVolume) return false;
  }
  return true;
}

/**
 * Fetches each symbol, computes indicators once, and runs every selected
 * strategy against it. A symbol that fails to fetch is recorded and skipped —
 * one bad symbol never aborts the scan.
 */
export async function scan(options: ScanOptions): Promise<ScanResult> {
  const {
    symbols,
    strategies,
    provider,
    cache = null,
    filters = {},
    bars = 400,
    concurrency = 6,
    limit,
    onProgress,
  } = options;

  const startedAt = new Date().toISOString();
  const errors: ScanError[] = [];
  const hits: Hit[] = [];
  let scanned = 0;
  let skipped = 0;
  let done = 0;

  await mapWithConcurrency(symbols, concurrency, async (symbol) => {
    try {
      let series = cache ? await cache.read(provider.name, symbol, bars) : null;
      if (!series) {
        series = await provider.fetchSeries(symbol, { bars });
        if (series && cache) await cache.write(provider.name, symbol, bars, series);
      }
      if (!series || series.bars.length === 0) {
        skipped++;
        return;
      }
      if (!passesFilters(series, filters)) {
        skipped++;
        return;
      }
      const snap = snapshot(series);
      if (!snap) {
        skipped++;
        return;
      }
      scanned++;
      for (const strategy of strategies) {
        const hit = strategy.evaluate(snap, series);
        if (hit && (filters.minScore === undefined || hit.score >= filters.minScore)) {
          hits.push(hit);
        }
      }
    } catch (error) {
      errors.push({ symbol, message: error instanceof Error ? error.message : String(error) });
    } finally {
      done++;
      onProgress?.(done, symbols.length, symbol);
    }
  });

  hits.sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));

  return {
    hits: limit !== undefined ? hits.slice(0, limit) : hits,
    scanned,
    skipped,
    errors,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
