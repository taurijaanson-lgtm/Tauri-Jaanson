import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';

/** Captures stdout for the duration of one CLI run. */
async function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
  try {
    const code = await main(args);
    return { code, stdout, stderr };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
}

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('cli', () => {
  it('prints usage for --help', async () => {
    const { code, stdout } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('--strategy');
  });

  it('lists strategies and universes for --list', async () => {
    const { code, stdout } = await runCli(['--list']);
    expect(code).toBe(0);
    expect(stdout).toContain('breakout');
    expect(stdout).toContain('mean-reversion');
    expect(stdout).toContain('Universes:');
  });

  it('scans the sample provider and prints a table', async () => {
    const { code, stdout } = await runCli(['--provider', 'sample', '--universe', 'demo']);
    expect(code).toBe(0);
    expect(stdout).toContain('SYMBOL');
    expect(stdout).toContain('setup(s) from');
  });

  it('emits valid JSON with --format json', async () => {
    const { stdout } = await runCli([
      '--provider', 'sample', '--universe', 'AAPL,MSFT,NVDA', '--format', 'json',
    ]);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.hits)).toBe(true);
    expect(parsed.scanned).toBe(3);
  });

  it('honours --limit', async () => {
    const { stdout } = await runCli([
      '--provider', 'sample', '--universe', 'sp100', '--format', 'json', '--limit', '5',
    ]);
    expect(JSON.parse(stdout).hits.length).toBeLessThanOrEqual(5);
  });

  it('writes to a file with --out and keeps stdout clean', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cli-out-'));
    tempDirs.push(dir);
    const path = join(dir, 'hits.csv');
    const { code, stdout } = await runCli([
      '--provider', 'sample', '--universe', 'demo', '--format', 'csv', '--out', path,
    ]);
    expect(code).toBe(0);
    expect(stdout).toBe('');
    expect(await readFile(path, 'utf8')).toContain('symbol,strategy,direction,score');
  });

  it('rejects unknown providers, formats and strategies', async () => {
    await expect(runCli(['--provider', 'bloomberg'])).rejects.toThrow(/Unknown provider/);
    await expect(runCli(['--format', 'xml'])).rejects.toThrow(/Unknown format/);
    await expect(runCli(['--strategy', 'nope', '--provider', 'sample'])).rejects.toThrow(
      /Unknown strategy/,
    );
  });

  it('rejects non-numeric numeric flags', async () => {
    await expect(runCli(['--provider', 'sample', '--limit', 'ten'])).rejects.toThrow(
      /--limit expects a number/,
    );
  });
});
