import { randomUUID } from 'node:crypto';
import { hashPassword, newToken, verifyPassword } from './auth.js';
import {
  LIMITS,
  creatorLaunchBlockers,
  isEin,
  pledgeAmountIssue,
  validateAddress,
  validateCampaign,
  validateCreatorProfile,
  type Issue,
} from './compliance.js';
import { DEFAULT_FEES, isValidCents, payoutBreakdown, type Cents, type FeeSchedule } from './money.js';
import type { PaymentProvider } from './payments.js';
import type { Store } from './store.js';
import {
  CATEGORIES,
  type Address,
  type Campaign,
  type Category,
  type CreatorProfile,
  type FundingModel,
  type Pledge,
  type RewardTier,
  type User,
} from './types.js';

export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: Issue[] = [],
  ) {
    super(message);
  }
}

const notFound = (what: string) => new AppError(404, `${what} not found.`);
const forbidden = () => new AppError(403, 'You do not have access to that.');
const DAY_MS = 86_400_000;

export interface CampaignInput {
  title?: string;
  blurb?: string;
  story?: string;
  category?: Category;
  goalCents?: Cents;
  fundingModel?: FundingModel;
  durationDays?: number;
  city?: string;
  state?: string;
  imageUrl?: string;
  nonprofitEin?: string | null;
  rewards?: Omit<RewardTier, 'id'>[];
}

export interface PledgeInput {
  amountCents: Cents;
  rewardId?: string;
  paymentToken: string;
  shippingAddress?: Address;
  anonymous?: boolean;
}

export interface CampaignStats {
  /** Pledged toward the goal (excludes shipping). Counts saved-card pledges for all-or-nothing. */
  pledgedCents: Cents;
  backers: number;
  percentFunded: number;
  secondsLeft: number | null;
}

export interface PublicCampaign extends Omit<Campaign, 'payout' | 'reviewNotes'> {
  creatorName: string;
  stats: CampaignStats;
  rewards: (RewardTier & { claimed: number; remaining: number | null })[];
  taxDeductible: boolean;
}

export interface PlatformOptions {
  fees?: FeeSchedule;
  now?: () => Date;
}

const ACTIVE_PLEDGE = new Set<Pledge['status']>(['pending', 'collected']);
const PUBLIC_STATUSES = new Set<Campaign['status']>(['live', 'successful', 'unsuccessful']);

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .slice(0, 60)
      .replace(/-+$/, '') || 'campaign'
  );
}

export class Platform {
  readonly fees: FeeSchedule;
  private readonly now: () => Date;
  private readonly settling = new Set<string>();

  constructor(
    readonly store: Store,
    readonly payments: PaymentProvider,
    opts: PlatformOptions = {},
  ) {
    this.fees = opts.fees ?? DEFAULT_FEES;
    this.now = opts.now ?? (() => new Date());
  }

  // ---------------------------------------------------------------- accounts

  register(input: { email?: string; name?: string; password?: string }): { user: User; token: string } {
    const email = input.email?.trim().toLowerCase() ?? '';
    const name = input.name?.trim() ?? '';
    const issues: Issue[] = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push({ field: 'email', message: 'Enter a valid email.' });
    if (name.length < 2) issues.push({ field: 'name', message: 'Enter your name.' });
    if ((input.password?.length ?? 0) < 8) issues.push({ field: 'password', message: 'Use at least 8 characters.' });
    if (issues.length) throw new AppError(400, 'Please fix the highlighted fields.', issues);
    if (this.store.userByEmail(email)) throw new AppError(409, 'An account with that email already exists.');
    const user: User = {
      id: randomUUID(),
      email,
      name,
      passwordHash: hashPassword(input.password!),
      isAdmin: false,
      createdAt: this.now().toISOString(),
    };
    this.store.users.set(user.id, user);
    return { user, token: this.startSession(user.id) };
  }

  login(email: string, password: string): { user: User; token: string } {
    const user = this.store.userByEmail(email ?? '');
    if (!user || !verifyPassword(password ?? '', user.passwordHash)) {
      throw new AppError(401, 'Email or password is incorrect.');
    }
    return { user, token: this.startSession(user.id) };
  }

