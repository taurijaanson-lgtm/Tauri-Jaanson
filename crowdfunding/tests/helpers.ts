import { FakePaymentProvider } from '../src/payments.js';
import { Platform, type CampaignInput } from '../src/service.js';
import { Store } from '../src/store.js';

export const DAY = 86_400_000;

export function setup(start = new Date('2026-03-01T12:00:00Z')) {
  let now = start;
  const store = new Store();
  const payments = new FakePaymentProvider();
  const platform = new Platform(store, payments, { now: () => now });
  const clock = {
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    now: () => now,
  };

  const admin = platform.register({ email: 'admin@test.dev', name: 'Admin', password: 'password1' }).user;
  admin.isAdmin = true;
  const creator = platform.register({ email: 'creator@test.dev', name: 'Creator', password: 'password1' }).user;
  const backer = platform.register({ email: 'backer@test.dev', name: 'Backer', password: 'password1' }).user;
  const backer2 = platform.register({ email: 'backer2@test.dev', name: 'Backer Two', password: 'password1' }).user;

  async function readyCreator() {
    platform.updateCreatorProfile(creator.id, { legalName: 'Creator Person', dateOfBirth: '1990-01-01', state: 'CA' });
    await platform.connectPayoutAccount(creator.id);
    platform.verifyIdentity(admin.id, creator.id);
  }

  async function liveCampaign(overrides: CampaignInput = {}) {
    await readyCreator();
    const c = platform.createCampaign(creator.id, { ...validCampaign(), ...overrides });
    platform.submitForReview(creator.id, c.id);
    platform.review(admin.id, c.id, { approve: true });
    return platform.launch(creator.id, c.id);
  }

  return { platform, store, payments, clock, admin, creator, backer, backer2, readyCreator, liveCampaign };
}

export function validCampaign(): CampaignInput {
  return {
    title: 'Riverbend Record Pressing',
    blurb: 'Pressing the debut LP from a Memphis blues trio on 180g vinyl.',
    story:
      'We recorded twelve songs live to tape at a studio on Beale Street. Your pledge covers mastering, ' +
      'lacquers and a first pressing of 500 records, plus jackets printed in Tennessee.',
    category: 'music',
    goalCents: 1_000_00,
    fundingModel: 'all_or_nothing',
    durationDays: 30,
    city: 'Memphis',
    state: 'TN',
    rewards: [
      {
        title: 'Digital album',
        description: 'Lossless download.',
        minimumCents: 10_00,
        estimatedDelivery: '2026-06',
        shipping: 'none',
        shippingCents: 0,
      },
      {
        title: 'Vinyl LP',
        description: 'Signed 180g LP.',
        minimumCents: 35_00,
        quantityLimit: 2,
        estimatedDelivery: '2026-08',
        shipping: 'us_only',
        shippingCents: 7_00,
      },
    ],
  };
}

export const ADDRESS = { name: 'Pat Doe', line1: '1 Elm St', city: 'Boise', state: 'ID', zip: '83702' };
