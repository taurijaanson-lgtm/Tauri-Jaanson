import type { Strategy } from '../types.js';
import { breakout, momentumLeader } from './momentum.js';
import { overboughtFade, oversoldBounce } from './meanReversion.js';
import { goldenCross, trendStack } from './trend.js';
import { gapUp, squeeze, unusualVolume } from './volatility.js';

export const strategies: Strategy[] = [
  breakout,
  momentumLeader,
  trendStack,
  goldenCross,
  oversoldBounce,
  overboughtFade,
  gapUp,
  squeeze,
  unusualVolume,
];

/** Named groups so `--strategy momentum` selects a family, not just one rule. */
export const strategyGroups: Record<string, string[]> = {
  all: strategies.map((strategy) => strategy.name),
  momentum: [breakout.name, momentumLeader.name],
  trend: [trendStack.name, goldenCross.name],
  'mean-reversion': [oversoldBounce.name, overboughtFade.name],
  volatility: [gapUp.name, squeeze.name, unusualVolume.name],
  long: strategies.filter((s) => s.direction === 'long').map((s) => s.name),
  short: strategies.filter((s) => s.direction === 'short').map((s) => s.name),
};

/**
 * Resolves names and group names to strategies. Throws on an unknown name so a
 * typo surfaces immediately instead of silently scanning for nothing.
 */
export function resolveStrategies(selectors: string[]): Strategy[] {
  const byName = new Map(strategies.map((strategy) => [strategy.name, strategy]));
  const chosen = new Map<string, Strategy>();
  for (const selector of selectors) {
    const key = selector.trim().toLowerCase();
    const group = strategyGroups[key];
    const names = group ?? (byName.has(key) ? [key] : null);
    if (!names) {
      const known = [...Object.keys(strategyGroups), ...byName.keys()].join(', ');
      throw new Error(`Unknown strategy "${selector}". Available: ${known}`);
    }
    for (const name of names) {
      const strategy = byName.get(name);
      if (strategy) chosen.set(name, strategy);
    }
  }
  return [...chosen.values()];
}

export {
  breakout,
  momentumLeader,
  trendStack,
  goldenCross,
  oversoldBounce,
  overboughtFade,
  gapUp,
  squeeze,
  unusualVolume,
};
