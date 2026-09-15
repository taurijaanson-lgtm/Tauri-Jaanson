import type { Hit } from './types.js';
import type { ScanResult } from './scanner.js';

export type OutputFormat = 'table' | 'json' | 'csv';

function num(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '-'
    : value.toFixed(digits);
}

/** Pads rows to a common width so the table lines up in a terminal. */
function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: string[]): string =>
    cells.map((cell, i) => cell.padEnd(widths[i] as number)).join('  ').trimEnd();
  return [line(headers), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join(
    '\n',
  );
}

export function formatTable(result: ScanResult, verbose = false): string {
  if (result.hits.length === 0) {
    return `No setups found. Scanned ${result.scanned} symbol(s), skipped ${result.skipped}.`;
  }
  const rows = result.hits.map((hit) => [
    hit.symbol,
    hit.strategy,
    hit.direction === 'long' ? 'long' : 'short',
    num(hit.score, 1),
    num(hit.close),
    num(hit.snapshot.changePct, 1),
    num(hit.snapshot.relativeVolume, 1),
    num(hit.snapshot.rsi14, 0),
    num(hit.snapshot.atrPct, 1),
    num(hit.snapshot.pctFrom52wHigh, 1),
  ]);
  const table = renderTable(
    ['SYMBOL', 'STRATEGY', 'SIDE', 'SCORE', 'CLOSE', 'CHG%', 'RVOL', 'RSI', 'ATR%', '<52WH%'],
    rows,
  );

  const parts = [table];
  if (verbose) {
    parts.push('');
    for (const hit of result.hits) {
      parts.push(`${hit.symbol} — ${hit.strategy} (score ${num(hit.score, 1)})`);
      for (const reason of hit.reasons) parts.push(`  • ${reason}`);
      const failed = hit.rules.filter((rule) => !rule.passed);
      for (const rule of failed) parts.push(`  ◦ (not met) ${rule.detail}`);
      parts.push('');
    }
  }
  parts.push(
    `${result.hits.length} setup(s) from ${result.scanned} symbol(s); ${result.skipped} skipped, ${result.errors.length} error(s).`,
  );
  return parts.join('\n');
}

export function formatCsv(result: ScanResult): string {
  const headers = [
    'symbol', 'strategy', 'direction', 'score', 'date', 'close', 'change_pct',
    'rel_volume', 'rsi14', 'atr_pct', 'pct_from_52w_high', 'reasons',
  ];
  const escape = (value: string): string =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const rows = result.hits.map((hit: Hit) =>
    [
      hit.symbol,
      hit.strategy,
      hit.direction,
      num(hit.score, 1),
      hit.date,
      num(hit.close),
      num(hit.snapshot.changePct),
      num(hit.snapshot.relativeVolume),
      num(hit.snapshot.rsi14),
      num(hit.snapshot.atrPct),
      num(hit.snapshot.pctFrom52wHigh),
      hit.reasons.join('; '),
    ]
      .map(escape)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function format(result: ScanResult, kind: OutputFormat, verbose = false): string {
  if (kind === 'json') return formatJson(result);
  if (kind === 'csv') return formatCsv(result);
  return formatTable(result, verbose);
}
