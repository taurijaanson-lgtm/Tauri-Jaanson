#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { createProvider, isProviderName, PROVIDER_NAMES } from './providers/index.js';
import { scan } from './scanner.js';
import { resolveStrategies, strategies, strategyGroups } from './strategies/index.js';
import { format, type OutputFormat } from './format.js';
import { resolveUniverse, UNIVERSE_NAMES } from './universe.js';

const USAGE = `trade-scanner — scans a universe of stocks for technical setups

Usage:
  npm run scan -- [options]

Options:
  -u, --universe <name|file|list>  Built-in list, a file of symbols, or AAPL,MSFT (default: demo)
  -s, --strategy <names>           Comma-separated strategies or groups (default: all)
  -p, --provider <name>            ${PROVIDER_NAMES.join(' | ')} (default: yahoo)
  -f, --format <fmt>               table | json | csv (default: table)
  -o, --out <file>                 Write output to a file instead of stdout
  -n, --limit <n>                  Keep only the top N ranked setups
      --min-score <n>              Drop setups scoring below N (0-100)
      --min-price <n>              Skip symbols priced below N
      --max-price <n>              Skip symbols priced above N
      --min-volume <n>             Skip symbols whose 20-day average volume is below N
      --bars <n>                   Bars of history per symbol (default: 400)
      --concurrency <n>            Parallel fetches (default: 6)
      --no-cache                   Ignore the on-disk cache and refetch
  -v, --verbose                    Show the reasoning behind each setup
      --list                       List strategies and universes, then exit
  -h, --help                       Show this help

Universes: ${UNIVERSE_NAMES.join(', ')}
Groups:    ${Object.keys(strategyGroups).join(', ')}

Examples:
  npm run scan -- --universe dow30 --strategy momentum --verbose
  npm run scan -- --universe sp100 --strategy all --min-score 60 --limit 20
  npm run scan -- --provider sample --strategy all        # offline, synthetic data
  npm run scan -- --universe my-list.txt --format csv --out hits.csv
`;

function listCatalog(): string {
  const lines = ['Strategies:'];
  for (const strategy of strategies) {
    lines.push(`  ${strategy.name.padEnd(16)} ${strategy.direction.padEnd(5)} ${strategy.description}`);
  }
  lines.push('', 'Groups:');
  for (const [group, names] of Object.entries(strategyGroups)) {
    lines.push(`  ${group.padEnd(16)} ${names.join(', ')}`);
  }
  lines.push('', `Universes: ${UNIVERSE_NAMES.join(', ')}`);
  return lines.join('\n');
}

function numeric(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${flag} expects a number, got "${value}"`);
  return parsed;
}

export async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      universe: { type: 'string', short: 'u', default: 'demo' },
      strategy: { type: 'string', short: 's', default: 'all' },
      provider: { type: 'string', short: 'p', default: 'yahoo' },
      format: { type: 'string', short: 'f', default: 'table' },
      out: { type: 'string', short: 'o' },
      limit: { type: 'string', short: 'n' },
      'min-score': { type: 'string' },
      'min-price': { type: 'string' },
      'max-price': { type: 'string' },
      'min-volume': { type: 'string' },
      bars: { type: 'string' },
      concurrency: { type: 'string' },
      'no-cache': { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      list: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (values.list) {
    process.stdout.write(`${listCatalog()}\n`);
    return 0;
  }

  const providerName = String(values.provider);
  if (!isProviderName(providerName)) {
    throw new Error(`Unknown provider "${providerName}". Available: ${PROVIDER_NAMES.join(', ')}`);
  }
  const outputFormat = String(values.format) as OutputFormat;
  if (!['table', 'json', 'csv'].includes(outputFormat)) {
    throw new Error(`Unknown format "${outputFormat}". Available: table, json, csv`);
  }

  const symbols = await resolveUniverse(String(values.universe));
  const selected = resolveStrategies(String(values.strategy).split(','));
  const { provider, cache } = createProvider(providerName, !values['no-cache']);

  const isTty = process.stderr.isTTY === true;
  const result = await scan({
    symbols,
    strategies: selected,
    provider,
    cache,
    bars: numeric(values.bars, '--bars') ?? 400,
    concurrency: numeric(values.concurrency, '--concurrency') ?? 6,
    ...(numeric(values.limit, '--limit') !== undefined
      ? { limit: numeric(values.limit, '--limit') as number }
      : {}),
    filters: {
      ...(numeric(values['min-price'], '--min-price') !== undefined
        ? { minPrice: numeric(values['min-price'], '--min-price') as number }
        : {}),
      ...(numeric(values['max-price'], '--max-price') !== undefined
        ? { maxPrice: numeric(values['max-price'], '--max-price') as number }
        : {}),
      ...(numeric(values['min-volume'], '--min-volume') !== undefined
        ? { minAvgVolume: numeric(values['min-volume'], '--min-volume') as number }
        : {}),
      ...(numeric(values['min-score'], '--min-score') !== undefined
        ? { minScore: numeric(values['min-score'], '--min-score') as number }
        : {}),
    },
    onProgress: (done, total) => {
      // Progress goes to stderr so `--format json > file` stays clean.
      if (isTty) process.stderr.write(`\rScanning ${done}/${total}...`);
    },
  });
  if (isTty) process.stderr.write('\r\x1b[K');

  const output = format(result, outputFormat, values.verbose === true);
  if (values.out) {
    await writeFile(String(values.out), `${output}\n`, 'utf8');
    process.stderr.write(`Wrote ${result.hits.length} setup(s) to ${values.out}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }

  for (const error of result.errors) {
    process.stderr.write(`warn: ${error.symbol}: ${error.message}\n`);
  }
  // Errors on some symbols still count as a successful scan; only a total
  // failure to read any symbol is worth a non-zero exit.
  return result.scanned === 0 && result.errors.length > 0 ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('cli.ts') || process.argv[1].endsWith('cli.js'));

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
