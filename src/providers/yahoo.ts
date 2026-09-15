import type { Bar, Series } from '../types.js';
import type { FetchOptions, Provider } from './types.js';

const ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart';

interface ChartResponse {
  chart?: {
    error?: { code?: string; description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
}

/** Picks the shortest Yahoo range string that covers the requested bar count. */
function rangeFor(bars: number): string {
  if (bars <= 25) return '1mo';
  if (bars <= 70) return '3mo';
  if (bars <= 130) return '6mo';
  if (bars <= 260) return '1y';
  if (bars <= 520) return '2y';
  return '5y';
}

/**
 * Yahoo Finance's public chart endpoint. No API key, but it is an undocumented
 * endpoint: it rate-limits, and it can change without warning.
 */
export class YahooProvider implements Provider {
  readonly name = 'yahoo';

  constructor(private readonly timeoutMs = 15_000) {}

  async fetchSeries(symbol: string, options: FetchOptions): Promise<Series | null> {
    const url = `${ENDPOINT}/${encodeURIComponent(symbol)}?range=${rangeFor(options.bars)}&interval=1d&includePrePost=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          // The endpoint rejects requests without a browser-like user agent.
          'user-agent': 'Mozilla/5.0 (compatible; trade-scanner/0.1)',
          accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Yahoo returned HTTP ${response.status} for ${symbol}`);
      }
      const payload = (await response.json()) as ChartResponse;
      const error = payload.chart?.error;
      if (error) {
        throw new Error(`Yahoo error for ${symbol}: ${error.description ?? error.code ?? 'unknown'}`);
      }
      const result = payload.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      const timestamps = result?.timestamp;
      if (!result || !quote || !timestamps) return null;

      const bars: Bar[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        const volume = quote.volume?.[i];
        // Yahoo pads holidays and halted sessions with nulls; skip those bars
        // rather than interpolating prices that never traded.
        if (
          open == null ||
          high == null ||
          low == null ||
          close == null ||
          !Number.isFinite(close)
        ) {
          continue;
        }
        bars.push({
          date: new Date((timestamps[i] as number) * 1000).toISOString().slice(0, 10),
          open,
          high,
          low,
          close,
          volume: volume ?? 0,
        });
      }
      if (bars.length === 0) return null;
      return { symbol, bars: bars.slice(-options.bars) };
    } finally {
      clearTimeout(timer);
    }
  }
}
