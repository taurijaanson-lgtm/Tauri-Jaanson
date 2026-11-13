import { describe, expect, it } from 'vitest';
import { AppError, slugify } from '../src/service.js';
import { ADDRESS, DAY, setup, validCampaign } from './helpers.js';

describe('campaign review and launch', () => {
  it('walks draft → review → approved → live', async () => {
    const t = setup();
    await t.readyCreator();
    const c = t.platform.createCampaign(t.creator.id, validCampaign());
    expect(c.status).toBe('draft');
    expect(c.slug).toBe('riverbend-record-pressing');
    t.platform.submitForReview(t.creator.id, c.id);
    expect(t.platform.reviewQueue(t.admin.id).map((x) => x.id)).toEqual([c.id]);
    t.platform.review(t.admin.id, c.id, { approve: true });
    const live = t.platform.launch(t.creator.id, c.id);
    expect(live.status).toBe('live');
    expect(Date.parse(live.deadline!) - t.clock.now().getTime()).toBe(30 * DAY);
  });

  it('rejects submission with policy issues', async () => {
    const t = setup();
    const c = t.platform.createCampaign(t.creator.id, { ...validCampaign(), story: 'Buy equity in our label! '.repeat(4) });
    expect(() => t.platform.submitForReview(t.creator.id, c.id)).toThrow(AppError);
  });

  it('blocks launch until the creator is verified with a payout account', () => {
    const t = setup();
    const c = t.platform.createCampaign(t.creator.id, validCampaign());
    t.platform.submitForReview(t.creator.id, c.id);
    t.platform.review(t.admin.id, c.id, { approve: true });
    expect(() => t.platform.launch(t.creator.id, c.id)).toThrow(/Finish setting up/);
  });

  it('only admins can review', () => {
    const t = setup();
    expect(() => t.platform.reviewQueue(t.backer.id)).toThrow(/access/);
  });

  it('hides drafts from the public', () => {
    const t = setup();
    const c = t.platform.createCampaign(t.creator.id, validCampaign());
    expect(() => t.platform.getCampaign(c.slug)).toThrow(/not found/);
    expect(t.platform.getCampaign(c.slug, t.creator.id).id).toBe(c.id);
    expect(t.platform.listPublic()).toEqual([]);
  });

  it('makes slugs unique', () => {
    expect(slugify('Hello, World!  2026')).toBe('hello-world-2026');
    const t = setup();
    const a = t.platform.createCampaign(t.creator.id, { title: 'Same name' });
    const b = t.platform.createCampaign(t.creator.id, { title: 'Same name' });
    expect([a.slug, b.slug]).toEqual(['same-name', 'same-name-2']);
  });
});

describe('pledging', () => {
  it('saves the card without charging for all-or-nothing', async () => {
    const t = setup();
    const c = await t.liveCampaign();
    const p = await t.platform.pledge(t.backer.id, c.id, { amountCents: 50_00, paymentToken: 'tok_visa' });
    expect(p.status).toBe('pending');
    expect(t.payments.charges.size).toBe(0);
    expect(t.platform.stats(c)).toMatchObject({ pledgedCents: 50_00, backers: 1, percentFunded: 5 });
  });

  it('charges immediately for keep-it-all', async () => {
    const t = setup();
    const c = await t.liveCampaign({ fundingModel: 'keep_it_all' });
    const p = await t.platform.pledge(t.backer.id, c.id, { amountCents: 50_00, paymentToken: 'tok_visa' });
    expect(p.status).toBe('collected');
    expect(t.payments.charges.size).toBe(1);
  });

  it('requires reward minimum plus shipping and a valid address', async () => {
    const t = setup();
    const c = await t.liveCampaign();
    const vinyl = c.rewards[1]!;
    await expect(
      t.platform.pledge(t.backer.id, c.id, { amountCents: 35_00, rewardId: vinyl.id, paymentToken: 'tok_visa', shippingAddress: ADDRESS }),
    ).rejects.toThrow(/minimum/);
    await expect(
      t.platform.pledge(t.backer.id, c.id, { amountCents: 42_00, rewardId: vinyl.id, paymentToken: 'tok_visa' }),
    ).rejects.toThrow(/address/);
    const p = await t.platform.pledge(t.backer.id, c.id, {
      amountCents: 42_00, rewardId: vinyl.id, paymentToken: 'tok_visa', shippingAddress: ADDRESS,
    });
    expect(p.shippingCents).toBe(7_00);
    expect(t.platform.stats(c).pledgedCents).toBe(35_00);
  });

  it('enforces reward quantity limits', async () => {
    const t = setup();
    const c = await t.liveCampaign();
    const vinyl = c.rewards[1]!;
    const pledge = (id: string) =>
      t.platform.pledge(id, c.id, { amountCents: 42_00, rewardId: vinyl.id, paymentToken: 'tok_visa', shippingAddress: ADDRESS });
    await pledge(t.backer.id);
    await pledge(t.backer2.id);
    await expect(pledge(t.backer.id)).rejects.toThrow(/sold out/);
  });

  it('prevents creators backing their own campaign and pledges after the deadline', async () => {
    const t = setup();
    const c = await t.liveCampaign();
    await expect(t.platform.pledge(t.creator.id, c.id, { amountCents: 10_00, paymentToken: 'tok_visa' })).rejects.toThrow(/own/);
    t.clock.advance(31 * DAY);
    await expect(t.platform.pledge(t.backer.id, c.id, { amountCents: 10_00, paymentToken: 'tok_visa' })).rejects.toThrow(/not accepting/);
  });

  it('lets backers cancel pending pledges', async () => {
    const t = setup();
    const c = await t.liveCampaign();
    const p = await t.platform.pledge(t.backer.id, c.id, { amountCents: 50_00, paymentToken: 'tok_visa' });
    await expect(t.platform.cancelPledge(t.backer2.id, p.id)).rejects.toThrow(/access/);
    expect((await t.platform.cancelPledge(t.backer.id, p.id)).status).toBe('cancelled');
    expect(t.platform.stats(c).pledgedCents).toBe(0);
  });
});

