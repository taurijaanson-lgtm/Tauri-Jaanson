import type { Bar, Series, Snapshot } from './types.js';

/** Last element of an array, or null when empty. */
function last<T>(values: T[]): T | null {
  return values.length > 0 ? (values[values.length - 1] as T) : null;
}

/** Simple moving average of the final `period` values. Null until warmed up. */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i] as number;
  return sum / period;
}

/**
 * Exponential moving average, seeded with the SMA of the first `period` values
 * so the result does not depend on how much extra history was passed in.
 */
export function ema(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const k = 2 / (period + 1);
  let acc = 0;
  for (let i = 0; i < period; i++) acc += values[i] as number;
  let current = acc / period;
  for (let i = period; i < values.length; i++) {
    current = (values[i] as number) * k + current * (1 - k);
  }
  return current;
}

/** Wilder's RSI over `period` bars. Returns 0-100, or null until warmed up. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = (values[i] as number) - (values[i - 1] as number);
    if (change >= 0) gain += change;
    else loss -= change;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const change = (values[i] as number) - (values[i - 1] as number);
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** True range of a bar given the previous close. */
export function trueRange(bar: Bar, prevClose: number): number {
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - prevClose),
    Math.abs(bar.low - prevClose),
  );
}

/** Wilder-smoothed Average True Range. */
export function atr(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const ranges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    ranges.push(trueRange(bars[i] as Bar, (bars[i - 1] as Bar).close));
  }
  let acc = 0;
  for (let i = 0; i < period; i++) acc += ranges[i] as number;
  let current = acc / period;
  for (let i = period; i < ranges.length; i++) {
    current = (current * (period - 1) + (ranges[i] as number)) / period;
  }
  return current;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  /** Band width as a fraction of the middle band — a volatility-squeeze gauge. */
  bandwidth: number;
}

export function bollinger(values: number[], period = 20, stdDevs = 2): BollingerBands | null {
  const middle = sma(values, period);
  if (middle === null) return null;
  let variance = 0;
  for (let i = values.length - period; i < values.length; i++) {
    variance += ((values[i] as number) - middle) ** 2;
  }
  const sd = Math.sqrt(variance / period);
  const upper = middle + stdDevs * sd;
  const lower = middle - stdDevs * sd;
  return { upper, middle, lower, bandwidth: middle === 0 ? 0 : (upper - lower) / middle };
}

/**
 * Wilder's ADX — trend strength regardless of direction. Needs roughly
 * `2 * period` bars before it produces a value.
 */
export function adx(bars: Bar[], period = 14): number | null {
  if (bars.length < period * 2 + 1) return null;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const ranges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const current = bars[i] as Bar;
    const prev = bars[i - 1] as Bar;
    const up = current.high - prev.high;
    const down = prev.low - current.low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    ranges.push(trueRange(current, prev.close));
  }

  const wilder = (values: number[]): number[] => {
    const out: number[] = [];
    let acc = 0;
    for (let i = 0; i < period; i++) acc += values[i] as number;
    out.push(acc);
    for (let i = period; i < values.length; i++) {
      acc = acc - acc / period + (values[i] as number);
      out.push(acc);
    }
    return out;
  };

  const smoothedTR = wilder(ranges);
  const smoothedPlus = wilder(plusDM);
  const smoothedMinus = wilder(minusDM);

  const dx: number[] = [];
  for (let i = 0; i < smoothedTR.length; i++) {
    const tr = smoothedTR[i] as number;
    if (tr === 0) {
      dx.push(0);
      continue;
    }
    const plusDI = (100 * (smoothedPlus[i] as number)) / tr;
    const minusDI = (100 * (smoothedMinus[i] as number)) / tr;
    const sum = plusDI + minusDI;
    dx.push(sum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / sum);
  }
  if (dx.length < period) return null;
  let acc = 0;
  for (let i = 0; i < period; i++) acc += dx[i] as number;
  let current = acc / period;
  for (let i = period; i < dx.length; i++) {
    current = (current * (period - 1) + (dx[i] as number)) / period;
  }
  return current;
}

