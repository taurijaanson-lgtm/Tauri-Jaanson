import type { Bar, Series } from '../types.js';
import type { FetchOptions, Provider } from './types.js';

/** Deterministic PRNG, so a given symbol always produces the same history. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Box-Muller, so returns are normally distributed rather than uniform. */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

type Archetype =
  | 'breakout'
  | 'leader'
  | 'pullback'
  | 'extended'
  | 'squeeze'
  | 'gap'
  | 'volume-spike'
  | 'downtrend'
  | 'chop';

const ARCHETYPES: Archetype[] = [
  'breakout',
  'leader',
  'pullback',
  'extended',
  'squeeze',
  'gap',
  'volume-spike',
  'downtrend',
  'chop',
];

/** Weekdays only, counting back from `end` — sessions, not calendar days. */
function sessionDates(count: number, end: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(end);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

/**
 * Generates plausible OHLCV history offline. Each symbol is assigned one of a
 * handful of archetypes from its name hash, so the sample universe reliably
 * contains examples of every setup the scanner looks for. It is for developing
 * and testing rules — never for judging how a strategy would actually perform.
 */
export class SampleProvider implements Provider {
  readonly name = 'sample';

  constructor(private readonly asOf: Date = new Date()) {}

  archetypeFor(symbol: string): Archetype {
    return ARCHETYPES[hash(symbol) % ARCHETYPES.length] as Archetype;
  }

  async fetchSeries(symbol: string, options: FetchOptions): Promise<Series | null> {
    const count = Math.max(options.bars, 260);
    const rand = mulberry32(hash(symbol));
    const archetype = this.archetypeFor(symbol);
    const dates = sessionDates(count, this.asOf);

    const drift: Record<Archetype, number> = {
      breakout: 0.0006,
      leader: 0.0018,
      pullback: 0.0028,
      extended: 0.001,
      squeeze: 0.0003,
      gap: 0.0004,
      'volume-spike': 0.0003,
      downtrend: -0.0012,
      chop: 0,
    };
    const baseVol = archetype === 'squeeze' ? 0.011 : 0.016 + rand() * 0.01;

    let price = 20 + rand() * 180;
    const closes: number[] = [];
    for (let i = 0; i < count; i++) {
      const fromEnd = count - 1 - i;
      let mu = drift[archetype];
      let sigma = baseVol;

      // Shape the tail of the series so the intended setup is present at the
      // final bar; everything before that is an ordinary random walk.
      if (archetype === 'pullback' && fromEnd < 8) mu = -0.011;
      if (archetype === 'extended' && fromEnd < 12) mu = 0.012;
      if (archetype === 'squeeze' && fromEnd < 45) sigma = 0.004;
      if (archetype === 'breakout' && fromEnd < 25 && fromEnd >= 1) mu = -0.0015;

      price *= 1 + mu + sigma * gaussian(rand);
      price = Math.max(price, 1);
      closes.push(price);
    }

    const avgVolume = 500_000 + Math.floor(rand() * 4_000_000);
    const bars: Bar[] = closes.map((close, i) => {
      const prevClose = i > 0 ? (closes[i - 1] as number) : close;
      const range = close * (baseVol * (0.8 + rand() * 0.8));
      const open = prevClose * (1 + (rand() - 0.5) * baseVol);
      const high = Math.max(open, close) + range * rand() * 0.5;
      const low = Math.min(open, close) - range * rand() * 0.5;
      return {
        date: dates[i] as string,
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close),
        volume: Math.round(avgVolume * (0.7 + rand() * 0.6)),
      };
    });

    this.applyFinalBar(bars, archetype, avgVolume, rand);
    return { symbol, bars: bars.slice(-options.bars) };
  }

  /** Stamps the archetype's signature onto the most recent session. */
  private applyFinalBar(
    bars: Bar[],
    archetype: Archetype,
    avgVolume: number,
    rand: () => number,
  ): void {
    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    if (!latest || !prev) return;

    if (archetype === 'breakout') {
      const priorHigh = Math.max(...bars.slice(-21, -1).map((bar) => bar.high));
      latest.close = round(priorHigh * (1.005 + rand() * 0.02));
      latest.open = round(prev.close * (1 + rand() * 0.004));
      latest.high = round(Math.max(latest.close * 1.004, priorHigh * 1.01));
      latest.low = round(Math.min(latest.open, prev.close) * 0.996);
      latest.volume = Math.round(avgVolume * (1.6 + rand() * 1.6));
    }

    if (archetype === 'gap') {
      latest.open = round(prev.close * (1.025 + rand() * 0.05));
      latest.close = round(latest.open * (1.002 + rand() * 0.02));
      latest.high = round(latest.close * 1.008);
      latest.low = round(latest.open * 0.992);
      latest.volume = Math.round(avgVolume * (2.2 + rand() * 2.5));
    }

    if (archetype === 'volume-spike') {
      latest.close = round(prev.close * (1.02 + rand() * 0.03));
      latest.open = round(prev.close * 1.001);
      latest.high = round(latest.close * 1.006);
      latest.low = round(latest.open * 0.995);
      latest.volume = Math.round(avgVolume * (3 + rand() * 3));
    }
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
