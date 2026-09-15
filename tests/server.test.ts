import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDashboardServer } from '../src/server.js';

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createDashboardServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('dashboard server', () => {
  it('serves the dashboard page', async () => {
    const response = await fetch(`${origin}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('Trade Scanner');
    expect(html).toContain('/api/scan');
  });

  it('describes the available strategies and universes', async () => {
    const meta = await (await fetch(`${origin}/api/meta`)).json();
    expect(meta.providers).toContain('sample');
    expect(meta.universes).toContain('demo');
    expect(meta.strategies.map((strategy: { name: string }) => strategy.name)).toContain('breakout');
  });

  it('runs a scan and returns ranked hits', async () => {
    const response = await fetch(`${origin}/api/scan?provider=sample&universe=sp100&limit=5`);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.hits.length).toBeLessThanOrEqual(5);
    expect(result.scanned).toBeGreaterThan(0);
    const scores = result.hits.map((hit: { score: number }) => hit.score);
    expect([...scores].sort((a: number, b: number) => b - a)).toEqual(scores);
  });

  it('applies query filters', async () => {
    const response = await fetch(
      `${origin}/api/scan?provider=sample&universe=sp100&strategy=momentum&minScore=70`,
    );
    const result = await response.json();
    for (const hit of result.hits) {
      expect(hit.score).toBeGreaterThanOrEqual(70);
      expect(['breakout', 'momentum-leader']).toContain(hit.strategy);
    }
  });

  it('reports bad input and unknown routes without crashing', async () => {
    const badProvider = await fetch(`${origin}/api/scan?provider=bogus`);
    expect(badProvider.status).toBe(400);
    expect((await badProvider.json()).error).toContain('bogus');

    const badStrategy = await fetch(`${origin}/api/scan?provider=sample&strategy=nope`);
    expect(badStrategy.status).toBe(500);
    expect((await badStrategy.json()).error).toContain('Unknown strategy');

    expect((await fetch(`${origin}/missing`)).status).toBe(404);
    expect((await fetch(`${origin}/api/scan`, { method: 'POST' })).status).toBe(405);
  });
});
