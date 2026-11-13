import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/server.js';
import { setup } from './helpers.js';

const t = setup();
const server = createApp(t.platform);
let base = '';

beforeAll(async () => {
  await t.liveCampaign();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: (await res.json()) as any };
}

describe('HTTP API', () => {
  it('serves the web app', async () => {
    const res = await fetch(base + '/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>');
  });

  it('registers, logs in, and never leaks password hashes', async () => {
    const reg = await call('POST', '/api/auth/register', { email: 'new@test.dev', name: 'New User', password: 'longenough' });
    expect(reg.status).toBe(200);
    expect(reg.data.user.passwordHash).toBeUndefined();
    const bad = await call('POST', '/api/auth/login', { email: 'new@test.dev', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    const me = await call('GET', '/api/me', undefined, reg.data.token);
    expect(me.data.user.email).toBe('new@test.dev');
  });

  it('lists live campaigns publicly and pledges with auth', async () => {
    const list = await call('GET', '/api/campaigns?state=TN');
    expect(list.data).toHaveLength(1);
    const c = list.data[0];
    expect(c.payout).toBeUndefined();

    const anon = await call('POST', `/api/campaigns/${c.id}/pledges`, { amountCents: 2000, paymentToken: 'tok_visa' });
    expect(anon.status).toBe(401);

    const { data: login } = await call('POST', '/api/auth/login', { email: 'backer@test.dev', password: 'password1' });
    const ok = await call('POST', `/api/campaigns/${c.id}/pledges`, { amountCents: 2000, paymentToken: 'tok_visa' }, login.token);
    expect(ok.status).toBe(200);
    expect(ok.data.paymentMethodRef).toBeUndefined();

    const declined = await call('POST', `/api/campaigns/${c.id}/pledges`, { amountCents: 2000, paymentToken: 'tok_invalid' }, login.token);
    expect(declined.status).toBe(402);
  });

  it('returns field-level issues for invalid input', async () => {
    const res = await call('POST', '/api/auth/register', { email: 'nope', name: '', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.data.issues.map((i: { field: string }) => i.field)).toEqual(['email', 'name', 'password']);
  });

  it('rejects malformed JSON and unknown routes', async () => {
    const res = await fetch(base + '/api/auth/login', { method: 'POST', body: '{nope' });
    expect(res.status).toBe(400);
    expect((await call('GET', '/api/nope')).status).toBe(404);
    expect((await call('DELETE', '/api/campaigns')).status).toBe(405);
  });

  it('restricts admin endpoints', async () => {
    const { data: login } = await call('POST', '/api/auth/login', { email: 'backer@test.dev', password: 'password1' });
    expect((await call('GET', '/api/admin/review-queue', undefined, login.token)).status).toBe(403);
    expect((await call('POST', '/api/admin/settle', {}, login.token)).status).toBe(403);
  });
});
