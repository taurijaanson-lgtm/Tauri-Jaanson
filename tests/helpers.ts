import type { Bar, Series } from '../src/types.js';

export interface SeriesOptions {
  symbol?: string;
  /** Intraday range as a fraction of the close. */
  rangePct?: number;
  volume?: number;
  /** Overrides the volume of the final bar. */
  lastVolume?: number;
  /** Overrides the open of the final bar, for gap tests. */
  lastOpen?: number;
}

/** Turns a close path into bars, with everything else derived predictably. */
export function buildSeries(closes: number[], options: SeriesOptions = {}): Series {
  const { symbol = 'TEST', rangePct = 0.01, volume = 1_000_000 } = options;
  const start = new Date(Date.UTC(2023, 0, 2));
  const bars: Bar[] = closes.map((close, i) => {
    const prev = i > 0 ? (closes[i - 1] as number) : close;
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const open = prev;
    return {
      date: date.toISOString().slice(0, 10),
      open,
      high: Math.max(open, close) * (1 + rangePct / 2),
      low: Math.min(open, close) * (1 - rangePct / 2),
      close,
      volume,
    };
  });

  const latest = bars[bars.length - 1];
  if (latest) {
    if (options.lastVolume !== undefined) latest.volume = options.lastVolume;
    if (options.lastOpen !== undefined) {
      latest.open = options.lastOpen;
      latest.high = Math.max(latest.high, latest.open, latest.close) * (1 + rangePct / 2);
      latest.low = Math.min(latest.low, latest.open, latest.close) * (1 - rangePct / 2);
    }
  }
  return { symbol, bars };
}

/** A deterministic wobble, so test series are not perfectly straight lines. */
export function wobble(index: number, amplitude = 1): number {
  return Math.sin(index * 1.7) * amplitude;
}

/** A flat base at `level` followed by a rally of `days` at `dailyPct` per day. */
export function baseThenRally(
  baseDays: number,
  level: number,
  days: number,
  dailyPct: number,
): number[] {
  const closes: number[] = [];
  for (let i = 0; i < baseDays; i++) closes.push(level + wobble(i, level * 0.01));
  let price = closes[closes.length - 1] ?? level;
  for (let i = 0; i < days; i++) {
    price *= 1 + dailyPct;
    closes.push(price);
  }
  return closes;
}
