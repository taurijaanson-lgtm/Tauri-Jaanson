/**
 * US-market policy checks. These are product rules, not legal advice: they encode the
 * guardrails a reward/donation platform needs so it does not drift into regulated territory
 * (securities offerings, prohibited goods, unverified tax-deductibility claims).
 */
import { isValidCents, type Cents } from './money.js';
import { isUsState, isZipCode } from './usStates.js';
import type { Address, Campaign, CreatorProfile, RewardTier, ShippingPolicy } from './types.js';
import { CATEGORIES } from './types.js';

export const LIMITS = {
  minGoalCents: 100_00,
  maxGoalCents: 10_000_000_00,
  minDurationDays: 1,
  maxDurationDays: 60,
  minPledgeCents: 1_00,
  /** Per-pledge cap; larger amounts go through manual review. */
  maxPledgeCents: 10_000_00,
  minCreatorAge: 18,
  maxRewardTiers: 20,
} as const;

export interface Issue {
  field: string;
  message: string;
}

/**
 * Selling a share of profits, revenue or equity is a securities offering. In the US that
 * needs a registered funding portal or broker-dealer (Regulation Crowdfunding), which this
 * platform is not. Campaigns that read like investment offers are blocked at review.
 */
const SECURITIES_PATTERNS: RegExp[] = [
  /\bequity\b/i,
  /\bshares? (of|in) (the )?(company|business|startup)\b/i,
  /\brevenue[- ]shar(e|ing)\b/i,
  /\bprofit[- ]shar(e|ing)\b/i,
  /\breturn on (your )?investment\b/i,
  /\bdividends?\b/i,
  /\binvestors?\b/i,
  /\b(token|coin) (sale|offering)\b|\bICO\b/i,
];

const PROHIBITED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(firearms?|guns?|ammunition|ammo)\b/i, reason: 'weapons and ammunition' },
  { pattern: /\b(cannabis|marijuana|THC|CBD)\b/i, reason: 'cannabis products' },
  { pattern: /\b(lottery|raffle|sweepstakes|gambling)\b/i, reason: 'raffles, lotteries and gambling' },
  { pattern: /\b(cures?|treats?) (cancer|diabetes|covid|autism)\b/i, reason: 'unsubstantiated medical claims' },
  { pattern: /\b(e-?cigarettes?|vapes?|tobacco)\b/i, reason: 'tobacco and vaping products' },
];

export function ageOn(dateOfBirth: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dob = new Date(Date.UTC(y, mo - 1, d));
  if (dob.getUTCMonth() !== mo - 1 || dob.getUTCDate() !== d) return null;
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() < mo - 1 || (today.getUTCMonth() === mo - 1 && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function validateCreatorProfile(p: Partial<CreatorProfile>, today: Date): Issue[] {
  const issues: Issue[] = [];
  if (!p.legalName || p.legalName.trim().length < 2) {
    issues.push({ field: 'legalName', message: 'Enter your full legal name.' });
  }
  const age = p.dateOfBirth ? ageOn(p.dateOfBirth, today) : null;
  if (age === null) {
    issues.push({ field: 'dateOfBirth', message: 'Enter a valid date of birth (YYYY-MM-DD).' });
  } else if (age < LIMITS.minCreatorAge) {
    issues.push({ field: 'dateOfBirth', message: `Creators must be at least ${LIMITS.minCreatorAge}.` });
  }
  if (!isUsState(p.state)) {
    issues.push({ field: 'state', message: 'Creators must reside in a US state, DC or territory.' });
  }
  return issues;
}

/** Everything that must be true before a creator may launch. */
export function creatorLaunchBlockers(p: CreatorProfile | undefined): string[] {
  if (!p) return ['Complete your creator profile.'];
  const out: string[] = [];
  if (!p.identityVerified) out.push('Identity verification is pending.');
  if (!p.payoutAccountRef) out.push('Connect a US bank account for payouts.');
  return out;
}

export function isEin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}-\d{7}$/.test(value);
}

const SHIPPING: ShippingPolicy[] = ['none', 'us_only', 'worldwide'];

export function validateReward(r: Partial<RewardTier>, index: number, deadline: Date | null): Issue[] {
  const at = (f: string) => `rewards[${index}].${f}`;
  const issues: Issue[] = [];
  if (!r.title?.trim()) issues.push({ field: at('title'), message: 'Reward needs a title.' });
  if (!isValidCents(r.minimumCents) || r.minimumCents < LIMITS.minPledgeCents) {
    issues.push({ field: at('minimumCents'), message: 'Reward minimum must be at least $1.' });
  }
  if (r.quantityLimit !== undefined && (!Number.isInteger(r.quantityLimit) || r.quantityLimit < 1)) {
    issues.push({ field: at('quantityLimit'), message: 'Quantity limit must be a positive whole number.' });
  }
  if (!r.shipping || !SHIPPING.includes(r.shipping)) {
    issues.push({ field: at('shipping'), message: 'Choose a shipping policy.' });
  }
  if (!isValidCents(r.shippingCents) || (r.shipping === 'none' && r.shippingCents !== 0)) {
    issues.push({ field: at('shippingCents'), message: 'Shipping cost is invalid.' });
  }
  if (!r.estimatedDelivery || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.estimatedDelivery)) {
    issues.push({ field: at('estimatedDelivery'), message: 'Estimated delivery must be YYYY-MM.' });
  } else if (deadline) {
    const deadlineMonth = deadline.toISOString().slice(0, 7);
    if (r.estimatedDelivery < deadlineMonth) {
      issues.push({ field: at('estimatedDelivery'), message: 'Delivery cannot be before the campaign ends.' });
    }
  }
  return issues;
}