/** Highest high over the last `period` bars, optionally ignoring the final bar. */
export function highestHigh(bars: Bar[], period: number, excludeLast = false): number | null {
  const window = excludeLast ? bars.slice(0, -1) : bars;
  if (window.length < period) return null;
  let max = -Infinity;
  for (let i = window.length - period; i < window.length; i++) {
    max = Math.max(max, (window[i] as Bar).high);
  }
  return max;
}

/** Lowest low over the last `period` bars, optionally ignoring the final bar. */
export function lowestLow(bars: Bar[], period: number, excludeLast = false): number | null {
  const window = excludeLast ? bars.slice(0, -1) : bars;
  if (window.length < period) return null;
  let min = Infinity;
  for (let i = window.length - period; i < window.length; i++) {
    min = Math.min(min, (window[i] as Bar).low);
  }
  return min;
}

/** Percent return over the trailing `period` sessions. */
export function returnPct(values: number[], period: number): number | null {
  if (values.length < period + 1) return null;
  const then = values[values.length - 1 - period] as number;
  const now = values[values.length - 1] as number;
  if (then === 0) return null;
  return ((now - then) / then) * 100;
}

/** Computes every indicator the strategies read, at the latest bar. */
export function snapshot(series: Series): Snapshot | null {
  const { bars } = series;
  const latest = last(bars);
  if (!latest) return null;

  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => bar.volume);
  const prevClose = bars.length > 1 ? (bars[bars.length - 2] as Bar).close : null;
  const bands = bollinger(closes, 20, 2);
  const atr14 = atr(bars, 14);
  const avgVolume20 = sma(volumes, 20);
  const high52w = highestHigh(bars, Math.min(252, bars.length));
  const low52w = lowestLow(bars, Math.min(252, bars.length));

  return {
    symbol: series.symbol,
    date: latest.date,
    close: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    volume: latest.volume,
    prevClose,
    changePct: prevClose ? ((latest.close - prevClose) / prevClose) * 100 : null,
    gapPct: prevClose ? ((latest.open - prevClose) / prevClose) * 100 : null,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    ema21: ema(closes, 21),
    rsi14: rsi(closes, 14),
    atr14,
    atrPct: atr14 !== null && latest.close !== 0 ? (atr14 / latest.close) * 100 : null,
    adx14: adx(bars, 14),
    bollinger: bands,
    percentB:
      bands && bands.upper !== bands.lower
        ? (latest.close - bands.lower) / (bands.upper - bands.lower)
        : null,
    avgVolume20,
    relativeVolume: avgVolume20 && avgVolume20 > 0 ? latest.volume / avgVolume20 : null,
    high52w,
    low52w,
    pctFrom52wHigh: high52w && high52w > 0 ? ((high52w - latest.close) / high52w) * 100 : null,
    priorHigh20: highestHigh(bars, 20, true),
    priorHigh50: highestHigh(bars, 50, true),
    priorLow20: lowestLow(bars, 20, true),
    return5d: returnPct(closes, 5),
    return21d: returnPct(closes, 21),
    return63d: returnPct(closes, 63),
    return126d: returnPct(closes, 126),
  };
}

/**
 * Rolling simple moving average at every index, with `null` for the bars before
 * the average is warmed up. Used by rules that need to compare an indicator to
 * where it stood a few sessions ago.
 */
export function smaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] as number;
    if (i >= period) sum -= values[i - period] as number;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Rolling Bollinger bandwidth, used to spot volatility squeezes. */
export function bandwidthSeries(values: number[], period = 20, stdDevs = 2): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const bands = bollinger(values.slice(0, i + 1), period, stdDevs);
    out[i] = bands ? bands.bandwidth : null;
  }
  return out;
}
