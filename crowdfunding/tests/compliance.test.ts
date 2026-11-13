import { describe, expect, it } from 'vitest';
import {
  ageOn,
  contentIssues,
  pledgeAmountIssue,
  validateAddress,
  validateCreatorProfile,
} from '../src/compliance.js';

const today = new Date('2026-03-01T00:00:00Z');

describe('creator eligibility', () => {
  it('computes age around birthdays', () => {
    expect(ageOn('2008-03-01', today)).toBe(18);
    expect(ageOn('2008-03-02', today)).toBe(17);
    expect(ageOn('2008-02-30', today)).toBeNull();
  });

  it('requires adults resident in the US', () => {
    expect(validateCreatorProfile({ legalName: 'A Person', dateOfBirth: '1990-05-05', state: 'NY' }, today)).toEqual([]);
    const issues = validateCreatorProfile({ legalName: 'A Person', dateOfBirth: '2010-05-05', state: 'ON' }, today);
    expect(issues.map((i) => i.field).sort()).toEqual(['dateOfBirth', 'state']);
  });
});

describe('content policy', () => {
  const base = { title: 'My bakery', blurb: 'Help us open', rewards: [] };

  it('blocks campaigns that read like securities offerings', () => {
    for (const story of [
      'Backers receive equity in our startup.',
      'We offer a 5% revenue share for three years.',
      'Expect a great return on investment.',
      'Early investors get quarterly dividends.',
    ]) {
      expect(contentIssues({ ...base, story }).some((i) => /Regulation Crowdfunding/.test(i.message))).toBe(true);
    }
  });

  it('allows ordinary reward language', () => {
    expect(contentIssues({ ...base, story: 'We will share photos of the build and bake you a pie.' })).toEqual([]);
  });

  it('blocks prohibited categories', () => {
    expect(contentIssues({ ...base, story: 'Enter our raffle to win a truck!' })).toHaveLength(1);
  });
});

describe('addresses', () => {
  const us = { name: 'A', line1: '1 Main', city: 'Reno', state: 'NV', zip: '89501' };

  it('validates US addresses', () => {
    expect(validateAddress(us, 'us_only')).toEqual([]);
    expect(validateAddress({ ...us, zip: '8950' }, 'us_only')).toHaveLength(1);
    expect(validateAddress({ ...us, state: 'XX' }, 'us_only')).toHaveLength(1);
  });

  it('enforces US-only shipping but allows worldwide rewards abroad', () => {
    const intl = { name: 'A', line1: '1 Rue', city: 'Paris', state: '', zip: '75001', country: 'FR' };
    expect(validateAddress(intl, 'us_only').map((i) => i.field)).toContain('shippingAddress.country');
    expect(validateAddress(intl, 'worldwide')).toEqual([]);
  });

  it('does not require an address for digital rewards', () => {
    expect(validateAddress(undefined, 'none')).toEqual([]);
  });
});

describe('pledge amounts', () => {
  it('enforces reward minimum and per-pledge cap', () => {
    expect(pledgeAmountIssue(500, 1000)).toMatch(/minimum/);
    expect(pledgeAmountIssue(1000, 1000)).toBeNull();
    expect(pledgeAmountIssue(10_000_01, 0)).toMatch(/\$10,000/);
    expect(pledgeAmountIssue(12.5, 0)).toMatch(/invalid/);
  });
});
