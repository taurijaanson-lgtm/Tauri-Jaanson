import { bandwidthSeries } from '../indicators.js';
import type { Strategy } from '../types.js';
import { fmt, makeStrategy, ramp, type Check } from './shared.js';

/** An overnight gap that held into the close, on real volume. */
export const gapUp: Strategy = makeStrategy({
  name: 'gap-up',
  description: 'Opens at least 2% above the prior close, holds the gap, on heavy volume.',
  direction: 'long',
  minBars: 30,
  checks(snap): Check[] | null {
    const { gapPct, relativeVolume, prevClose, open, close, atrPct } = snap;
    if (gapPct === null || relativeVolume === null || prevClose === null) return null;
    return [
      {
        name: 'gapped up',
        passed: gapPct >= 2,
        detail: `Opened ${fmt(gapPct)}% above the prior close of ${fmt(prevClose)}`,
        weight: 3,
        quality: ramp(gapPct, 2, 12),
      },
      {
        name: 'gap held',
        passed: close >= open,
        detail: `Closed ${fmt(((close - open) / open) * 100)}% versus the open — the gap was not filled`,
        weight: 2,
        quality: ramp(((close - open) / open) * 100, 0, 5),
      },
      {
        name: 'volume confirms',
        passed: relativeVolume >= 1.5,
        detail: `Volume is ${fmt(relativeVolume)}x its 20-day average`,
        weight: 2,
        quality: ramp(relativeVolume, 1.5, 5),
      },
      {
        name: 'gap is meaningful versus normal range',
        passed: atrPct === null || gapPct >= atrPct,
        gate: false,
        detail:
          atrPct === null
            ? 'No ATR available'
            : `The gap is ${fmt(gapPct / atrPct)}x the average daily range`,
        weight: 1,
        quality: atrPct === null || atrPct === 0 ? 0.5 : ramp(gapPct / atrPct, 1, 3),
      },
    ];
  },
});

/**
 * Bollinger bandwidth near the bottom of its own 6-month range: volatility has
 * contracted, which often precedes an expansion. Direction is unknown, so this
 * flags a watchlist candidate rather than an entry.
 */
export const squeeze: Strategy = makeStrategy({
  name: 'squeeze',
  description: 'Bollinger bandwidth in the bottom 15% of its 6-month range.',
  direction: 'long',
  minBars: 150,
  checks(snap, series): Check[] | null {
    const closes = series.bars.map((bar) => bar.close);
    const widths = bandwidthSeries(closes, 20, 2)
      .slice(-126)
      .filter((width): width is number => width !== null);
    if (widths.length < 60) return null;
    const current = widths[widths.length - 1] as number;
    const sorted = [...widths].sort((a, b) => a - b);
    const rank = sorted.filter((width) => width < current).length / sorted.length;

    const { sma50, close, adx14 } = snap;
    return [
      {
        name: 'volatility compressed',
        passed: rank <= 0.15,
        detail: `Bollinger bandwidth is tighter than ${fmt((1 - rank) * 100, 0)}% of the last 6 months`,
        weight: 3,
        quality: ramp(rank, 0.15, 0),
      },
      {
        name: 'coiling, not drifting',
        passed: adx14 === null || adx14 < 25,
        detail: adx14 === null ? 'No ADX available' : `ADX(14) is ${fmt(adx14)}`,
        weight: 1,
        quality: adx14 === null ? 0.5 : ramp(adx14, 25, 10),
      },
      {
        name: 'constructive base',
        passed: sma50 === null || close >= sma50 * 0.95,
        gate: false,
        detail:
          sma50 === null
            ? 'No 50-day average available'
            : `Close is ${fmt(((close - sma50) / sma50) * 100)}% versus the 50-day average`,
        weight: 1,
        quality: sma50 === null ? 0.5 : ramp(((close - sma50) / sma50) * 100, -5, 10),
      },
    ];
  },
});

/** Volume far above normal without a large price move yet — something is stirring. */
export const unusualVolume: Strategy = makeStrategy({
  name: 'unusual-volume',
  description: 'Volume at least 2.5x its 20-day average.',
  direction: 'long',
  minBars: 30,
  checks(snap): Check[] | null {
    const { relativeVolume, changePct, avgVolume20 } = snap;
    if (relativeVolume === null || changePct === null || avgVolume20 === null) return null;
    return [
      {
        name: 'volume spike',
        passed: relativeVolume >= 2.5,
        detail: `Volume is ${fmt(relativeVolume)}x its 20-day average of ${Math.round(avgVolume20).toLocaleString('en-US')}`,
        weight: 3,
        quality: ramp(relativeVolume, 2.5, 8),
      },
      {
        name: 'price responded',
        passed: Math.abs(changePct) >= 1,
        detail: `Price moved ${fmt(changePct)}% on the day`,
        weight: 2,
        quality: ramp(Math.abs(changePct), 1, 8),
      },
    ];
  },
});