  logout(token: string): void {
    this.store.sessions.delete(token);
  }

  private startSession(userId: string): string {
    const token = newToken();
    this.store.sessions.set(token, userId);
    this.store.save();
    return token;
  }

  userForToken(token: string | undefined): User | undefined {
    const id = token ? this.store.sessions.get(token) : undefined;
    return id ? this.store.users.get(id) : undefined;
  }

  private user(id: string): User {
    const u = this.store.users.get(id);
    if (!u) throw notFound('User');
    return u;
  }

  private admin(id: string): User {
    const u = this.user(id);
    if (!u.isAdmin) throw forbidden();
    return u;
  }

  updateCreatorProfile(
    userId: string,
    input: Partial<Pick<CreatorProfile, 'legalName' | 'dateOfBirth' | 'state'>>,
  ): CreatorProfile {
    const user = this.user(userId);
    const issues = validateCreatorProfile(input, this.now());
    if (issues.length) throw new AppError(400, 'Please fix the highlighted fields.', issues);
    const prior = user.creator;
    const identityChanged =
      !prior || prior.legalName !== input.legalName || prior.dateOfBirth !== input.dateOfBirth;
    user.creator = {
      legalName: input.legalName!.trim(),
      dateOfBirth: input.dateOfBirth!,
      state: input.state!,
      // Changing identity details re-triggers verification.
      identityVerified: identityChanged ? false : prior.identityVerified,
      ...(prior?.payoutAccountRef ? { payoutAccountRef: prior.payoutAccountRef } : {}),
    };
    this.store.save();
    return user.creator;
  }

  async connectPayoutAccount(userId: string): Promise<CreatorProfile> {
    const user = this.user(userId);
    if (!user.creator) throw new AppError(400, 'Complete your creator profile first.');
    if (!user.creator.payoutAccountRef) {
      const { accountRef } = await this.payments.createPayoutAccount(user.id);
      user.creator.payoutAccountRef = accountRef;
      this.store.save();
    }
    return user.creator;
  }

  /** Stand-in for a KYC vendor webhook (Stripe Identity, Persona, etc.). */
  verifyIdentity(adminId: string, userId: string): CreatorProfile {
    this.admin(adminId);
    const user = this.user(userId);
    if (!user.creator) throw new AppError(400, 'User has no creator profile.');
    user.creator.identityVerified = true;
    this.store.save();
    return user.creator;
  }

  // --------------------------------------------------------------- campaigns

  private campaign(id: string): Campaign {
    const c = this.store.campaigns.get(id);
    if (!c) throw notFound('Campaign');
    return c;
  }

  private ownedCampaign(userId: string, id: string): Campaign {
    const c = this.campaign(id);
    if (c.creatorId !== userId) throw forbidden();
    return c;
  }

  private uniqueSlug(title: string, exceptId?: string): string {
    const base = slugify(title);
    let slug = base;
    for (let n = 2; ; n++) {
      const taken = this.store.campaignBySlug(slug);
      if (!taken || taken.id === exceptId) return slug;
      slug = `${base}-${n}`;
    }
  }

  createCampaign(userId: string, input: CampaignInput): Campaign {
    this.user(userId);
    const title = input.title?.trim() || 'Untitled campaign';
    const campaign: Campaign = {
      id: randomUUID(),
      slug: this.uniqueSlug(title),
      creatorId: userId,
      title,
      blurb: '',
      story: '',
      category: 'technology',
      goalCents: 10_000_00,
      fundingModel: 'all_or_nothing',
      durationDays: 30,
      city: '',
      state: this.user(userId).creator?.state ?? '',
      rewards: [],
      status: 'draft',
      createdAt: this.now().toISOString(),
    };
    this.store.campaigns.set(campaign.id, campaign);
    return this.updateCampaign(userId, campaign.id, input);
  }