/** Full checks run when a draft is submitted for review. */
export function validateCampaign(c: Campaign, now: Date): Issue[] {
  const issues: Issue[] = [];
  if (c.title.trim().length < 5 || c.title.length > 80) {
    issues.push({ field: 'title', message: 'Title must be 5–80 characters.' });
  }
  if (c.blurb.trim().length < 10 || c.blurb.length > 160) {
    issues.push({ field: 'blurb', message: 'Short description must be 10–160 characters.' });
  }
  if (c.story.trim().length < 50) {
    issues.push({ field: 'story', message: 'Tell backers more — at least 50 characters.' });
  }
  if (!CATEGORIES.includes(c.category)) issues.push({ field: 'category', message: 'Unknown category.' });
  if (!isValidCents(c.goalCents) || c.goalCents < LIMITS.minGoalCents || c.goalCents > LIMITS.maxGoalCents) {
    issues.push({ field: 'goalCents', message: 'Goal must be between $100 and $10,000,000.' });
  }
  if (
    !Number.isInteger(c.durationDays) ||
    c.durationDays < LIMITS.minDurationDays ||
    c.durationDays > LIMITS.maxDurationDays
  ) {
    issues.push({ field: 'durationDays', message: 'Campaigns run 1–60 days.' });
  }
  if (!c.city.trim()) issues.push({ field: 'city', message: 'Enter a city.' });
  if (!isUsState(c.state)) issues.push({ field: 'state', message: 'Campaign must be based in the US.' });
  if (c.nonprofit && !isEin(c.nonprofit.ein)) {
    issues.push({ field: 'nonprofit.ein', message: 'EIN must look like 12-3456789.' });
  }
  if (c.rewards.length > LIMITS.maxRewardTiers) {
    issues.push({ field: 'rewards', message: `At most ${LIMITS.maxRewardTiers} reward tiers.` });
  }
  const projectedDeadline = new Date(now.getTime() + c.durationDays * 86_400_000);
  c.rewards.forEach((r, i) => issues.push(...validateReward(r, i, projectedDeadline)));
  issues.push(...contentIssues(c));
  return issues;
}

export function contentIssues(c: Pick<Campaign, 'title' | 'blurb' | 'story' | 'rewards'>): Issue[] {
  const text = [c.title, c.blurb, c.story, ...c.rewards.flatMap((r) => [r.title, r.description])].join('\n');
  const issues: Issue[] = [];
  if (SECURITIES_PATTERNS.some((p) => p.test(text))) {
    issues.push({
      field: 'story',
      message:
        'This reads like an investment offer. Offering equity, profit or revenue shares requires an ' +
        'SEC-registered Regulation Crowdfunding portal; rewards here must be products, experiences or thanks.',
    });
  }
  for (const { pattern, reason } of PROHIBITED_PATTERNS) {
    if (pattern.test(text)) issues.push({ field: 'story', message: `Prohibited on this platform: ${reason}.` });
  }
  return issues;
}

export function validateAddress(a: Partial<Address> | undefined, policy: ShippingPolicy): Issue[] {
  if (policy === 'none') return [];
  if (!a) return [{ field: 'shippingAddress', message: 'A shipping address is required for this reward.' }];
  const issues: Issue[] = [];
  const country = (a.country ?? 'US').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) issues.push({ field: 'shippingAddress.country', message: 'Use a 2-letter country code.' });
  if (policy === 'us_only' && country !== 'US') {
    issues.push({ field: 'shippingAddress.country', message: 'This reward only ships within the US.' });
  }
  if (!a.name?.trim()) issues.push({ field: 'shippingAddress.name', message: 'Enter a recipient name.' });
  if (!a.line1?.trim()) issues.push({ field: 'shippingAddress.line1', message: 'Enter a street address.' });
  if (!a.city?.trim()) issues.push({ field: 'shippingAddress.city', message: 'Enter a city.' });
  if (country === 'US') {
    if (!isUsState(a.state)) issues.push({ field: 'shippingAddress.state', message: 'Enter a US state.' });
    if (!isZipCode(a.zip)) issues.push({ field: 'shippingAddress.zip', message: 'Enter a 5-digit ZIP code.' });
  } else if (!a.zip?.trim()) {
    issues.push({ field: 'shippingAddress.zip', message: 'Enter a postal code.' });
  }
  return issues;
}

export function pledgeAmountIssue(amount: Cents, minimum: Cents): string | null {
  if (!isValidCents(amount)) return 'Pledge amount is invalid.';
  if (amount < Math.max(minimum, LIMITS.minPledgeCents)) return 'Pledge is below the minimum for this reward.';
  if (amount > LIMITS.maxPledgeCents) return 'Pledges over $10,000 need to be arranged with support.';
  return null;
}