describe('settlement', () => {
  it('charges everyone and pays out when an all-or-nothing goal is met', async () => {
    const t = setup();
    const c = await t.liveCampaign();
    await t.platform.pledge(t.backer.id, c.id, { amountCents: 600_00, paymentToken: 'tok_visa' });
    await t.platform.pledge(t.backer2.id, c.id, { amountCents: 500_00, paymentToken: 'tok_chargeDeclined' });

    expect(await t.platform.settleDueCampaigns()).toEqual([]); // not due yet
    t.clock.advance(30 * DAY);
    const [settled] = await t.platform.settleDueCampaigns();

    expect(settled!.status).toBe('successful');
    const statuses = t.store.pledgesFor(c.id).map((p) => p.status).sort();
    expect(statuses).toEqual(['collected', 'failed']);
    // Only the successful charge is paid out: 600 - 5% - (2.9% + 30¢)
    expect(settled!.payout).toMatchObject({ gross: 600_00, platformFee: 30_00, processingFees: 17_70, net: 552_30 });
    expect(t.payments.payouts).toHaveLength(1);

    // Re-running is a no-op.
    expect(await t.platform.settleDueCampaigns()).toEqual([]);
    expect(t.payments.payouts).toHaveLength(1);
  });

  it('releases cards without charging when an all-or-nothing goal is missed', async () => {
    const t = setup();
    const c = await t.liveCampaign();
    await t.platform.pledge(t.backer.id, c.id, { amountCents: 100_00, paymentToken: 'tok_visa' });
    t.clock.advance(30 * DAY);
    const [settled] = await t.platform.settleDueCampaigns();
    expect(settled!.status).toBe('unsuccessful');
    expect(t.store.pledgesFor(c.id)[0]!.status).toBe('cancelled');
    expect(t.payments.charges.size).toBe(0);
    expect(settled!.payout).toBeUndefined();
  });

  it('pays out keep-it-all campaigns even below goal', async () => {
    const t = setup();
    const c = await t.liveCampaign({ fundingModel: 'keep_it_all' });
    await t.platform.pledge(t.backer.id, c.id, { amountCents: 100_00, paymentToken: 'tok_visa' });
    t.clock.advance(30 * DAY);
    const [settled] = await t.platform.settleDueCampaigns();
    expect(settled!.status).toBe('successful');
    expect(settled!.payout!.net).toBe(100_00 - 5_00 - 3_20);
  });

  it('refunds collected pledges when a live campaign is cancelled', async () => {
    const t = setup();
    const c = await t.liveCampaign({ fundingModel: 'keep_it_all' });
    const p = await t.platform.pledge(t.backer.id, c.id, { amountCents: 100_00, paymentToken: 'tok_visa' });
    await t.platform.cancelCampaign(t.creator.id, c.id);
    expect(t.store.pledges.get(p.id)!.status).toBe('refunded');
    expect(t.payments.charges.get(p.chargeRef!)!.refunded).toBe(100_00);
  });
});

describe('nonprofits', () => {
  it('only marks campaigns tax-deductible once an admin verifies the EIN', async () => {
    const t = setup();
    await t.readyCreator();
    const c = t.platform.createCampaign(t.creator.id, { ...validCampaign(), nonprofitEin: '12-3456789' });
    expect(t.platform.toPublic(c).taxDeductible).toBe(false);
    t.platform.submitForReview(t.creator.id, c.id);
    t.platform.review(t.admin.id, c.id, { approve: true, nonprofitVerified: true });
    expect(t.platform.toPublic(c).taxDeductible).toBe(true);
  });
});