  updateCampaign(userId: string, id: string, input: CampaignInput): Campaign {
    const c = this.ownedCampaign(userId, id);
    if (c.status !== 'draft' && c.status !== 'rejected') {
      throw new AppError(409, 'Only drafts can be edited. Post an update to backers instead.');
    }
    const issues: Issue[] = [];
    if (input.title !== undefined) {
      c.title = input.title.trim();
      c.slug = this.uniqueSlug(c.title, c.id);
    }
    if (input.blurb !== undefined) c.blurb = input.blurb.trim();
    if (input.story !== undefined) c.story = input.story.trim();
    if (input.category !== undefined) {
      if (!CATEGORIES.includes(input.category)) issues.push({ field: 'category', message: 'Unknown category.' });
      else c.category = input.category;
    }
    if (input.goalCents !== undefined) {
      if (!isValidCents(input.goalCents)) issues.push({ field: 'goalCents', message: 'Goal is invalid.' });
      else c.goalCents = input.goalCents;
    }
    if (input.fundingModel !== undefined) {
      if (input.fundingModel !== 'all_or_nothing' && input.fundingModel !== 'keep_it_all') {
        issues.push({ field: 'fundingModel', message: 'Unknown funding model.' });
      } else c.fundingModel = input.fundingModel;
    }
    if (input.durationDays !== undefined) c.durationDays = Number(input.durationDays);
    if (input.city !== undefined) c.city = input.city.trim();
    if (input.state !== undefined) c.state = input.state;
    if (input.imageUrl !== undefined) {
      if (input.imageUrl && !/^https:\/\//.test(input.imageUrl)) {
        issues.push({ field: 'imageUrl', message: 'Image must be an https:// URL.' });
      } else if (input.imageUrl) c.imageUrl = input.imageUrl;
      else delete c.imageUrl;
    }
    if (input.nonprofitEin !== undefined) {
      if (input.nonprofitEin === null || input.nonprofitEin === '') delete c.nonprofit;
      else if (!isEin(input.nonprofitEin)) issues.push({ field: 'nonprofitEin', message: 'EIN must look like 12-3456789.' });
      else if (c.nonprofit?.ein !== input.nonprofitEin) c.nonprofit = { ein: input.nonprofitEin, verified: false };
    }
    if (input.rewards !== undefined) {
      if (!Array.isArray(input.rewards)) issues.push({ field: 'rewards', message: 'Rewards must be a list.' });
      else {
        const prior = new Map(c.rewards.map((r) => [r.title, r.id]));
        c.rewards = input.rewards.map((r) => ({
          id: prior.get(r.title) ?? randomUUID(),
          title: String(r.title ?? '').trim(),
          description: String(r.description ?? '').trim(),
          minimumCents: r.minimumCents,
          ...(r.quantityLimit != null ? { quantityLimit: Number(r.quantityLimit) } : {}),
          estimatedDelivery: r.estimatedDelivery,
          shipping: r.shipping ?? 'none',
          shippingCents: r.shipping === 'none' || r.shipping === undefined ? 0 : r.shippingCents ?? 0,
        }));
      }
    }
    if (issues.length) throw new AppError(400, 'Please fix the highlighted fields.', issues);
    this.store.save();
    return c;
  }

  submitForReview(userId: string, id: string): Campaign {
    const c = this.ownedCampaign(userId, id);
    if (c.status !== 'draft' && c.status !== 'rejected') throw new AppError(409, 'Campaign was already submitted.');
    const issues = validateCampaign(c, this.now());
    if (issues.length) throw new AppError(400, 'This campaign is not ready to submit.', issues);
    c.status = 'in_review';
    delete c.reviewNotes;
    this.store.save();
    return c;
  }

  reviewQueue(adminId: string): Campaign[] {
    this.admin(adminId);
    return [...this.store.campaigns.values()].filter((c) => c.status === 'in_review');
  }

  review(adminId: string, id: string, decision: { approve: boolean; notes?: string; nonprofitVerified?: boolean }) {
    this.admin(adminId);
    const c = this.campaign(id);
    if (c.status !== 'in_review') throw new AppError(409, 'Campaign is not awaiting review.');
    if (decision.approve) {
      // Re-run checks: rules may have changed since submission.
      const issues = validateCampaign(c, this.now());
      if (issues.length) throw new AppError(400, 'Campaign fails policy checks.', issues);
      if (c.nonprofit) c.nonprofit.verified = decision.nonprofitVerified === true;
    }
    c.status = decision.approve ? 'approved' : 'rejected';
    if (decision.notes) c.reviewNotes = decision.notes;
    this.store.save();
    return c;
  }

