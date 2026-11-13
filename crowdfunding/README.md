# Backyard — crowdfunding for the US market

A reward- and donation-based crowdfunding platform (the Kickstarter / GoFundMe model) built
for US creators and backers. "Backyard" is a working name.

```bash
cd crowdfunding
npm install
npm run dev        # http://127.0.0.1:5180 with demo data, in memory
npm start          # persistent, data in .data/crowdfunding.json
npm test
npm run typecheck
```

Demo accounts (password `demo1234`): `admin@example.com`, `creator@example.com`,
`backer@example.com`. Payments use a fake provider: card `tok_visa` succeeds,
`tok_chargeDeclined` saves but declines when charged.

Node 20+, no runtime dependencies.

## What works today

**Backers** browse and filter projects (category, state, keyword; sort by newest, ending
soon, most funded), pledge with or without a reward, enter a shipping address when the reward
ships, back anonymously, and cancel a pending pledge while the campaign is live.

**Creators** build a draft with reward tiers (minimum, quantity limit, estimated delivery,
shipping policy and cost), submit it for review, complete a creator profile, connect a payout
account, launch once approved, see their backer list with shipping addresses, and cancel.

**Admins** work a review queue (approve or request changes with notes), verify nonprofit
EINs, verify creator identity, and can trigger settlement manually.

**Settlement** runs every minute and closes campaigns whose deadline has passed:

| Model | During the campaign | At the deadline, goal met | Goal missed |
| --- | --- | --- | --- |
| All-or-nothing | Card saved, not charged | Every pledge charged, creator paid out | Saved cards released, nobody charged |
| Keep what you raise | Charged at pledge time | Creator paid out | Creator still paid out |

Charges and payouts carry idempotency keys, so re-running settlement after a crash never
double-charges or double-pays. Declined charges are marked `failed` and excluded from the
payout.

**Fees**: 5% platform fee plus 2.9% + 30¢ card processing per charge, configurable in
`FeeSchedule` (`src/money.ts`). All money is integer cents.

## US-specific rules built in

These are product guardrails, not legal advice. Get a US fintech lawyer to review them before launch.

- **No securities.** Offering equity, revenue share, profit share, dividends or tokens is a
  securities offering. In the US that requires an SEC-registered Regulation Crowdfunding
  funding portal (FINRA member) or a broker-dealer. Campaign text is screened for investment
  language at submission and at approval (`src/compliance.ts`). The site footer says backing
  is not an investment.
- **Creators** must be 18+, live in a US state, DC or territory, pass identity verification
  (KYC) and connect a US bank account before launching.
- **Campaigns** must be based in the US, run 1–60 days, and have goals between $100 and $10M.
- **Prohibited content**: weapons, cannabis, raffles and gambling (state-regulated, and a
  raffle needs nonprofit licensing in most states), tobacco and vaping, unsubstantiated medical
  claims.
- **Nonprofits**: a campaign can list an EIN. It is shown as tax-deductible only after an admin
  verifies it as a 501(c)(3) (against the IRS Tax Exempt Organization Search).
- **Shipping**: US addresses need a valid state and ZIP. "US only" rewards refuse foreign addresses.
- **Pledge cap**: $10,000 per pledge; larger amounts go through support (fraud and AML control).

## Layout

```
src/
  money.ts        cents, USD formatting, fee and payout math
  usStates.ts     USPS state/territory codes, ZIP validation
  types.ts        domain model: User, Campaign, RewardTier, Pledge
  compliance.ts   US policy checks (eligibility, content, addresses, limits)
  payments.ts     PaymentProvider interface + FakePaymentProvider
  store.ts        in-memory store with atomic JSON-file persistence
  service.ts      Platform: accounts, campaigns, review, pledges, settlement
  server.ts       JSON HTTP API (node:http)
  seed.ts         demo data
  main.ts         entry point and settlement timer
  web/index.html  single-page front end (vanilla JS)
tests/            vitest: money, compliance, lifecycle/settlement, HTTP API
```

### API

Authenticated routes take `Authorization: Bearer <token>` from register or login. Errors
return `{ error, issues: [{ field, message }] }`.

| Method | Path | |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Accounts |
| GET | `/api/me`, `/api/me/campaigns`, `/api/me/pledges` | Current user |
| PUT | `/api/me/creator-profile` | Legal name, DOB, state |
| POST | `/api/me/payout-account` | Connect payout account |
| GET | `/api/campaigns?category=&state=&q=&sort=` | Public list |
| GET | `/api/campaigns/:slugOrId` | Detail (drafts visible to owner/admin) |
| POST / PATCH | `/api/campaigns`, `/api/campaigns/:id` | Create / edit draft |
| POST | `/api/campaigns/:id/submit` \| `launch` \| `cancel` | Lifecycle |
| POST | `/api/campaigns/:id/pledges` | Pledge `{ amountCents, rewardId?, paymentToken, shippingAddress?, anonymous? }` |
| GET | `/api/campaigns/:id/pledges` | Backer report (creator/admin) |
| DELETE | `/api/pledges/:id` | Cancel a pending pledge |
| GET | `/api/admin/review-queue` | Admin |
| POST | `/api/admin/campaigns/:id/review` | `{ approve, notes?, nonprofitVerified? }` |
| POST | `/api/admin/users/:id/verify`, `/api/admin/settle` | Admin |
| GET | `/api/meta` | Categories, states, fees, limits |

## Before real money moves

In rough priority order:

1. **Stripe Connect** behind `PaymentProvider`. Use SetupIntents for all-or-nothing pledges:
   card authorizations expire after about 7 days, so authorize-then-capture can't span a 30–60
   day campaign. Express accounts handle creator KYC, bank onboarding and Form 1099-K filing.
   Add Stripe Tax if rewards are taxable goods (marketplace-facilitator sales-tax rules apply
   in most states).
2. **Postgres** in place of `Store`, with row locks around reward quantity checks and settlement.
3. **Failed-charge recovery**: email backers whose card declined at settlement and give them a
   few days to update it before the payout.
4. **Auth hardening**: session expiry, email verification, password reset, rate limiting, CSRF
   protection if moving to cookies, 2FA for creators and admins.
5. **Legal**: terms of use, privacy policy (CCPA/CPRA for California users), refund policy,
   state charitable-solicitation registration if the platform solicits for charities, and
   money-transmitter analysis (holding funds through Stripe Connect is the usual way around
   needing state licenses).
6. **Product**: image uploads, creator updates and comments, email receipts and donation
   receipts for 501(c)(3)s, reward surveys, refunds from the creator dashboard, search indexing.
7. **Accessibility** (WCAG 2.1 AA) and analytics.

A Regulation Crowdfunding (equity) product would be a separate, registered business line, not
a feature of this one.
