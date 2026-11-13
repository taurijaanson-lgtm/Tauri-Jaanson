/** All money is held as integer US cents to avoid floating-point drift. */
export type Cents = number;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatUsd(cents: Cents, opts: { whole?: boolean } = {}): string {
  return (opts.whole ? usdWhole : usd).format(cents / 100);
}

/** Parses "$1,234.56", "1234.5" or 1234.56 into cents. Returns null when unparseable. */
export function parseUsd(input: string | number): Cents | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = '0', frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function isValidCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export interface FeeSchedule {
  /** Platform fee in basis points of funds collected (500 = 5%). */
  platformRateBps: number;
  /** Card processing fee in basis points per charge (290 = 2.9%). */
  processingRateBps: number;
  /** Fixed card processing fee per successful charge. */
  processingFixedCents: Cents;
}

/** Typical US card pricing (2.9% + 30¢) plus a 5% platform fee. */
export const DEFAULT_FEES: FeeSchedule = {
  platformRateBps: 500,
  processingRateBps: 290,
  processingFixedCents: 30,
};

export function bps(amount: Cents, rateBps: number): Cents {
  return Math.round((amount * rateBps) / 10_000);
}

export function processingFee(charge: Cents, fees: FeeSchedule = DEFAULT_FEES): Cents {
  if (charge <= 0) return 0;
  return bps(charge, fees.processingRateBps) + fees.processingFixedCents;
}

export interface PayoutBreakdown {
  gross: Cents;
  platformFee: Cents;
  processingFees: Cents;
  net: Cents;
  charges: number;
}

/** What the creator receives from a set of successful charges. */
export function payoutBreakdown(charges: Cents[], fees: FeeSchedule = DEFAULT_FEES): PayoutBreakdown {
  const gross = charges.reduce((sum, c) => sum + c, 0);
  const platformFee = bps(gross, fees.platformRateBps);
  const processingFees = charges.reduce((sum, c) => sum + processingFee(c, fees), 0);
  return {
    gross,
    platformFee,
    processingFees,
    net: Math.max(0, gross - platformFee - processingFees),
    charges: charges.length,
  };
}
