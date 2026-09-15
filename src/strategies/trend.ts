import { smaSeries } from '../indicators.js';
import type { Strategy } from '../types.js';
import { fmt, makeStrategy, ramp, type Check } from './shared.js';

/** Price above a correctly stacked set of moving averages, with ADX confirming. */
export const trendStack: Strategy = makeStrategy({
  name: 'trend-stack',
  description: 'Price above 20 > 50 > 200-day averages with ADX above 20.',
  direction: 'long',
  minBars: 210,
  checks(snap): Check[] | null {
    const { sma20, sma50, sma200, adx14, close } = snap;
    if (sma20 === null || sma50 === null || sma200 === null || adx14 === null) return null;
    const spread = ((sma50 - sma200) / sma200) * 100;
    return [
      {
        name: 'averages stacked',
        passed: close > sma20 && sma20 > sma50 && sma50 > sma200,
        detail: `Close ${fmt(close)} > SMA20 ${fmt(sma20)} > SMA50 ${fmt(sma50)} > SMA200 ${fmt(sma200)}`,
        weight: 3,
        quality: ramp(spread, 0, 20),
      },
      {
        name: 'trend has strength',
        passed: adx14 >= 20,
        detail: `ADX(14) is ${fmt(adx14)}`,
        weight: 2,
        quality: ramp(adx14, 20, 45),
      },
      {
        name: 'not overextended',
        passed: ((close - sma20) / sma20) * 100 <= 15,
        detail: `Close is ${fmt(((close - sma20) / sma20) * 100)}% above the 20-day average`,
        weight: 1,
        quality: ramp(((close - sma20) / sma20) * 100, 15, 0),
      },
    ];
  },
});

/**
 * A 50/200-day crossover that happened inside the last 15 sessions — old
 * crossovers are trend context, not a fresh signal.
 */
export const goldenCross: Strategy = makeStrategy({
  name: 'golden-cross',
  description: 'The 50-day average crossed above the 200-day within the last 15 sessions.',
  direction: 'long',
  minBars: 215,
  checks(snap, series): Check[] | null {
    const closes = series.bars.map((bar) => bar.close);
    const fast = smaSeries(closes, 50);
    const slow = smaSeries(closes, 200);
    const lookback = 15;

    let crossedAt: number | null = null;
    for (let i = fast.length - 1; i >= Math.max(1, fast.length - lookback); i--) {
      const fastNow = fast[i];
      const slowNow = slow[i];
      const fastPrev = fast[i - 1];
      const slowPrev = slow[i - 1];
      if (fastNow == null || slowNow == null || fastPrev == null || slowPrev == null) continue;
      if (fastPrev <= slowPrev && fastNow > slowNow) {
        crossedAt = fast.length - 1 - i;
        break;
      }
    }
    if (crossedAt === null) return null;

    const { close, sma50, sma200, relativeVolume } = snap;
    if (sma50 === null || sma200 === null) return null;
    return [
      {
        name: 'recent golden cross',
        passed: true,
        detail:
          crossedAt === 0
            ? 'The 50-day crossed above the 200-day today'
            : `The 50-day crossed above the 200-day ${crossedAt} session(s) ago`,
        weight: 3,
        quality: ramp(crossedAt, lookback, 0),
      },
      {
        name: 'cross still holding',
        passed: sma50 > sma200 && close > sma200,
        detail: `SMA50 ${fmt(sma50)} is above SMA200 ${fmt(sma200)} and price is above both`,
        weight: 2,
        quality: ramp(((sma50 - sma200) / sma200) * 100, 0, 8),
      },
      {
        name: 'participation',
        passed: true,
        gate: false,
        detail:
          relativeVolume === null
            ? 'No volume average available'
            : `Volume is ${fmt(relativeVolume)}x its 20-day average`,
        weight: 1,
        quality: relativeVolume === null ? 0.5 : ramp(relativeVolume, 0.8, 2),
      },
    ];
  },
});
