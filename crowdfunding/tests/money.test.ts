import { describe, expect, it } from 'vitest';
import { DEFAULT_FEES, formatUsd, parseUsd, payoutBreakdown, processingFee } from '../src/money.js';

describe('money', () => {
  it('formats US dollars', () => {
    expect(formatUsd(123456)).toBe('$1,234.56');
    expect(formatUsd(1_000_000_00, { whole: true })).toBe('$1,000,000');
  });

  it('parses dollar strings into cents without float drift', () => {
    expect(parseUsd('$1,234.56')).toBe(123456);
    expect(parseUsd('19.9')).toBe(1990);
    expect(parseUsd('0.29')).toBe(29);
    expect(parseUsd(0.29)).toBe(29);
    expect(parseUsd('12.345')).toBeNull();
    expect(parseUsd('-5')).toBeNull();
    expect(parseUsd('abc')).toBeNull();
  });

  it('charges 2.9% + 30¢ per card charge', () => {
    expect(processingFee(100_00)).toBe(3_20);
    expect(processingFee(0)).toBe(0);
  });

  it('computes creator payout net of platform and processing fees', () => {
    const b = payoutBreakdown([100_00, 50_00], DEFAULT_FEES);
    expect(b.gross).toBe(150_00);
    expect(b.platformFee).toBe(7_50);
    expect(b.processingFees).toBe(3_20 + 1_75);
    expect(b.net).toBe(150_00 - 7_50 - 4_95);
  });
});
