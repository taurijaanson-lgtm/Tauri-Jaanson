import type { Platform } from './service.js';

const DEMO_PASSWORD = 'demo1234';

/** Populates an empty store with demo accounts and live campaigns. */
export async function seedDemo(platform: Platform): Promise<void> {
  const { store } = platform;
  if (store.users.size) return;

  const admin = platform.register({ email: 'admin@example.com', name: 'Avery Admin', password: DEMO_PASSWORD }).user;
  admin.isAdmin = true;

  const creator = platform.register({ email: 'creator@example.com', name: 'Jordan Rivera', password: DEMO_PASSWORD }).user;
  platform.updateCreatorProfile(creator.id, { legalName: 'Jordan Rivera', dateOfBirth: '1988-04-12', state: 'OR' });
  await platform.connectPayoutAccount(creator.id);
  platform.verifyIdentity(admin.id, creator.id);

  const backer = platform.register({ email: 'backer@example.com', name: 'Sam Chen', password: DEMO_PASSWORD }).user;
  const backer2 = platform.register({ email: 'casey@example.com', name: 'Casey Morgan', password: DEMO_PASSWORD }).user;

  const nextYear = new Date().getUTCFullYear() + 1;
  const drafts = [
    {
      title: 'Trailhead: a solar camp stove',
      blurb: 'A folding stove that charges your phone while it boils water. Designed and built in Portland.',
      story:
        'We spent two years testing prototypes on the Pacific Crest Trail. Trailhead folds to the size of a paperback, ' +
        'burns standard canister fuel and carries a 10,000 mAh battery charged by an integrated solar panel. ' +
        'Your pledge funds our first production run with a manufacturer in Ohio.',
      category: 'technology' as const,
      goalCents: 40_000_00,
      fundingModel: 'all_or_nothing' as const,
      city: 'Portland',
      state: 'OR',
      durationDays: 30,
      rewards: [
        { title: 'Thank-you postcard', description: 'A hand-signed postcard from the trail.', minimumCents: 10_00, estimatedDelivery: `${nextYear}-02`, shipping: 'us_only' as const, shippingCents: 0 },
        { title: 'Early bird Trailhead', description: 'One stove at 30% off retail.', minimumCents: 89_00, quantityLimit: 200, estimatedDelivery: `${nextYear}-06`, shipping: 'us_only' as const, shippingCents: 8_00 },
        { title: 'Trailhead', description: 'One stove plus a carry case.', minimumCents: 119_00, estimatedDelivery: `${nextYear}-06`, shipping: 'worldwide' as const, shippingCents: 15_00 },
      ],
    },
    {
      title: 'Eastside Community Fridge',
      blurb: 'Keep three free community fridges stocked and powered in East Austin through the summer.',
      story:
        'Our volunteer network restocks three public fridges every day. Funds cover electricity, repairs and ' +
        'weekly grocery runs. We are a registered 501(c)(3), so your donation may be tax-deductible.',
      category: 'community' as const,
      goalCents: 8_000_00,
      fundingModel: 'keep_it_all' as const,
      city: 'Austin',
      state: 'TX',
      durationDays: 45,
      nonprofitEin: '74-1234567',
      rewards: [],
    },
    {
      title: 'Saltwater: a graphic novel',
      blurb: 'A 180-page graphic novel about a Maine lobstering family, printed in full color.',
      story:
        'Saltwater follows three generations of the Doucette family through one hard winter on the Maine coast. ' +
        'The art is finished; your pledge pays for printing, binding and shipping the first edition.',
      category: 'comics' as const,
      goalCents: 15_000_00,
      fundingModel: 'all_or_nothing' as const,
      city: 'Portland',
      state: 'ME',
      durationDays: 21,
      rewards: [
        { title: 'Digital edition', description: 'DRM-free PDF and EPUB.', minimumCents: 15_00, estimatedDelivery: `${nextYear}-03`, shipping: 'none' as const, shippingCents: 0 },
        { title: 'First edition hardcover', description: 'Signed, numbered hardcover.', minimumCents: 40_00, estimatedDelivery: `${nextYear}-05`, shipping: 'us_only' as const, shippingCents: 6_00 },
      ],
    },
  ];

  const address = { name: 'Sam Chen', line1: '100 Main St', city: 'Denver', state: 'CO', zip: '80202' };
  for (const [i, d] of drafts.entries()) {
    const c = platform.createCampaign(creator.id, d);
    platform.submitForReview(creator.id, c.id);
    platform.review(admin.id, c.id, { approve: true, nonprofitVerified: true });
    platform.launch(creator.id, c.id);
    const firstReward = c.rewards[1] ?? c.rewards[0];
    await platform.pledge(backer.id, c.id, {
      amountCents: firstReward ? firstReward.minimumCents + firstReward.shippingCents + 5_00 : 50_00,
      ...(firstReward ? { rewardId: firstReward.id } : {}),
      paymentToken: 'tok_visa',
      ...(firstReward && firstReward.shipping !== 'none' ? { shippingAddress: address } : {}),
    });
    await platform.pledge(backer2.id, c.id, { amountCents: (i + 1) * 2_500_00, paymentToken: 'tok_visa' });
  }
  store.save();
}

export const DEMO_ACCOUNTS = ['admin@example.com', 'creator@example.com', 'backer@example.com'];
export { DEMO_PASSWORD };
