/** A single daily OHLCV bar. `date` is the bar's session date, ISO `YYYY-MM-DD`. */
export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Price history for one symbol, oldest bar first. */
export interface Series {
  symbol: string;
  bars: Bar[];
}

/**
 * Indicator values computed from a series, all taken at the most recent bar.
 * Anything that needs more history than the series holds is `null` rather than
 * a partially-warmed-up number, so rules can decide what to do about it.
 */
export interface Snapshot {
  symbol: string;
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  prevClose: number | null;
  /** Percent change from the previous close, e.g. 2.5 for +2.5%. */
  changePct: number | null;
  /** Percent gap between today's open and the previous close. */
  gapPct: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema21: number | null;
  rsi14: number | null;
  atr14: number | null;
  /** ATR as a percent of close — volatility on a comparable scale across symbols. */
  atrPct: number | null;
  adx14: number | null;
  bollinger: { upper: number; middle: number; lower: number; bandwidth: number } | null;
  /** Where the close sits inside the Bollinger band: 0 at the lower band, 1 at the upper. */
  percentB: number | null;
  avgVolume20: number | null;
  /** Today's volume divided by the 20-day average volume. */
  relativeVolume: number | null;
  high52w: number | null;
  low52w: number | null;
  /** Percent below the 52-week high (0 means sitting at the high). */
  pctFrom52wHigh: number | null;
  /** Highest high of the prior N bars, excluding today. */
  priorHigh20: number | null;
  priorHigh50: number | null;
  priorLow20: number | null;
  /** Total return over the trailing N sessions, in percent. */
  return5d: number | null;
  return21d: number | null;
  return63d: number | null;
  return126d: number | null;
}

/** One condition a strategy checked, kept so results can explain themselves. */
export interface RuleResult {
  name: string;
  passed: boolean;
  detail: string;
}

/** A symbol that matched a strategy, with the evidence behind the match. */
export interface Hit {
  symbol: string;
  strategy: string;
  /** 0-100. Comparable within a strategy; across strategies it is a rough guide. */
  score: number;
  direction: 'long' | 'short';
  date: string;
  close: number;
  reasons: string[];
  rules: RuleResult[];
  snapshot: Snapshot;
}

export interface Strategy {
  name: string;
  description: string;
  direction: 'long' | 'short';
  /** Bars needed before the strategy can evaluate a symbol at all. */
  minBars: number;
  /** Returns null when the setup is absent. */
  evaluate(snapshot: Snapshot, series: Series): Hit | null;
}
