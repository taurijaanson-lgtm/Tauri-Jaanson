import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scan } from '../src/scanner.js';
import { SeriesCache } from '../src/providers/cache.js';
import type { FetchOptions, Provider } from '../src/providers/types.js';
import { breakout, unusualVolume } from '../src/strategies/index.js';
import type { Hit, Series, Snapshot, Strategy } from '../src/types.js';
import { buildSeries, wobble } from './helpers.js';

const base = Array.from({ length: 120 }, (_, i) => 100 + wobble(i, 2));

/** A provider backed by a fixed map, with hooks for the failure paths. */
class FakeProvider implements Provider {
  readonly name = 'fake';
  calls: string[] = [];

  constructor(private readonly data: Record<string, Series | null | 'throw'>) {}

  async fetchSeries(symbol: string, _options: FetchOptions): Promise<Series | null> {
    this.calls.push(symbol);
    const entry = this.data[symbol];
    if (entry === 'throw') throw new Error(`boom for ${symbol}`);
    return entry ?? null;
  }
}

/** A strategy that always matches, with a score taken from the symbol. */
function alwaysHit(scoreBySymbol: Record<string, number>): Strategy {
  return {
    name: 'always',
    description: 'test strategy',
    direction: 'long',
    minBars: 1,
    evaluate(snapshot: Snapshot): Hit | null {
      return {
        symbol: snapshot.symbol,
        strategy: 'always',
        score: scoreBySymbol[snapshot.symbol] ?? 0,
        direction: 'long',
        date: snapshot.date,
        close: snapshot.close,
        reasons: [],
        rules: [],
        snapshot,
      };
    },
  };
}

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('scan', () => {
  it('ranks hits by score and reports what it covered', async () => {
    const provider = new FakeProvider({
      AAA: buildSeries(base, { symbol: 'AAA' }),
      BBB: buildSeries(base, { symbol: 'BBB' }),
      CCC: buildSeries(base, { symbol: 'CCC' }),
    });
    const result = await scan({
      symbols: ['AAA', 'BBB', 'CCC'],
      strategies: [alwaysHit({ AAA: 10, BBB: 90, CCC: 50 })],
      provider,
    });
    expect(result.hits.map((hit) => hit.symbol)).toEqual(['BBB', 'CCC', 'AAA']);
    expect(result.scanned).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('records a failing symbol and keeps scanning the rest', async () => {
    const provider = new FakeProvider({
      AAA: buildSeries(base, { symbol: 'AAA' }),
      BAD: 'throw',
      EMPTY: null,
      CCC: buildSeries(base, { symbol: 'CCC' }),
    });
    const result = await scan({
      symbols: ['AAA', 'BAD', 'EMPTY', 'CCC'],
      strategies: [alwaysHit({ AAA: 10, CCC: 20 })],
      provider,
    });
    expect(result.hits.map((hit) => hit.symbol)).toEqual(['CCC', 'AAA']);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([{ symbol: 'BAD', message: 'boom for BAD' }]);
  });

  it('applies the score floor and the result limit', async () => {
    const provider = new FakeProvider({
      AAA: buildSeries(base, { symbol: 'AAA' }),
      BBB: buildSeries(base, { symbol: 'BBB' }),
      CCC: buildSeries(base, { symbol: 'CCC' }),
    });
    const strategies = [alwaysHit({ AAA: 10, BBB: 90, CCC: 50 })];
    const floored = await scan({
      symbols: ['AAA', 'BBB', 'CCC'],
      strategies,
      provider,
      filters: { minScore: 40 },
    });
    expect(floored.hits.map((hit) => hit.symbol)).toEqual(['BBB', 'CCC']);

    const limited = await scan({ symbols: ['AAA', 'BBB', 'CCC'], strategies, provider, limit: 1 });
    expect(limited.hits).toHaveLength(1);
    expect(limited.hits[0]?.symbol).toBe('BBB');
  });

  it('filters out symbols outside the price and liquidity bounds', async () => {
    const provider = new FakeProvider({
      PENNY: buildSeries(base.map((close) => close / 100), { symbol: 'PENNY' }),
      THIN: buildSeries(base, { symbol: 'THIN', volume: 1_000 }),
      GOOD: buildSeries(base, { symbol: 'GOOD', volume: 2_000_000 }),
    });
    const result = await scan({
      symbols: ['PENNY', 'THIN', 'GOOD'],
      strategies: [alwaysHit({ PENNY: 99, THIN: 99, GOOD: 50 })],
      provider,
      filters: { minPrice: 5, minAvgVolume: 100_000 },
    });
    expect(result.hits.map((hit) => hit.symbol)).toEqual(['GOOD']);
    expect(result.skipped).toBe(2);
    expect(result.scanned).toBe(1);
  });

  it('runs every selected strategy against each symbol', async () => {
    const series = buildSeries([...base, 106], {
      symbol: 'AAA',
      volume: 1_000_000,
      lastVolume: 4_000_000,
    });
    const result = await scan({
      symbols: ['AAA'],
      strategies: [breakout, unusualVolume],
      provider: new FakeProvider({ AAA: series }),
    });
    expect(result.hits.map((hit) => hit.strategy).sort()).toEqual(['breakout', 'unusual-volume']);
  });

  it('reports progress once per symbol', async () => {
    const provider = new FakeProvider({
      AAA: buildSeries(base, { symbol: 'AAA' }),
      BBB: buildSeries(base, { symbol: 'BBB' }),
    });
    const seen: number[] = [];
    await scan({
      symbols: ['AAA', 'BBB'],
      strategies: [alwaysHit({})],
      provider,
      concurrency: 1,
      onProgress: (done, total) => {
        expect(total).toBe(2);
        seen.push(done);
      },
    });
    expect(seen).toEqual([1, 2]);
  });

  it('serves a second scan from the cache instead of refetching', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scanner-cache-'));
    tempDirs.push(dir);
    const cache = new SeriesCache(dir, 60_000);
    const provider = new FakeProvider({ AAA: buildSeries(base, { symbol: 'AAA' }) });
    const options = {
      symbols: ['AAA'],
      strategies: [alwaysHit({ AAA: 10 })],
      provider,
      cache,
      bars: 400,
    };
    await scan(options);
    await scan(options);
    expect(provider.calls).toEqual(['AAA']);
  });

  it('treats an expired cache entry as a miss', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scanner-cache-'));
    tempDirs.push(dir);
    const cache = new SeriesCache(dir, -1);
    const provider = new FakeProvider({ AAA: buildSeries(base, { symbol: 'AAA' }) });
    const options = { symbols: ['AAA'], strategies: [alwaysHit({ AAA: 10 })], provider, cache };
    await scan(options);
    await scan(options);
    expect(provider.calls).toEqual(['AAA', 'AAA']);
  });
});
