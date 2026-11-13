import { FakePaymentProvider } from './payments.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo } from './seed.js';
import { createApp } from './server.js';
import { Platform } from './service.js';
import { Store } from './store.js';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const port = Number(process.env.PORT ?? 5180);
const host = process.env.HOST ?? '127.0.0.1';
// Demo mode keeps everything in memory so each run starts clean.
const dataFile = demo ? undefined : (process.env.DATA_FILE ?? '.data/crowdfunding.json');

const store = new Store(dataFile);
const platform = new Platform(store, new FakePaymentProvider());
if (demo) await seedDemo(platform);

// Close campaigns whose deadline has passed.
const SETTLE_EVERY_MS = 60_000;
setInterval(() => {
  platform.settleDueCampaigns().catch((err) => console.error('settlement failed', err));
}, SETTLE_EVERY_MS).unref();

createApp(platform).listen(port, host, () => {
  console.log(`Crowdfunding platform on http://${host}:${port}`);
  if (demo) console.log(`Demo accounts: ${DEMO_ACCOUNTS.join(', ')} (password: ${DEMO_PASSWORD})`);
  console.log('Payments: fake provider (test cards tok_visa, tok_chargeDeclined).');
});
