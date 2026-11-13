import type { Cents } from './money.js';

export const CATEGORIES = [
  'art', 'comics', 'community', 'crafts', 'dance', 'design', 'education', 'fashion',
  'film', 'food', 'games', 'journalism', 'medical', 'music', 'nonprofit',
  'photography', 'publishing', 'technology', 'theater',
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * all_or_nothing: backers' cards are saved and only charged if the goal is met by the deadline.
 * keep_it_all: backers are charged immediately and the creator keeps whatever is raised.
 */
export type FundingModel = 'all_or_nothing' | 'keep_it_all';

export type CampaignStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'live'
  | 'successful'
  | 'unsuccessful'
  | 'cancelled';

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  /** USPS code for US addresses; region or province elsewhere. */
  state: string;
  zip: string;
  /** ISO 3166-1 alpha-2, defaults to US. */
  country?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: string;
  /** Required before a user can launch a campaign. */
  creator?: CreatorProfile;
}

export interface CreatorProfile {
  legalName: string;
  dateOfBirth: string; // YYYY-MM-DD
  state: string;
  /** Set once a KYC provider (or an admin, for now) has verified the creator's identity. */
  identityVerified: boolean;
  /** Reference to a connected payout account at the payment provider. */
  payoutAccountRef?: string;
}

export type ShippingPolicy = 'none' | 'us_only' | 'worldwide';

export interface RewardTier {
  id: string;
  title: string;
  description: string;
  minimumCents: Cents;
  /** Total available, or undefined for unlimited. */
  quantityLimit?: number;
  /** YYYY-MM */
  estimatedDelivery: string;
  shipping: ShippingPolicy;
  shippingCents: Cents;
}

export interface Nonprofit {
  ein: string; // NN-NNNNNNN
  /** True once the EIN has been checked against the IRS exempt-organization list. */
  verified: boolean;
}

export interface Campaign {
  id: string;
  slug: string;
  creatorId: string;
  title: string;
  blurb: string;
  story: string;
  category: Category;
  goalCents: Cents;
  fundingModel: FundingModel;
  durationDays: number;
  city: string;
  state: string;
  imageUrl?: string;
  nonprofit?: Nonprofit;
  rewards: RewardTier[];
  status: CampaignStatus;
  reviewNotes?: string;
  createdAt: string;
  launchedAt?: string;
  deadline?: string;
  endedAt?: string;
  payout?: {
    gross: Cents;
    platformFee: Cents;
    processingFees: Cents;
    net: Cents;
    payoutRef: string;
    paidAt: string;
  };
}

export type PledgeStatus =
  /** Card saved, waiting for an all-or-nothing campaign to end. */
  | 'pending'
  | 'collected'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface Pledge {
  id: string;
  campaignId: string;
  backerId: string;
  rewardId?: string;
  /** Total charged to the backer, including shipping. */
  amountCents: Cents;
  shippingCents: Cents;
  shippingAddress?: Address;
  anonymous: boolean;
  status: PledgeStatus;
  paymentMethodRef: string;
  chargeRef?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}
