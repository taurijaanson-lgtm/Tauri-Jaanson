import { describe, expect, it } from 'vitest';
import {
  adx,
  atr,
  bandwidthSeries,
  bollinger,
  ema,
  highestHigh,
  lowestLow,
  returnPct,
  rsi,
  sma,
  smaSeries,
  snapshot,
  trueRange,
} from '../src/indicators.js';
import type { Bar } from '../src/types.js';

/** Builds bars from a close path, with a fixed intraday range. */
function bars(closes: number[], options: { range?: number; volume?: number } = {}): Bar[] {
  const range = options.range ?? 1;
  return closes.map((close, i) => ({
    date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
    open: close,
    high: close + range / 2,
    low: close - range / 2,
    close,
    volume: options.volume ?? 1_000_000,
  }));
}

describe('sma', () => {
  it('averages the last `period` values', () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([10, 10, 10, 1, 2, 3], 3)).toBe(2);
  });

  it('returns null before it is warmed up', () => {
    expect(sma([1, 2], 5)).toBeNull();
    expect(sma([], 1)).toBeNull();
  });
});

describe('smaSeries', () => {
  it('matches sma at every warmed-up index', () => {
    const values = [5, 3, 8, 1, 9, 4, 7];
    const series = smaSeries(values, 3);
    expect(series.slice(0, 2)).toEqual([null, null]);
    for (let i = 2; i < values.length; i++) {
      expect(series[i]).toBeCloseTo(sma(values.slice(0, i + 1), 3) as number, 10);
    }
  });
});

describe('ema', () => {
  it('equals the value itself for a constant series', () => {
    expect(ema(new Array(50).fill(42), 21)).toBeCloseTo(42, 10);
  });

  it('does not depend on extra leading history', () => {
    const rising = Array.from({ length: 200 }, (_, i) => 100 + i);
    const short = ema(rising.slice(-80), 21) as number;
    const long = ema(rising, 21) as number;
    // The seed washes out, so the two agree to within a cent.
    expect(Math.abs(short - long)).toBeLessThan(0.01);
  });

  it('tracks closer to recent prices than the sma does', () => {
    const values = [...new Array(30).fill(100), ...new Array(5).fill(120)];
    expect(ema(values, 10) as number).toBeGreaterThan(sma(values, 10) as number);
  });
});

describe('rsi', () => {
  it('is 100 when every bar gains', () => {
    expect(rsi(Array.from({ length: 30 }, (_, i) => 100 + i), 14)).toBe(100);
  });

  it('sits near 50 when gains and losses are equal, leaning to the last bar', () => {
    // Wilder smoothing gives the most recent bar extra weight, so an
    // alternating series lands just off 50 on the side of its final move.
    const upLast = Array.from({ length: 60 }, (_, i) => 100 + (i % 2));
    const downLast = Array.from({ length: 61 }, (_, i) => 100 + (i % 2));
    expect(rsi(upLast, 14) as number).toBeGreaterThan(50);
    expect(rsi(downLast, 14) as number).toBeLessThan(50);
    expect(Math.abs((rsi(upLast, 14) as number) - 50)).toBeLessThan(3);
    expect(Math.abs((rsi(downLast, 14) as number) - 50)).toBeLessThan(3);
  });

  it('is 50 for a flat series and null before warm-up', () => {
    expect(rsi(new Array(30).fill(50), 14)).toBe(50);
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });

  it('falls below 30 after a sustained decline', () => {
    const values = [...new Array(20).fill(100), ...Array.from({ length: 12 }, (_, i) => 100 - i * 2)];
    expect(rsi(values, 14) as number).toBeLessThan(30);
  });
});

describe('atr', () => {
  it('equals the constant true range of a flat-range series', () => {
    // Closes are unchanged, so true range is exactly the high-low span.
    expect(atr(bars(new Array(40).fill(100), { range: 2 }), 14)).toBeCloseTo(2, 10);
  });

  it('returns null before warm-up', () => {
    expect(atr(bars([1, 2, 3]), 14)).toBeNull();
  });

  it('counts a gap through the prior close', () => {
    const bar = { date: '2024-01-02', open: 110, high: 112, low: 109, close: 111, volume: 1 };
    expect(trueRange(bar, 100)).toBe(12);
  });
});

