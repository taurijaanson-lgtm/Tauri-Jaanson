import type { Strategy } from '../types.js';
import { fmt, makeStrategy, ramp, type Check } from './shared.js';

/**
 * Price pushing through the prior 20-day high on heavier-than-usual volume,
 * with the longer-term trend still pointing up.
 */
export const breakout: Strategy = makeStrategy({
  name: 'breakout',
  description: 'Closes above the prior 20-day high on above-average volume, in an uptrend.',
  direction: 'long',
  minBars: 60,
  checks(snap): Check[] | null {
    const { priorHigh20, relativeVolume, sma50, atrPct, close } = snap;
    if (priorHigh20 === null || relativeVolume === null || sma50 === null || atrPct === null) {
      return null;
    }
    const breakoutPct = ((close - priorHigh20) / priorHigh20) * 100;
    return [
      {
        name: 'breaks 20-day high',
        passed: close > priorHigh20,
        detail: `Close ${fmt(close)} is ${fmt(breakoutPct)}% above the prior 20-day high ${fmt(priorHigh20)}`,
        weight: 3,
        // A clean break scores better than a hair over the line, but a runaway
        // gap is chasing, so the quality tops out at +4%.
        quality: ramp(breakoutPct, 0, 4),
      },
      {
        name: 'volume confirms',
        passed: relativeVolume >= 1.2,
        detail: `Volume is ${fmt(relativeVolume)}x its 20-day average`,
        weight: 2,
        quality: ramp(relativeVolume, 1.2, 3),
      },
      {
        name: 'above 50-day average',
        passed: close > sma50,
        detail: `Close is ${fmt(((close - sma50) / sma50) * 100)}% above the 50-day average`,
        weight: 1,
        quality: ramp(((close - sma50) / sma50) * 100, 0, 15),
      },
      {
        name: 'tradeable volatility',
        passed: atrPct >= 1 && atrPct <= 12,
        detail: `ATR is ${fmt(atrPct)}% of price`,
        weight: 1,
        // Too quiet gives no follow-through, too wild gives no stop placement.
        quality: 1 - Math.abs(atrPct - 3.5) / 8.5,
      },
    ];
  },
});

/**
 * Relative-strength leadership: near the 52-week high with strong trailing
 * returns. This is a ranking screen rather than a timing signal.
 */
export const momentumLeader: Strategy = makeStrategy({
  name: 'momentum-leader',
  description: 'Within 10% of the 52-week high with strong 3- and 6-month returns.',
  direction: 'long',
  minBars: 130,
  checks(snap): Check[] | null {
    const { pctFrom52wHigh, return63d, return126d, sma200, close } = snap;
    if (pctFrom52wHigh === null || return63d === null || return126d === null) return null;
    return [
      {
        name: 'near 52-week high',
        passed: pctFrom52wHigh <= 10,
        detail: `${fmt(pctFrom52wHigh)}% below the 52-week high`,
        weight: 3,
        quality: ramp(pctFrom52wHigh, 10, 0),
      },
      {
        name: '3-month strength',
        passed: return63d > 0,
        detail: `Up ${fmt(return63d)}% over 3 months`,
        weight: 2,
        quality: ramp(return63d, 0, 40),
      },
      {
        name: '6-month strength',
        passed: return126d > 0,
        detail: `Up ${fmt(return126d)}% over 6 months`,
        weight: 2,
        quality: ramp(return126d, 0, 70),
      },
      {
        name: 'above 200-day average',
        passed: sma200 === null || close > sma200,
        detail:
          sma200 === null
            ? 'Not enough history for a 200-day average'
            : `Close is ${fmt(((close - sma200) / sma200) * 100)}% above the 200-day average`,
        weight: 1,
        quality: sma200 === null ? 0.5 : ramp(((close - sma200) / sma200) * 100, 0, 30),
      },
    ];
  },
});
