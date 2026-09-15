import { readFile } from 'node:fs/promises';

/**
 * Static symbol lists. Index membership changes over time and these are a
 * point-in-time snapshot, not a live index feed — pass `--universe <file>` with
 * your own list when membership matters.
 */
const DOW30 = [
  'AAPL', 'AMGN', 'AMZN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS',
  'GS', 'HD', 'HON', 'IBM', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK',
  'MSFT', 'NKE', 'NVDA', 'PG', 'SHW', 'TRV', 'UNH', 'V', 'VZ', 'WMT',
];

const NASDAQ100_EXTRA = [
  'ABNB', 'ADBE', 'ADI', 'ADP', 'ADSK', 'AEP', 'ALGN', 'AMAT', 'AMD', 'ANSS',
  'ASML', 'AVGO', 'AZN', 'BIIB', 'BKNG', 'BKR', 'CDNS', 'CDW', 'CEG', 'CHTR',
  'CMCSA', 'COST', 'CPRT', 'CSGP', 'CSX', 'CTAS', 'CTSH', 'DDOG', 'DLTR', 'DXCM',
  'EA', 'EXC', 'FANG', 'FAST', 'FTNT', 'GEHC', 'GILD', 'GOOG', 'GOOGL', 'IDXX',
  'ILMN', 'INTC', 'INTU', 'ISRG', 'KDP', 'KHC', 'KLAC', 'LCID', 'LRCX', 'LULU',
  'MAR', 'MCHP', 'MDLZ', 'MELI', 'META', 'MNST', 'MRNA', 'MRVL', 'MU', 'NFLX',
  'NXPI', 'ODFL', 'ON', 'ORLY', 'PANW', 'PAYX', 'PCAR', 'PDD', 'PEP', 'PYPL',
  'QCOM', 'REGN', 'ROST', 'SBUX', 'SIRI', 'SNPS', 'TEAM', 'TMUS', 'TSLA', 'TTD',
  'TXN', 'VRSK', 'VRTX', 'WBD', 'WDAY', 'XEL', 'ZS',
];

const SP100_EXTRA = [
  'ABBV', 'ABT', 'ACN', 'AIG', 'ALL', 'BAC', 'BK', 'BLK', 'BMY', 'BRK-B',
  'C', 'CL', 'COF', 'COP', 'CVS', 'DE', 'DHR', 'DOW', 'DUK', 'EMR',
  'F', 'FDX', 'GD', 'GE', 'GM', 'HCA', 'KMI', 'LIN', 'LLY', 'LMT',
  'LOW', 'MA', 'MDT', 'MET', 'MO', 'MS', 'NEE', 'NOW', 'OXY', 'PFE',
  'PLTR', 'PM', 'PNC', 'RTX', 'SCHW', 'SO', 'SPG', 'T', 'TGT', 'TMO',
  'UNP', 'UPS', 'USB', 'WFC', 'XOM',
];

/**
 * Fuel and energy: the futures that set pump and burner prices, the ETFs that
 * track them, and the refiners and producers whose shares move with them.
 * Futures carry Yahoo's `=F` suffix — other data sources spell them their own
 * way, so this list travels with the yahoo provider.
 */
const FUEL_FUTURES = [
  'CL=F',  // WTI crude
  'BZ=F',  // Brent crude
  'RB=F',  // RBOB gasoline
  'HO=F',  // Heating oil / diesel
  'NG=F',  // Natural gas
];

const FUEL_FUNDS = [
  'USO',   // WTI crude
  'BNO',   // Brent crude
  'UGA',   // Gasoline
  'UNG',   // Natural gas
  'XLE',   // Energy sector
  'XOP',   // Oil & gas exploration
  'OIH',   // Oilfield services
  'VDE',   // Energy
  'CRAK',  // Refiners
];

const FUEL_EQUITIES = [
  'XOM', 'CVX', 'COP', 'OXY', 'EOG', 'PXD', 'DVN', 'FANG', 'HES', 'APA',
  'MPC', 'VLO', 'PSX', 'DINO', 'PBF', 'DK', 'CVI',
  'SLB', 'HAL', 'BKR', 'WMB', 'KMI', 'OKE', 'LNG', 'TRGP',
];

function unique(symbols: string[]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].sort();
}

export const UNIVERSES: Record<string, string[]> = {
  dow30: unique(DOW30),
  nasdaq100: unique([...NASDAQ100_EXTRA, 'AAPL', 'AMZN', 'AMGN', 'CSCO', 'HON', 'MSFT', 'NVDA']),
  sp100: unique([...DOW30, ...SP100_EXTRA, 'AAPL', 'META', 'GOOGL', 'NFLX', 'TSLA', 'AVGO', 'QCOM', 'ORCL', 'TXN', 'INTC', 'ADBE', 'PEP', 'COST']),
  /** Futures, funds and equities that track fuel prices. */
  fuel: unique([...FUEL_FUTURES, ...FUEL_FUNDS, ...FUEL_EQUITIES]),
  /** Just the contracts that set fuel prices, without the equities around them. */
  'fuel-futures': unique([...FUEL_FUTURES, ...FUEL_FUNDS]),
  /** A small, fast list for trying things out. */
  demo: unique(['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AMD', 'NFLX', 'JPM', 'XOM', 'WMT']),
};

export const UNIVERSE_NAMES = Object.keys(UNIVERSES);

/**
 * Resolves a universe selector: a built-in name, a path to a file of symbols
 * (one per line, `#` comments allowed), or a comma-separated list of symbols.
 */
export async function resolveUniverse(selector: string): Promise<string[]> {
  const key = selector.trim().toLowerCase();
  const builtin = UNIVERSES[key];
  if (builtin) return builtin;

  if (selector.includes('/') || /\.(txt|csv)$/i.test(selector)) {
    const contents = await readFile(selector, 'utf8');
    const symbols = contents
      .split(/\r?\n/)
      .map((line) => line.split('#')[0] ?? '')
      .flatMap((line) => line.split(','))
      .map((symbol) => symbol.trim())
      .filter(Boolean);
    if (symbols.length === 0) throw new Error(`No symbols found in ${selector}`);
    return unique(symbols);
  }

  const inline = unique(selector.split(','));
  if (inline.length === 0) {
    throw new Error(`Could not read "${selector}" as a universe. Known: ${UNIVERSE_NAMES.join(', ')}`);
  }
  return inline;
}
