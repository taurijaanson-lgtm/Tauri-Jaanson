import type { Hit, RuleResult, Series, Snapshot, Strategy } from '../types.js';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Maps `value` onto 0..1 by where it falls between `from` and `to`, clamped at
 * both ends. `from` may be greater than `to` when lower values score better.
 */
export function ramp(value: number, from: number, to: number): number {
  if (from === to) return value >= to ? 1 : 0;
  return clamp((value - from) / (to - from), 0, 1);
}

export function fmt(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(digits);
}

/** A single scored condition: a gate that must pass, plus its contribution. */
export interface Check {
  name: string;
  passed: boolean;
  detail: string;
  /** Relative weight of this check in the final score. */
  weight: number;
  /** 0..1 quality of the check, independent of whether it passed. */
  quality: number;
  /** When false, failing this check does not disqualify the setup. */
  gate?: boolean;
}

export interface Scored {
  passed: boolean;
  score: number;
  rules: RuleResult[];
  reasons: string[];
}

/**
 * Combines checks into a pass/fail plus a 0-100 score. Every gating check must
 * pass; the score is the weighted average of the qualities, so a setup that
 * merely clears its gates scores far below one that clears them convincingly.
 */
export function score(checks: Check[]): Scored {
  const gatesPassed = checks.every((check) => check.gate === false || check.passed);
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const weighted = checks.reduce((sum, check) => sum + check.weight * clamp(check.quality, 0, 1), 0);
  return {
    passed: gatesPassed,
    score: totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 1000) / 10,
    rules: checks.map(({ name, passed, detail }) => ({ name, passed, detail })),
    reasons: checks.filter((check) => check.passed).map((check) => check.detail),
  };
}

/** Wraps the common "evaluate checks, emit a Hit when they pass" shape. */
export function makeStrategy(
  spec: Omit<Strategy, 'evaluate'> & {
    checks(snapshot: Snapshot, series: Series): Check[] | null;
  },
): Strategy {
  return {
    name: spec.name,
    description: spec.description,
    direction: spec.direction,
    minBars: spec.minBars,
    evaluate(snap: Snapshot, series: Series): Hit | null {
      if (series.bars.length < spec.minBars) return null;
      const checks = spec.checks(snap, series);
      if (!checks) return null;
      const result = score(checks);
      if (!result.passed) return null;
      return {
        symbol: snap.symbol,
        strategy: spec.name,
        score: result.score,
        direction: spec.direction,
        date: snap.date,
        close: snap.close,
        reasons: result.reasons,
        rules: result.rules,
        snapshot: snap,
      };
    },
  };
}