  launch(userId: string, id: string): Campaign {
    const c = this.ownedCampaign(userId, id);
    if (c.status !== 'approved') throw new AppError(409, 'Campaign must be approved before launch.');
    const blockers = creatorLaunchBlockers(this.user(userId).creator);
    if (blockers.length) {
      throw new AppError(409, 'Finish setting up your account to launch.', blockers.map((m) => ({ field: 'creator', message: m })));
    }
    const now = this.now();
    c.status = 'live';
    c.launchedAt = now.toISOString();
    c.deadline = new Date(now.getTime() + c.durationDays * DAY_MS).toISOString();
    this.store.save();
    return c;
  }

  async cancelCampaign(userId: string, id: string): Promise<Campaign> {
    const c = this.campaign(id);
    const user = this.user(userId);
    if (c.creatorId !== userId && !user.isAdmin) throw forbidden();
    if (c.status === 'live') {
      for (const p of this.store.pledgesFor(c.id)) await this.voidOrRefund(p);
    } else if (!['draft', 'in_review', 'approved', 'rejected'].includes(c.status)) {
      throw new AppError(409, 'This campaign has already ended.');
    }
    c.status = 'cancelled';
    c.endedAt = this.now().toISOString();
    this.store.save();
    return c;
  }

  private async voidOrRefund(p: Pledge): Promise<void> {
    if (p.status === 'pending') p.status = 'cancelled';
    else if (p.status === 'collected' && p.chargeRef) {
      await this.payments.refund(p.chargeRef, p.amountCents);
      p.status = 'refunded';
    } else return;
    p.updatedAt = this.now().toISOString();
  }

  // ------------------------------------------------------------ public views

  stats(c: Campaign): CampaignStats {
    const active = this.store.pledgesFor(c.id).filter((p) => ACTIVE_PLEDGE.has(p.status));
    const pledgedCents = active.reduce((s, p) => s + p.amountCents - p.shippingCents, 0);
    const secondsLeft =
      c.status === 'live' && c.deadline
        ? Math.max(0, Math.floor((Date.parse(c.deadline) - this.now().getTime()) / 1000))
        : null;
    return {
      pledgedCents,
      backers: new Set(active.map((p) => p.backerId)).size,
      percentFunded: c.goalCents ? Math.floor((pledgedCents / c.goalCents) * 100) : 0,
      secondsLeft,
    };
  }

  private claimed(c: Campaign, rewardId: string): number {
    return this.store.pledgesFor(c.id).filter((p) => p.rewardId === rewardId && ACTIVE_PLEDGE.has(p.status)).length;
  }

  toPublic(c: Campaign): PublicCampaign {
    const { payout: _payout, reviewNotes: _notes, ...rest } = c;
    return {
      ...rest,
      creatorName: this.store.users.get(c.creatorId)?.name ?? 'Unknown creator',
      stats: this.stats(c),
      taxDeductible: c.nonprofit?.verified === true,
      rewards: c.rewards.map((r) => {
        const claimed = this.claimed(c, r.id);
        return { ...r, claimed, remaining: r.quantityLimit === undefined ? null : Math.max(0, r.quantityLimit - claimed) };
      }),
    };
  }

