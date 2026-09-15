import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Series } from '../types.js';

/**
 * A plain on-disk cache of fetched series. Daily bars only change once a
 * session, so re-running a scan should not re-hit the network.
 */
export class SeriesCache {
  constructor(
    private readonly dir: string,
    private readonly ttlMs: number,
  ) {}

  private pathFor(provider: string, symbol: string, bars: number): string {
    const safe = symbol.replace(/[^A-Za-z0-9._-]/g, '_');
    return join(this.dir, provider, `${safe}.${bars}.json`);
  }

  async read(provider: string, symbol: string, bars: number): Promise<Series | null> {
    try {
      const raw = await readFile(this.pathFor(provider, symbol, bars), 'utf8');
      const entry = JSON.parse(raw) as { cachedAt: number; series: Series };
      if (Date.now() - entry.cachedAt > this.ttlMs) return null;
      return entry.series;
    } catch {
      return null;
    }
  }

  async write(provider: string, symbol: string, bars: number, series: Series): Promise<void> {
    const path = this.pathFor(provider, symbol, bars);
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify({ cachedAt: Date.now(), series }), 'utf8');
    } catch {
      // A cache that cannot be written is not a reason to fail the scan.
    }
  }
}
