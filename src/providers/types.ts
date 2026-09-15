import type { Series } from '../types.js';

export interface FetchOptions {
  /** Approximate number of daily bars wanted, counting back from the latest. */
  bars: number;
}

export interface Provider {
  name: string;
  /** Resolves to null when the symbol has no usable history. */
  fetchSeries(symbol: string, options: FetchOptions): Promise<Series | null>;
}
