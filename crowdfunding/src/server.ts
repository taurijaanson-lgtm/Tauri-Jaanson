import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { AppError, type Platform } from './service.js';
import { US_STATES } from './usStates.js';
import type { User } from './types.js';

type Params = Record<string, string>;
interface Ctx {
  req: IncomingMessage;
  url: URL;
  params: Params;
  body: Record<string, any>;
  user: User | undefined;
  token: string | undefined;
}
type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

const MAX_BODY_BYTES = 1_000_000;
const INDEX_HTML = fileURLToPath(new URL('./web/index.html', import.meta.url));

function publicUser(u: User) {
  const { passwordHash: _hash, ...rest } = u;
  return rest;
}

async function readJson(req: IncomingMessage): Promise<Record<string, any>> {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new AppError(413, 'Request body is too large.');
    chunks.push(chunk as Buffer);
  }
  if (!size) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new AppError(400, 'Body must be a JSON object.');
  }
}

export function buildRoutes(platform: Platform) {
  const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];
  const on = (method: string, path: string, handler: Handler) => {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' + path.replace(/:(\w+)/g, (_m, k: string) => (keys.push(k), '([^/]+)')) + '$',
    );
    routes.push({ method, pattern, keys, handler });
  };
  const auth = (ctx: Ctx): User => {
    if (!ctx.user) throw new AppError(401, 'Please log in.');
    return ctx.user;
  };

  on('GET', '/api/meta', () => ({ ...platform.meta(), states: US_STATES }));

  // accounts
  on('POST', '/api/auth/register', ({ body }) => {
    const { user, token } = platform.register(body);
    return { user: publicUser(user), token };
  });
  on('POST', '/api/auth/login', ({ body }) => {
    const { user, token } = platform.login(String(body.email ?? ''), String(body.password ?? ''));
    return { user: publicUser(user), token };
  });
  on('POST', '/api/auth/logout', ({ token }) => {
    if (token) platform.logout(token);
    return { ok: true };
  });
  on('GET', '/api/me', (ctx) => ({ user: publicUser(auth(ctx)) }));
  on('PUT', '/api/me/creator-profile', (ctx) => platform.updateCreatorProfile(auth(ctx).id, ctx.body));
  on('POST', '/api/me/payout-account', (ctx) => platform.connectPayoutAccount(auth(ctx).id));
  on('GET', '/api/me/pledges', (ctx) => platform.myPledges(auth(ctx).id));
  on('GET', '/api/me/campaigns', (ctx) => platform.myCampaigns(auth(ctx).id));

  // campaigns
  on('GET', '/api/campaigns', ({ url }) =>
    platform.listPublic({
      ...(url.searchParams.get('category') ? { category: url.searchParams.get('category')! } : {}),
      ...(url.searchParams.get('state') ? { state: url.searchParams.get('state')! } : {}),
      ...(url.searchParams.get('q') ? { q: url.searchParams.get('q')! } : {}),
      ...(url.searchParams.get('sort') ? { sort: url.searchParams.get('sort')! } : {}),
    }),
  );
  on('GET', '/api/campaigns/:slug', ({ params, user }) => platform.getCampaign(params.slug!, user?.id));
  on('POST', '/api/campaigns', (ctx) => platform.createCampaign(auth(ctx).id, ctx.body));
  on('PATCH', '/api/campaigns/:id', (ctx) => platform.updateCampaign(auth(ctx).id, ctx.params.id!, ctx.body));
  on('POST', '/api/campaigns/:id/submit', (ctx) => platform.submitForReview(auth(ctx).id, ctx.params.id!));
  on('POST', '/api/campaigns/:id/launch', (ctx) => platform.launch(auth(ctx).id, ctx.params.id!));
  on('POST', '/api/campaigns/:id/cancel', (ctx) => platform.cancelCampaign(auth(ctx).id, ctx.params.id!));
  on('GET', '/api/campaigns/:id/pledges', (ctx) => platform.campaignPledges(auth(ctx).id, ctx.params.id!));

  // pledges
  on('POST', '/api/campaigns/:id/pledges', async (ctx) => {
    const p = await platform.pledge(auth(ctx).id, ctx.params.id!, ctx.body as any);
    const { paymentMethodRef: _pm, ...rest } = p;
    return rest;
  });
  on('DELETE', '/api/pledges/:id', (ctx) => platform.cancelPledge(auth(ctx).id, ctx.params.id!));

  // admin
  on('GET', '/api/admin/review-queue', (ctx) => platform.reviewQueue(auth(ctx).id));
  on('POST', '/api/admin/campaigns/:id/review', (ctx) =>
    platform.review(auth(ctx).id, ctx.params.id!, {
      approve: ctx.body.approve === true,
      ...(typeof ctx.body.notes === 'string' ? { notes: ctx.body.notes } : {}),
      nonprofitVerified: ctx.body.nonprofitVerified === true,
    }),
  );
  on('POST', '/api/admin/users/:id/verify', (ctx) => platform.verifyIdentity(auth(ctx).id, ctx.params.id!));
  on('POST', '/api/admin/settle', async (ctx) => {
    if (!auth(ctx).isAdmin) throw new AppError(403, 'You do not have access to that.');
    return (await platform.settleDueCampaigns()).map((c) => ({ id: c.id, status: c.status }));
  });

  return routes;
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

export function createApp(platform: Platform): Server {
  const routes = buildRoutes(platform);
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'same-origin',
        });
        return res.end(readFileSync(INDEX_HTML));
      }
      const matches = routes.filter((r) => r.pattern.test(url.pathname));
      const route = matches.find((r) => r.method === req.method);
      if (!route) return send(res, matches.length ? 405 : 404, { error: matches.length ? 'Method not allowed.' : 'Not found.' });
      const m = route.pattern.exec(url.pathname)!;
      const params: Params = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]!)));
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      const body = await readJson(req);
      const result = await route.handler({ req, url, params, body, user: platform.userForToken(token), token });
      send(res, 200, result);
    } catch (err) {
      if (err instanceof AppError) return send(res, err.status, { error: err.message, issues: err.issues });
      console.error(err);
      send(res, 500, { error: 'Something went wrong.' });
    }
  });
}
