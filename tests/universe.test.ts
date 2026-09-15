import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveUniverse, UNIVERSES, UNIVERSE_NAMES } from '../src/universe.js';

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('resolveUniverse', () => {
  it('resolves built-in names case-insensitively', async () => {
    expect(await resolveUniverse('dow30')).toEqual(UNIVERSES.dow30);
    expect(await resolveUniverse('Dow30')).toEqual(UNIVERSES.dow30);
  });

  it('exposes built-in lists that are sorted and free of duplicates', () => {
    for (const name of UNIVERSE_NAMES) {
      const symbols = UNIVERSES[name] as string[];
      expect(symbols.length).toBeGreaterThan(0);
      expect(new Set(symbols).size).toBe(symbols.length);
      expect([...symbols].sort()).toEqual(symbols);
    }
  });

  it('accepts an inline comma-separated list', async () => {
    expect(await resolveUniverse('msft, aapl,nvda')).toEqual(['AAPL', 'MSFT', 'NVDA']);
  });

  it('reads a file of symbols, ignoring comments and blank lines', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'universe-'));
    tempDirs.push(dir);
    const path = join(dir, 'list.txt');
    await writeFile(path, '# my watchlist\nAAPL\n\nmsft , nvda  # tech\n', 'utf8');
    expect(await resolveUniverse(path)).toEqual(['AAPL', 'MSFT', 'NVDA']);
  });

  it('fails clearly when a file has no symbols', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'universe-'));
    tempDirs.push(dir);
    const path = join(dir, 'empty.txt');
    await writeFile(path, '# nothing here\n', 'utf8');
    await expect(resolveUniverse(path)).rejects.toThrow(/No symbols found/);
  });
});
