import type { Strategy } from '../types.js';
import { fmt, makeStrategy, ramp, type Check } from './shared.js';

/**
 * A pullback inside an intact uptrend: stretched to the downside on RSI and
 * the lower Bollinger band, but still above the 200-day average.
 */
export const oversoldBounce: Strategy = makeStrategy({
  name: 'oversold-bounce',
  description: 'RSI below 32 and a tag of the lower Bollinger band, above the 200-day average.',
  direction: 'long',
  minBars: 60,
  checks(snap): Check[] | null {
    const { rsi14, bollinger, percentB, sma200, sma50, close } = snap;
    if (rsi14 === null || bollinger === null || percentB === null) return null;
    const trendRef = sma200 ?? sma50;
    return [
      {
        name: 'oversold',
        passed: rsi14 <= 32,
        detail: `RSI(14) is ${fmt(rsi14)}`,
        weight: 3,
        quality: ramp(rsi14, 32, 12),
      },
      {
        name: 'at lower band',
        passed: percentB <= 0.1,
        detail: `Close sits at ${fmt(percentB * 100, 0)}% of the Bollinger range (lower band ${fmt(bollinger.lower)})`,
        weight: 2,
        quality: ramp(percentB, 0.1, -0.15),
      },
      {
        name: 'uptrend intact',
        passed: trendRef !== null && close > trendRef,
        detail:
          trendRef === null
            ? 'No long-term average available'
            : `Close is ${fmt(((close - trendRef) / trendRef) * 100)}% above the long-term average`,
        weight: 2,
        // Right at the average is the best risk/reward; far above it means the
        // pullback has a lot further it could run.
        quality: trendRef === null ? 0 : ramp(((close - trendRef) / trendRef) * 100, 25, 1),
      },
    ];
  },
});

/** The mirror image: stretched to the upside and rolling over. */
export const overboughtFade: Strategy = makeStrategy({
  name: 'overbought-fade',
  description: 'RSI above 70 with the close pinned to the upper Bollinger band.',
  direction: 'short',
  minBars: 60,
  checks(snap): Check[] | null {
    const { rsi14, bollinger, percentB, sma20, close } = snap;
    if (rsi14 === null || bollinger === null || percentB === null || sma20 === null) return null;
    const stretch = ((close - sma20) / sma20) * 100;
    return [
      {
        name: 'overbought',
        passed: rsi14 >= 70,
        detail: `RSI(14) is ${fmt(rsi14)}`,
        weight: 3,
        quality: ramp(rsi14, 70, 88),
      },
      {
        name: 'at upper band',
        passed: percentB >= 0.9,
        detail: `Close sits at ${fmt(percentB * 100, 0)}% of the Bollinger range (upper band ${fmt(bollinger.upper)})`,
        weight: 2,
        quality: ramp(percentB, 0.9, 1.15),
      },
      {
        name: 'extended from 20-day average',
        passed: stretch >= 5,
        detail: `Close is ${fmt(stretch)}% above the 20-day average`,
        weight: 2,
        quality: ramp(stretch, 5, 20),
      },
    ];
  },
});