  listPublic(filter: { category?: string; state?: string; q?: string; sort?: string } = {}): PublicCampaign[] {
    const q = filter.q?.trim().toLowerCase();
    const list = [...this.store.campaigns.values()]
      .filter((c) => PUBLIC_STATUSES.has(c.status))
      .filter((c) => !filter.category || c.category === filter.category)
      .filter((c) => !filter.state || c.state === filter.state)
      .filter((c) => !q || `${c.title} ${c.blurb} ${c.city}`.toLowerCase().includes(q))
      .map((c) => this.toPublic(c));
    const live = (c: PublicCampaign) => (c.status === 'live' ? 0 : 1);
    const sorters: Record<string, (a: PublicCampaign, b: PublicCampaign) => number> = {
      ending: (a, b) => live(a) - live(b) || (a.stats.secondsLeft ?? Infinity) - (b.stats.secondsLeft ?? Infinity),
      funded: (a, b) => live(a) - live(b) || b.stats.percentFunded - a.stats.percentFunded,
      newest: (a, b) => live(a) - live(b) || (b.launchedAt ?? '').localeCompare(a.launchedAt ?? ''),
    };
    return list.sort(sorters[filter.sort ?? 'newest'] ?? sorters.newest);
  }

  /** Public lookup; drafts are only visible to their creator and admins. */
  getCampaign(slugOrId: string, viewerId?: string): PublicCampaign & { reviewNotes?: string } {
    const c = this.store.campaignBySlug(slugOrId) ?? this.store.campaigns.get(slugOrId);
    if (!c) throw notFound('Campaign');
    const viewer = viewerId ? this.store.users.get(viewerId) : undefined;
    const privileged = viewer && (viewer.id === c.creatorId || viewer.isAdmin);
    if (!PUBLIC_STATUSES.has(c.status) && !privileged) throw notFound('Campaign');
    return { ...this.toPublic(c), ...(privileged && c.reviewNotes ? { reviewNotes: c.reviewNotes } : {}) };
  }

  myCampaigns(userId: string): PublicCampaign[] {
    return [...this.store.campaigns.values()].filter((c) => c.creatorId === userId).map((c) => this.toPublic(c));
  }

  // ----------------------------------------------------------------- pledges

  async pledge(backerId: string, campaignId: string, input: PledgeInput): Promise<Pledge> {
    this.user(backerId);
    const c = this.campaign(campaignId);
    if (c.status !== 'live' || !c.deadline || Date.parse(c.deadline) <= this.now().getTime()) {
      throw new AppError(409, 'This campaign is not accepting pledges.');
    }
    if (c.creatorId === backerId) throw new AppError(409, 'You cannot back your own campaign.');

    let reward: RewardTier | undefined;
    if (input.rewardId) {
      reward = c.rewards.find((r) => r.id === input.rewardId);
      if (!reward) throw notFound('Reward');
      if (reward.quantityLimit !== undefined && this.claimed(c, reward.id) >= reward.quantityLimit) {
        throw new AppError(409, 'That reward is sold out.');
      }
    }
    const shippingCents = reward?.shippingCents ?? 0;
    const amountIssue = pledgeAmountIssue(input.amountCents, (reward?.minimumCents ?? 0) + shippingCents);
    if (amountIssue) throw new AppError(400, amountIssue, [{ field: 'amountCents', message: amountIssue }]);
    const addressIssues = validateAddress(input.shippingAddress, reward?.shipping ?? 'none');
    if (addressIssues.length) throw new AppError(400, 'Check your shipping address.', addressIssues);

    let paymentMethodRef: string;
    try {
      ({ paymentMethodRef } = await this.payments.savePaymentMethod(backerId, String(input.paymentToken ?? '')));
    } catch (err) {
      throw new AppError(402, (err as Error).message || 'Card was rejected.');
    }

    const now = this.now().toISOString();
    const pledge: Pledge = {
      id: randomUUID(),
      campaignId: c.id,
      backerId,
      ...(reward ? { rewardId: reward.id } : {}),
      amountCents: input.amountCents,
      shippingCents,
      ...(reward && reward.shipping !== 'none' && input.shippingAddress
        ? { shippingAddress: { ...input.shippingAddress, country: (input.shippingAddress.country ?? 'US').toUpperCase() } }
        : {}),
      anonymous: input.anonymous === true,
      status: 'pending',
      paymentMethodRef,
      createdAt: now,
      updatedAt: now,
    };

    if (c.fundingModel === 'keep_it_all') {
      const result = await this.payments.charge(paymentMethodRef, pledge.amountCents, `pledge:${pledge.id}`);
      if (!result.ok) throw new AppError(402, result.reason);
      pledge.status = 'collected';
      pledge.chargeRef = result.chargeRef;
    }
    this.store.pledges.set(pledge.id, pledge);
    this.store.save();
    return pledge;
  }

