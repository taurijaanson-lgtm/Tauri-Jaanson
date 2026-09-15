import { join } from 'node:path';
import { SeriesCache } from './cache.js';
import { SampleProvider } from './sample.js';
import type { Provider } from './types.js';
import { YahooProvider } from './yahoo.js';

export { SeriesCache } from './cache.js';
export { SampleProvider } from './sample.js';
export { YahooProvider } from './yahoo.js';
export type { FetchOptions, Provider } from './types.js';

export const PROVIDER_NAMES = ['yahoo', 'sample'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export function isProviderName(value: string): value is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value);
}

export interface ProviderSetup {
  provider: Provider;
  cache: SeriesCache | null;
}

export function createProvider(name: ProviderName, useCache = true): ProviderSetup {
  const provider: Provider = name === 'yahoo' ? new YahooProvider() : new SampleProvider();
  // Synthetic data is cheap to regenerate, so only network fetches are cached.
  const cache =
    useCache && name === 'yahoo'
      ? new SeriesCache(join(process.cwd(), '.cache', 'series'), 12 * 60 * 60 * 1000)
      : null;
  return { provider, cache };
}
