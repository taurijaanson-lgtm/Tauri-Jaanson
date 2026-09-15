# Trade Scanner

Scans a universe of stocks for technical trade setups and ranks what it finds.
Runs as a terminal command or as a local web dashboard.

It is a screening tool: it narrows a few hundred symbols down to a handful worth
looking at, and shows the evidence behind every match. It does not place orders,
backtest, or tell you what to buy.

```
SYMBOL  STRATEGY         SIDE  SCORE  CLOSE   CHG%  RVOL  RSI  ATR%  <52WH%
------  ---------------  ----  -----  ------  ----  ----  ---  ----  ------
XOM     momentum-leader  long  98.5   556.14  3.2   1.0   68   3.5   0.4
TSLA    squeeze          long  73.4   90.13   0.0   1.1   43   1.0   9.4
JPM     squeeze          long  71.9   76.47   -0.4  0.7   44   1.1   8.5
```

## Getting started

```bash
npm install
npm run scan -- --universe dow30 --strategy momentum --verbose
npm run serve            # dashboard on http://127.0.0.1:5173
```

No API keys and no paid data feed. Node 20 or newer.

To try it without touching the network, use the synthetic provider:

```bash
npm run scan -- --provider sample --universe sp100 --strategy all
```

## What it looks for

| Strategy | Side | Fires when |
| --- | --- | --- |
| `breakout` | long | Close clears the prior 20-day high on above-average volume, above the 50-day average |
| `momentum-leader` | long | Within 10% of the 52-week high with strong 3- and 6-month returns |
| `trend-stack` | long | Price above 20 > 50 > 200-day averages with ADX above 20 |
| `golden-cross` | long | The 50-day crossed above the 200-day within the last 15 sessions |
| `oversold-bounce` | long | RSI below 32 and a tag of the lower Bollinger band, above the 200-day average |
| `overbought-fade` | short | RSI above 70, pinned to the upper band, stretched from the 20-day average |
| `gap-up` | long | Opens 2%+ above the prior close, holds the gap, on heavy volume |
| `squeeze` | long | Bollinger bandwidth in the bottom 15% of its 6-month range |
| `unusual-volume` | long | Volume at least 2.5x its 20-day average with a real price move |

Select them individually (`--strategy breakout,squeeze`) or by group:
`all`, `momentum`, `trend`, `mean-reversion`, `volatility`, `long`, `short`.

### Scores

Each strategy checks several conditions. Every gating condition must pass for a
symbol to appear at all; the 0-100 score is the weighted quality of those
conditions, so a setup that merely clears its thresholds scores far below one
that clears them convincingly. Scores are comparable within a strategy and only
a rough guide across strategies. `--verbose` prints the conditions behind every
hit, including the non-gating ones that failed.

## CLI

```
npm run scan -- [options]

-u, --universe <name|file|list>  Built-in list, a file of symbols, or AAPL,MSFT (default: demo)
-s, --strategy <names>           Comma-separated strategies or groups (default: all)
-p, --provider <name>            yahoo | sample (default: yahoo)
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
```

Built-in universes: `dow30`, `nasdaq100`, `sp100`, `demo`. These are static
snapshots of index membership, not a live index feed — pass your own file
(one symbol per line, `#` comments allowed) when membership matters.

Results go to stdout and progress to stderr, so redirection stays clean:

```bash
npm run scan -- --universe sp100 --min-score 60 --format json > hits.json
npm run scan -- --universe watchlist.txt --format csv --out hits.csv
```

## Dashboard

`npm run serve` starts a local server (loopback only — it is unauthenticated)
that serves the same scanner over HTTP:

- `GET /` — the dashboard: pick a universe, strategy and data source, sort by
  any column, click a row to see which conditions passed and which did not.
- `GET /api/meta` — available strategies, groups, universes and providers.
- `GET /api/scan?universe=&strategy=&provider=&minScore=&minPrice=&minVolume=&limit=`
  — a scan as JSON.

Set `PORT` to move it off 5173.

## Data

**`yahoo`** (default) pulls daily bars from Yahoo Finance's public chart
endpoint. It needs no key, but it is undocumented: it rate-limits, and it can
change or start refusing requests without notice. Keep `--concurrency` modest.
Fetched history is cached under `.cache/series` for 12 hours, so re-running a
scan the same day costs nothing; `--no-cache` forces a refetch.

**`sample`** generates deterministic synthetic history offline. Each symbol is
assigned an archetype from its name, so the sample universe always contains
examples of every setup. It exists for development and testing — never judge a
strategy by how it performs on it.

Adding a source means implementing `fetchSeries` from
`src/providers/types.ts` and registering it in `src/providers/index.ts`.

## Adding a strategy

A strategy returns a list of checks; the shared scorer turns them into a
pass/fail and a score.

```ts
// src/strategies/myIdea.ts
import { makeStrategy, ramp, fmt, type Check } from './shared.js';

export const myIdea = makeStrategy({
  name: 'my-idea',
  description: 'What this looks for.',
  direction: 'long',
  minBars: 60,                      // history needed before it can evaluate
  checks(snapshot): Check[] | null {
    const { rsi14, relativeVolume } = snapshot;
    if (rsi14 === null || relativeVolume === null) return null;
    return [
      {
        name: 'momentum',
        passed: rsi14 > 55,         // gating: must pass for a hit
        detail: `RSI(14) is ${fmt(rsi14)}`,
        weight: 2,
        quality: ramp(rsi14, 55, 80), // 0..1, how convincing it is
      },
      {
        name: 'participation',
        passed: relativeVolume > 1,
        detail: `Volume is ${fmt(relativeVolume)}x average`,
        weight: 1,
        quality: ramp(relativeVolume, 1, 3),
        gate: false,                // scored, but never disqualifying
      },
    ];
  },
});
```

Register it in `src/strategies/index.ts` and it appears in the CLI, the
dashboard and `--list`.

## Layout

```
src/
  indicators.ts        SMA, EMA, RSI, ATR, Bollinger, ADX, returns, extremes
  scanner.ts           Fetch → indicators → strategies → rank
  strategies/          One file per family, plus the shared scorer
  providers/           Yahoo, synthetic sample data, on-disk cache
  universe.ts          Built-in symbol lists and file/inline resolution
  format.ts            Table, CSV and JSON output
  cli.ts               Command-line entry point
  server.ts            Dashboard server and JSON API
  web/index.html       The dashboard
tests/                 Vitest suites for all of the above
```

## Development

```bash
npm test          # vitest
npm run typecheck # source and tests
npm run build     # compile to dist/
```

Indicators are tested against known values (a flat series has zero band width, a
monotonic advance has RSI 100, a constant-range series has an ATR equal to that
range), and each strategy is tested on a hand-built series that should trigger it
and on a near miss that should not.

## Limitations

- Daily bars only. No intraday scanning, no options, no fundamentals.
- Yahoo's endpoint is unofficial; a scan is only as good as what it returns. If
  it starts refusing requests, `--provider sample` still works and a new provider
  is a single file.
- Index universes are static lists and drift from real index membership.
- Scores rank setups against the rules as written. They are not probabilities,
  and nothing here is backtested.
- This is a screening tool, not trading advice.
