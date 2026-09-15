import { describe, expect, it } from 'vitest';
import { snapshot } from '../src/indicators.js';
import {
  breakout,
  gapUp,
  goldenCross,
  momentumLeader,
  overboughtFade,
  oversoldBounce,
  resolveStrategies,
  squeeze,
  strategies,
  trendStack,
  unusualVolume,
} from '../src/strategies/index.js';
import type { Hit, Series, Strategy } from '../src/types.js';
import { baseThenRally, buildSeries, wobble } from './helpers.js';

function run(strategy: Strategy, series: Series): Hit | null {
  const snap = snapshot(series);
  expect(snap).not.toBeNull();
  return strategy.evaluate(snap!, series);
}

describe('breakout', () => {
  const base = Array.from({ length: 120 }, (_, i) => 100 + wobble(i, 2));

  it('fires when price clears the 20-day high on heavy volume', () => {
    const series = buildSeries([...base, 106], { volume: 1_000_000, lastVolume: 2_500_000 });
    const hit = run(breakout, series);
    expect(hit).not.toBeNull();
    expect(hit?.strategy).toBe('breakout');
    expect(hit?.direction).toBe('long');
    expect(hit?.score).toBeGreaterThan(0);
    expect(hit?.reasons.join(' ')).toContain('20-day high');
  });

  it('stays quiet without volume confirmation', () => {
    const series = buildSeries([...base, 106], { volume: 1_000_000, lastVolume: 900_000 });
    expect(run(breakout, series)).toBeNull();
  });

  it('stays quiet when price is still inside the range', () => {
    const series = buildSeries([...base, 100.5], { volume: 1_000_000, lastVolume: 3_000_000 });
    expect(run(breakout, series)).toBeNull();
  });

  it('scores a decisive break above a marginal one', () => {
    // The prior 20-day high sits just under 102.5.
    const marginal = run(breakout, buildSeries([...base, 102.8], { lastVolume: 2_500_000 }));
    const decisive = run(breakout, buildSeries([...base, 106.5], { lastVolume: 2_500_000 }));
    expect(marginal).not.toBeNull();
    expect(decisive).not.toBeNull();
    expect(marginal?.score).toBeLessThan(decisive?.score as number);
  });

  it('needs enough history to evaluate at all', () => {
    expect(run(breakout, buildSeries([100, 101, 102, 130]))).toBeNull();
  });
});

describe('momentum-leader', () => {
  it('fires for a symbol sitting near its 52-week high after a long advance', () => {
    const hit = run(momentumLeader, buildSeries(baseThenRally(40, 50, 180, 0.006)));
    expect(hit).not.toBeNull();
    expect(hit?.snapshot.pctFrom52wHigh as number).toBeLessThanOrEqual(10);
  });

  it('stays quiet for a symbol well off its highs', () => {
    const rallyThenSlide = [
      ...baseThenRally(40, 50, 120, 0.008),
      ...Array.from({ length: 60 }, (_, i) => 130 * (1 - i * 0.004)),
    ];
    expect(run(momentumLeader, buildSeries(rallyThenSlide))).toBeNull();
  });
});

describe('trend-stack', () => {
  it('fires when price leads a correctly stacked set of averages', () => {
    const hit = run(trendStack, buildSeries(baseThenRally(40, 40, 260, 0.004)));
    expect(hit).not.toBeNull();
    expect(hit?.reasons.join(' ')).toContain('SMA200');
  });

  it('stays quiet in a downtrend', () => {
    const declining = Array.from({ length: 300 }, (_, i) => 200 * (1 - i * 0.002) + wobble(i));
    expect(run(trendStack, buildSeries(declining))).toBeNull();
  });
});

describe('golden-cross', () => {
  // A long decline followed by a strong advance puts the 50/200 crossover
  // inside the lookback window.
  const closes = [
    ...Array.from({ length: 190 }, (_, i) => 200 * (1 - i * 0.003) + wobble(i)),
    ...Array.from({ length: 50 }, (_, i) => 113 * (1 + i * 0.012)),
  ];

  it('fires on a recent crossover', () => {
    const hit = run(goldenCross, buildSeries(closes));
    expect(hit).not.toBeNull();
    expect(hit?.reasons.join(' ')).toContain('crossed above');
  });

  it('ignores a crossover that happened long ago', () => {
    const peak = closes[closes.length - 1] as number;
    const stale = [...closes, ...Array.from({ length: 60 }, (_, i) => peak + wobble(i, 3))];
    expect(run(goldenCross, buildSeries(stale))).toBeNull();
  });
});