describe('bollinger', () => {
  it('collapses to zero width on a constant series', () => {
    const band = bollinger(new Array(30).fill(100), 20, 2);
    expect(band?.upper).toBeCloseTo(100, 10);
    expect(band?.lower).toBeCloseTo(100, 10);
    expect(band?.bandwidth).toBeCloseTo(0, 10);
  });

  it('widens as dispersion grows', () => {
    const calm = bollinger([...new Array(20).fill(100)], 20, 2) as { bandwidth: number };
    const wild = bollinger(
      Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 90 : 110)),
      20,
      2,
    ) as { bandwidth: number };
    expect(wild.bandwidth).toBeGreaterThan(calm.bandwidth);
  });

  it('reports narrowing bandwidth as volatility contracts', () => {
    const closes = [
      ...Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 90 : 110)),
      ...new Array(60).fill(100),
    ];
    const widths = bandwidthSeries(closes, 20, 2);
    expect(widths[59] as number).toBeGreaterThan(widths[widths.length - 1] as number);
  });
});

describe('adx', () => {
  it('reads high in a clean trend and low in a flat market', () => {
    const trending = adx(bars(Array.from({ length: 80 }, (_, i) => 100 + i * 2)), 14) as number;
    const flat = adx(bars(new Array(80).fill(100)), 14) as number;
    expect(trending).toBeGreaterThan(40);
    expect(flat).toBeLessThan(20);
  });

  it('returns null without roughly two periods of history', () => {
    expect(adx(bars(new Array(20).fill(100)), 14)).toBeNull();
  });
});

describe('highestHigh / lowestLow', () => {
  const sample = bars([10, 12, 15, 11, 20], { range: 0 });

  it('reads the extremes of the window', () => {
    expect(highestHigh(sample, 5)).toBe(20);
    expect(lowestLow(sample, 5)).toBe(10);
  });

  it('can exclude the most recent bar', () => {
    expect(highestHigh(sample, 4, true)).toBe(15);
    expect(lowestLow(sample, 4, true)).toBe(10);
  });

  it('returns null when the window is longer than the history', () => {
    expect(highestHigh(sample, 10)).toBeNull();
  });
});

describe('returnPct', () => {
  it('measures the trailing percent change', () => {
    expect(returnPct([100, 105, 110], 2)).toBeCloseTo(10, 10);
    expect(returnPct([100, 50], 1)).toBeCloseTo(-50, 10);
  });

  it('returns null without enough history', () => {
    expect(returnPct([100], 5)).toBeNull();
  });
});

describe('snapshot', () => {
  it('fills what it can and leaves the rest null on short history', () => {
    const snap = snapshot({ symbol: 'TEST', bars: bars([100, 101, 102]) });
    expect(snap?.symbol).toBe('TEST');
    expect(snap?.close).toBe(102);
    expect(snap?.changePct).toBeCloseTo(0.990099, 4);
    expect(snap?.sma20).toBeNull();
    expect(snap?.rsi14).toBeNull();
    expect(snap?.adx14).toBeNull();
  });

  it('computes relative volume against the 20-day average', () => {
    const history = bars(new Array(24).fill(100), { volume: 1_000_000 });
    const latest = history[history.length - 1] as Bar;
    latest.volume = 3_000_000;
    const snap = snapshot({ symbol: 'TEST', bars: history });
    // The spiked bar is inside its own average, so the ratio is below 3x.
    expect(snap?.relativeVolume as number).toBeGreaterThan(2.5);
    expect(snap?.avgVolume20 as number).toBeGreaterThan(1_000_000);
  });

  it('returns null for an empty series', () => {
    expect(snapshot({ symbol: 'TEST', bars: [] })).toBeNull();
  });
});