  async cancelPledge(backerId: string, pledgeId: string): Promise<Pledge> {
    const p = this.store.pledges.get(pledgeId);
    if (!p) throw notFound('Pledge');
    if (p.backerId !== backerId) throw forbidden();
    const c = this.campaign(p.campaignId);
    if (c.status !== 'live') throw new AppError(409, 'This campaign has ended; contact the creator.');
    if (p.status !== 'pending') {
      throw new AppError(409, 'Collected pledges are refunded at the creator’s discretion.');
    }
    await this.voidOrRefund(p);
    this.store.save();
    return p;
  }

  myPledges(backerId: string) {
    return [...this.store.pledges.values()]
      .filter((p) => p.backerId === backerId)
      .map((p) => {
        const c = this.store.campaigns.get(p.campaignId);
        return { ...p, campaign: c ? { title: c.title, slug: c.slug, status: c.status } : null };
      });
  }

  /** Creator's backer report; addresses are shared only for rewards that ship. */
  campaignPledges(userId: string, campaignId: string) {
    const c = this.campaign(campaignId);
    const viewer = this.user(userId);
    if (c.creatorId !== userId && !viewer.isAdmin) throw forbidden();
    return this.store.pledgesFor(c.id).map((p) => {
      const backer = this.store.users.get(p.backerId);
      const { paymentMethodRef: _pm, chargeRef: _ch, ...rest } = p;
      return { ...rest, backerName: backer?.name ?? '', backerEmail: backer?.email ?? '' };
    });
  }

  // -------------------------------------------------------------- settlement

  /** Closes every live campaign whose deadline has passed. Safe to call repeatedly. */
  async settleDueCampaigns(): Promise<Campaign[]> {
    const now = this.now().getTime();
    const due = [...this.store.campaigns.values()].filter(
      (c) => c.status === 'live' && c.deadline && Date.parse(c.deadline) <= now,
    );
    const settled: Campaign[] = [];
    for (const c of due) {
      if (this.settling.has(c.id)) continue;
      this.settling.add(c.id);
      try {
        settled.push(await this.settle(c));
      } finally {
        this.settling.delete(c.id);
      }
    }
    return settled;
  }

  private async settle(c: Campaign): Promise<Campaign> {
    const pledges = this.store.pledgesFor(c.id);
    const { pledgedCents } = this.stats(c);
    const stamp = () => this.now().toISOString();

    if (c.fundingModel === 'all_or_nothing') {
      if (pledgedCents >= c.goalCents) {
        for (const p of pledges.filter((x) => x.status === 'pending')) {
          // Idempotency key makes a retry after a crash safe.
          const result = await this.payments.charge(p.paymentMethodRef, p.amountCents, `pledge:${p.id}`);
          if (result.ok) {
            p.status = 'collected';
            p.chargeRef = result.chargeRef;
          } else {
            p.status = 'failed';
            p.failureReason = result.reason;
          }
          p.updatedAt = stamp();
          this.store.save();
        }
        c.status = 'successful';
      } else {
        for (const p of pledges) await this.voidOrRefund(p);
        c.status = 'unsuccessful';
      }
    } else {
      c.status = pledges.some((p) => p.status === 'collected') ? 'successful' : 'unsuccessful';
    }

    const collected = pledges.filter((p) => p.status === 'collected').map((p) => p.amountCents);
    if (collected.length) {
      const breakdown = payoutBreakdown(collected, this.fees);
      const account = this.store.users.get(c.creatorId)?.creator?.payoutAccountRef;
      if (account && breakdown.net > 0) {
        const { payoutRef } = await this.payments.payout(account, breakdown.net, `campaign:${c.id}`);
        const { charges: _n, ...money } = breakdown;
        c.payout = { ...money, payoutRef, paidAt: stamp() };
      }
    }
    c.endedAt = stamp();
    this.store.save();
    return c;
  }

  meta() {
    return { categories: CATEGORIES, fees: this.fees, limits: LIMITS };
  }
}
