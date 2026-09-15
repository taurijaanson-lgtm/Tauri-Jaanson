import { describe, expect, it } from 'vitest';
import { format, formatCsv, formatJson, formatTable } from '../src/format.js';
import type { ScanResult } from '../src/scanner.js';
import type { Hit, Snapshot } from '../src/types.js';

function snapshotStub(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    symbol: 'AAA',
    date: '2024-05-01',
    close: 100,
    open: 99,
    high: 101,
    low: 98,
    volume: 1_000_000,
    prevClose: 98,
    changePct: 2.04,
    gapPct: 1,
    sma20: 97,
    sma50: 95,
    sma200: 90,
    ema21: 96,
    rsi14: 61.2,
    atr14: 2,
    atrPct: 2,
    adx14: 25,
    bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 },
    percentB: 0.5,
    avgVolume20: 800_000,
    relativeVolume: 1.25,
    high52w: 110,
    low52w: 70,
    pctFrom52wHigh: 9.09,
    priorHigh20: 99,
    priorHigh50: 102,
    priorLow20: 92,
    return5d: 3,
    return21d: 8,
    return63d: 15,
    return126d: 30,
    ...overrides,
  };
}

function hitStub(overrides: Partial<Hit> = {}): Hit {
  return {
    symbol: 'AAA',
    strategy: 'breakout',
    score: 72.5,
    direction: 'long',
    date: '2024-05-01',
    close: 100,
    reasons: ['Close is above the prior 20-day high'],
    rules: [
      { name: 'breaks 20-day high', passed: true, detail: 'Close is above the prior 20-day high' },
      { name: 'volume confirms', passed: false, detail: 'Volume is 0.9x its 20-day average' },
    ],
    snapshot: snapshotStub(),
    ...overrides,
  };
}

function resultStub(hits: Hit[]): ScanResult {
  return {
    hits,
    scanned: hits.length,
    skipped: 0,
    errors: [],
    startedAt: '2024-05-01T00:00:00.000Z',
    finishedAt: '2024-05-01T00:00:05.000Z',
  };
}

describe('formatTable', () => {
  it('renders aligned columns with a summary line', () => {
    const output = formatTable(resultStub([hitStub()]));
    const lines = output.split('\n');
    expect(lines[0]).toContain('SYMBOL');
    expect(lines[0]).toContain('<52WH%');
    expect(lines[2]).toContain('AAA');
    expect(lines[2]).toContain('72.5');
    expect(output).toContain('1 setup(s) from 1 symbol(s)');
  });

  it('says so plainly when nothing matched', () => {
    expect(formatTable(resultStub([]))).toContain('No setups found');
  });

  it('lists met and unmet conditions in verbose mode', () => {
    const output = formatTable(resultStub([hitStub()]), true);
    expect(output).toContain('• Close is above the prior 20-day high');
    expect(output).toContain('◦ (not met) Volume is 0.9x its 20-day average');
  });

  it('prints a dash for indicators that have no value yet', () => {
    const output = formatTable(resultStub([hitStub({ snapshot: snapshotStub({ rsi14: null }) })]));
    expect(output).toMatch(/\s-\s/);
  });
});

describe('formatCsv', () => {
  it('writes a header and one row per hit', () => {
    const lines = formatCsv(resultStub([hitStub(), hitStub({ symbol: 'BBB' })])).split('\n');
    expect(lines[0]).toBe(
      'symbol,strategy,direction,score,date,close,change_pct,rel_volume,rsi14,atr_pct,pct_from_52w_high,reasons',
    );
    expect(lines).toHaveLength(3);
    expect(lines[2]?.startsWith('BBB,breakout,long,')).toBe(true);
  });

  it('quotes fields that contain separators', () => {
    const output = formatCsv(resultStub([hitStub({ reasons: ['a, b', 'says "hi"'] })]));
    expect(output).toContain('"a, b; says ""hi"""');
  });
});

describe('formatJson', () => {
  it('round-trips the result', () => {
    const result = resultStub([hitStub()]);
    expect(JSON.parse(formatJson(result))).toEqual(JSON.parse(JSON.stringify(result)));
  });
});

describe('format', () => {
  it('dispatches on the requested format', () => {
    const result = resultStub([hitStub()]);
    expect(format(result, 'csv')).toBe(formatCsv(result));
    expect(format(result, 'json')).toBe(formatJson(result));
    expect(format(result, 'table')).toBe(formatTable(result));
  });
});
