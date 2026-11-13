import { randomUUID } from 'node:crypto';
import type { Cents } from './money.js';

export type ChargeResult = { ok: true; chargeRef: string } | { ok: false; reason: string };

/**
 * The seam to a real processor. A Stripe implementation maps to:
 *  - savePaymentMethod → SetupIntent (off-session), so all-or-nothing pledges can be charged
 *    days or weeks later. Card authorizations expire after about 7 days, so
 *    authorize-then-capture does not work for 30–60 day campaigns.
 *  - charge            → PaymentIntent with off_session=true, confirm=true, idempotency key
 *  - refund            → Refund
 *  - createPayoutAccount / payout → Connect Express account + Transfer
 */
export interface PaymentProvider {
  savePaymentMethod(customerId: string, token: string): Promise<{ paymentMethodRef: string }>;
  charge(paymentMethodRef: string, amount: Cents, idempotencyKey: string): Promise<ChargeResult>;
  refund(chargeRef: string, amount: Cents): Promise<void>;
  createPayoutAccount(userId: string): Promise<{ accountRef: string }>;
  payout(accountRef: string, amount: Cents, idempotencyKey: string): Promise<{ payoutRef: string }>;
}

/**
 * Deterministic in-process provider for development and tests. Test tokens:
 *   tok_visa             always succeeds
 *   tok_chargeDeclined   saves fine, declines when charged (an expired or maxed-out card)
 *   tok_invalid          rejected when saved
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly charges = new Map<string, { ref: string; amount: Cents; refunded: Cents }>();
  readonly payouts: { accountRef: string; amount: Cents; payoutRef: string }[] = [];
  private readonly methods = new Map<string, string>();
  private readonly idempotent = new Map<string, ChargeResult>();

  async savePaymentMethod(_customerId: string, token: string) {
    if (token === 'tok_invalid' || !token.startsWith('tok_')) throw new Error('Card was rejected.');
    const ref = `pm_${randomUUID()}`;
    this.methods.set(ref, token);
    return { paymentMethodRef: ref };
  }

  async charge(paymentMethodRef: string, amount: Cents, idempotencyKey: string): Promise<ChargeResult> {
    const prior = this.idempotent.get(idempotencyKey);
    if (prior) return prior;
    const token = this.methods.get(paymentMethodRef);
    let result: ChargeResult;
    if (!token) result = { ok: false, reason: 'Unknown payment method.' };
    else if (token === 'tok_chargeDeclined') result = { ok: false, reason: 'Card declined.' };
    else {
      const ref = `ch_${randomUUID()}`;
      this.charges.set(ref, { ref, amount, refunded: 0 });
      result = { ok: true, chargeRef: ref };
    }
    this.idempotent.set(idempotencyKey, result);
    return result;
  }

  async refund(chargeRef: string, amount: Cents) {
    const c = this.charges.get(chargeRef);
    if (!c) throw new Error('Unknown charge.');
    if (c.refunded + amount > c.amount) throw new Error('Refund exceeds charge.');
    c.refunded += amount;
  }

  async createPayoutAccount(userId: string) {
    return { accountRef: `acct_${userId.slice(0, 8)}` };
  }

  async payout(accountRef: string, amount: Cents, idempotencyKey: string) {
    const payoutRef = `po_${idempotencyKey}`;
    if (!this.payouts.some((p) => p.payoutRef === payoutRef)) {
      this.payouts.push({ accountRef, amount, payoutRef });
    }
    return { payoutRef };
  }
}