describe('oversold-bounce', () => {
  it('fires on a sharp dip inside a longer uptrend', () => {
    const closes = [
      ...baseThenRally(30, 60, 230, 0.005),
      ...Array.from({ length: 8 }, (_, i) => 190 * (1 - (i + 1) * 0.022)),
    ];
    const hit = run(oversoldBounce, buildSeries(closes));
    expect(hit).not.toBeNull();
    expect(hit?.snapshot.rsi14 as number).toBeLessThanOrEqual(32);
  });

  it('stays quiet when the long-term trend has broken', () => {
    const closes = Array.from({ length: 280 }, (_, i) => 200 * (1 - i * 0.004) + wobble(i));
    expect(run(oversoldBounce, buildSeries(closes))).toBeNull();
  });
});

describe('overbought-fade', () => {
  it('fires on a vertical move away from the 20-day average', () => {
    const closes = [...baseThenRally(60, 100, 40, 0.001), ...Array.from({ length: 14 }, (_, i) => 104 * (1 + (i + 1) * 0.02))];
    const hit = run(overboughtFade, buildSeries(closes));
    expect(hit).not.toBeNull();
    expect(hit?.direction).toBe('short');
  });

  it('stays quiet for a quiet market', () => {
    expect(run(overboughtFade, buildSeries(Array.from({ length: 120 }, (_, i) => 100 + wobble(i))))).toBeNull();
  });
});

describe('gap-up', () => {
  const base = Array.from({ length: 60 }, (_, i) => 100 + wobble(i));

  it('fires when a gap holds into the close on heavy volume', () => {
    const prevClose = base[base.length - 1] as number;
    const series = buildSeries([...base, prevClose * 1.08], {
      lastOpen: prevClose * 1.05,
      lastVolume: 4_000_000,
    });
    const hit = run(gapUp, series);
    expect(hit).not.toBeNull();
    expect(hit?.snapshot.gapPct as number).toBeGreaterThanOrEqual(2);
  });

  it('stays quiet when the gap is filled', () => {
    const prevClose = base[base.length - 1] as number;
    const series = buildSeries([...base, prevClose * 1.01], {
      lastOpen: prevClose * 1.05,
      lastVolume: 4_000_000,
    });
    expect(run(gapUp, series)).toBeNull();
  });
});

describe('squeeze', () => {
  it('fires once volatility contracts to the low end of its range', () => {
    const noisy = Array.from({ length: 120 }, (_, i) => 100 + wobble(i, 8));
    const calm = Array.from({ length: 60 }, (_, i) => 100 + wobble(i, 0.1));
    const hit = run(squeeze, buildSeries([...noisy, ...calm]));
    expect(hit).not.toBeNull();
    expect(hit?.reasons.join(' ')).toContain('bandwidth');
  });

  it('stays quiet while volatility is still elevated', () => {
    const noisy = Array.from({ length: 180 }, (_, i) => 100 + wobble(i, 8));
    expect(run(squeeze, buildSeries(noisy))).toBeNull();
  });
});

describe('unusual-volume', () => {
  const base = Array.from({ length: 60 }, (_, i) => 100 + wobble(i, 0.5));

  it('fires on a volume spike with a price response', () => {
    const last = base[base.length - 1] as number;
    const series = buildSeries([...base, last * 1.04], { lastVolume: 5_000_000 });
    expect(run(unusualVolume, series)).not.toBeNull();
  });

  it('stays quiet when volume is spiked but price barely moves', () => {
    const last = base[base.length - 1] as number;
    const series = buildSeries([...base, last * 1.001], { lastVolume: 5_000_000 });
    expect(run(unusualVolume, series)).toBeNull();
  });
});

describe('resolveStrategies', () => {
  it('expands groups and de-duplicates overlapping selectors', () => {
    const resolved = resolveStrategies(['momentum', 'breakout']);
    expect(resolved.map((strategy) => strategy.name)).toEqual(['breakout', 'momentum-leader']);
  });

  it('resolves "all" to every registered strategy', () => {
    expect(resolveStrategies(['all'])).toHaveLength(strategies.length);
  });

  it('throws on an unknown name', () => {
    expect(() => resolveStrategies(['nope'])).toThrow(/Unknown strategy/);
  });
});
