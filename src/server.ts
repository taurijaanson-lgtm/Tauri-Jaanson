import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createProvider, isProviderName, PROVIDER_NAMES } from './providers/index.js';
import { scan } from './scanner.js';
import { resolveStrategies, strategies, strategyGroups } from './strategies/index.js';
import { resolveUniverse, UNIVERSE_NAMES } from './universe.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Looks for the dashboard next to the source and next to the build output. */
async function readDashboard(): Promise<string> {
  const candidates = [join(here, 'web', 'index.html'), join(here, '..', 'src', 'web', 'index.html')];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      continue;
    }
  }
  throw new Error('Dashboard file src/web/index.html not found');
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  response.end(payload);
}

function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function handleScan(params: URLSearchParams, response: ServerResponse): Promise<void> {
  const providerName = params.get('provider') ?? 'yahoo';
  if (!isProviderName(providerName)) {
    sendJson(response, 400, { error: `Unknown provider "${providerName}"` });
    return;
  }
  const symbols = await resolveUniverse(params.get('universe') ?? 'demo');
  const selected = resolveStrategies((params.get('strategy') ?? 'all').split(','));
  const { provider, cache } = createProvider(providerName);
  const limit = numberParam(params, 'limit');
  const minScore = numberParam(params, 'minScore');
  const minPrice = numberParam(params, 'minPrice');
  const minAvgVolume = numberParam(params, 'minVolume');

  const result = await scan({
    symbols,
    strategies: selected,
    provider,
    cache,
    ...(limit !== undefined ? { limit } : {}),
    filters: {
      ...(minScore !== undefined ? { minScore } : {}),
      ...(minPrice !== undefined ? { minPrice } : {}),
      ...(minAvgVolume !== undefined ? { minAvgVolume } : {}),
    },
  });
  sendJson(response, 200, result);
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Only GET is supported' });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = await readDashboard();
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': Buffer.byteLength(html),
    });
    response.end(html);
    return;
  }

  if (url.pathname === '/api/meta') {
    sendJson(response, 200, {
      providers: PROVIDER_NAMES,
      universes: UNIVERSE_NAMES,
      groups: Object.keys(strategyGroups),
      strategies: strategies.map((strategy) => ({
        name: strategy.name,
        description: strategy.description,
        direction: strategy.direction,
      })),
    });
    return;
  }

  if (url.pathname === '/api/scan') {
    await handleScan(url.searchParams, response);
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

export function createDashboardServer() {
  return createServer((request, response) => {
    route(request, response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) sendJson(response, 500, { error: message });
      else response.end();
    });
  });
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (invokedDirectly) {
  const port = Number(process.env.PORT ?? 5173);
  // Bound to loopback on purpose: this serves an unauthenticated local tool.
  createDashboardServer().listen(port, '127.0.0.1', () => {
    process.stdout.write(`Trade scanner dashboard on http://127.0.0.1:${port}\n`);
  });
}
