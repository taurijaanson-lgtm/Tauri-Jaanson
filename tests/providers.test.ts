import { afterEach, describe, expect, it, vi } from 'vitest';
import { SampleProvider } from '../src/providers/sample.js';
import { YahooProvider } from '../src/providers/yahoo.js';
import { createProvider, isProviderName } from '../src/providers/index.js';
import { snapshot } from '../src/indicators.js';

describe('SampleProvider', () => {
  const provider = new SampleProvider(new Date(Date.UTC(2024, 5, 14)));

  it('is deterministic for a symbol', async () => {
    const first = await provider.fetchSeries('AAPL', { bars: 300 });
    const second = await provider.fetchSeries('AAPL', { bars: 300 });
    expect(first).toEqual(second);
  });

  it('gives different symbols different histories', async () => {
    const a = await provider.fetchSeries('AAPL', { bars: 300 });
    const b = await provider.fetchSeries('MSFT', { bars: 300 });
    expect(a?.bars.at(-1)?.close).not.toBe(b?.bars.at(-1)?.close);
  });

  it('produces coherent, weekday-only, chronological bars', async () => {
    const series = await provider.fetchSeries('NVDA', { bars: 260 });
    expect(series?.bars).toHaveLength(260);
    let previousDate = '';
    for (const bar of series?.bars ?? []) {
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
      expect(bar.close).toBeGreaterThan(0);
      expect(bar.volume).toBeGreaterThan(0);
      expect(bar.date > previousDate).toBe(true);
      const weekday = new Date(`${bar.date}T00:00:00Z`).getUTCDay();
      expect(weekday).toBeGreaterThanOrEqual(1);
      expect(weekday).toBeLessThanOrEqual(5);
      previousDate = bar.date;
    }
  });

  it('always returns enough history for the indicators to warm up', async () => {
    const series = await provider.fetchSeries('AMD', { bars: 30 });
    const snap = snapshot(series!);
    expect(series?.bars).toHaveLength(30);
    expect(snap?.sma20).not.toBeNull();
  });
});

describe('YahooProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(payload: unknown, ok = true, status = 200): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok, status, json: async () => payload })),
    );
  }

  const day = 86_400;
  const payload = {
    chart: {
      error: null,
      result: [
        {
          timestamp: [1_700_000_000, 1_700_000_000 + day, 1_700_000_000 + 2 * day],
          indicators: {
            quote: [
              {
                open: [10, null, 12],
                high: [11, null, 13],
                low: [9, null, 11],
                close: [10.5, null, 12.5],
                volume: [1000, null, 2000],
              },
            ],
          },
        },
      ],
    },
  };

  it('maps the chart payload into bars and drops null sessions', async () => {
    stubFetch(payload);
    const series = await new YahooProvider().fetchSeries('AAPL', { bars: 100 });
    expect(series?.symbol).toBe('AAPL');
    expect(series?.bars).toHaveLength(2);
    expect(series?.bars[0]).toMatchObject({ open: 10, high: 11, low: 9, close: 10.5, volume: 1000 });
    expect(series?.bars[1]?.close).toBe(12.5);
    expect(series?.bars[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('trims to the requested number of bars', async () => {
    stubFetch(payload);
    const series = await new YahooProvider().fetchSeries('AAPL', { bars: 1 });
    expect(series?.bars).toHaveLength(1);
    expect(series?.bars[0]?.close).toBe(12.5);
  });

  it('throws on an HTTP error', async () => {
    stubFetch({}, false, 429);
    await expect(new YahooProvider().fetchSeries('AAPL', { bars: 10 })).rejects.toThrow(/HTTP 429/);
  });

  it('throws on an error inside the payload', async () => {
    stubFetch({ chart: { error: { code: 'Not Found', description: 'No data found' } } });
    await expect(new YahooProvider().fetchSeries('NOPE', { bars: 10 })).rejects.toThrow(/No data found/);
  });

  it('returns null when the payload has no usable rows', async () => {
    stubFetch({ chart: { error: null, result: [] } });
    expect(await new YahooProvider().fetchSeries('AAPL', { bars: 10 })).toBeNull();
  });
});

describe('createProvider', () => {
  it('caches network data but not synthetic data', () => {
    expect(createProvider('yahoo').cache).not.toBeNull();
    expect(createProvider('yahoo', false).cache).toBeNull();
    expect(createProvider('sample').cache).toBeNull();
  });

  it('validates provider names', () => {
    expect(isProviderName('yahoo')).toBe(true);
    expect(isProviderName('bloomberg')).toBe(false);
  });
});
