// One-command backtest reproduction for hackathon judges.
//
// Run:    npm run reproduce
//
// What it does:
//   1. Loads the strategy from a bundled sample fixture (run-success.json — the
//      trend-following short that the README cites at +8.3% PnL).
//   2. Replays that EXACT parsed strategy through the SAME backtest engine the
//      app uses at runtime (agent/tools/local-backtest.ts -> runLocalBacktest)
//      over REAL Bitget public klines (BTCUSDT, 1h). No Qwen key needed, no
//      Bitget key needed.
//   3. Prints the freshly-computed metrics next to the values recorded in the
//      fixture, so a reviewer can confirm the published numbers come from a real
//      backtest and not a hand-typed screenshot.
//
// Honest caveat (also printed at run time): the fixture was captured on
// 2026-06-20. Re-running later re-pulls the most recent real klines, so the
// exact PnL can drift as the market moves — this is real-data variance, not
// fabrication. The trade structure (direction, EMA-cross entry, SL/TP) is
// identical and deterministic.

import { promises as fs } from 'node:fs';
import path from 'node:path';

// Silence the structured NDJSON logs that runLocalBacktest emits to stdout via
// the logger, so this script's human-readable output stays clean. We detect
// those lines by shape (single-line JSON with a "scope" field). Errors/warns
// still surface on stderr untouched.
const origLog = console.log;
console.log = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === 'string' && first.startsWith('{') && first.includes('"scope"')) return;
  origLog(...args);
};

// Defer the engine import until after the console shim is in place (module
// top-level logs would otherwise bypass it on some loaders).
const { runLocalBacktest } = await import('../agent/tools/local-backtest');
const types = await import('../lib/types');
type StrategySpec = types.StrategySpec;

const FIXTURE = path.join(process.cwd(), 'samples', 'run-success.json');

function pct(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : 'n/a';
}

async function main() {
  const argv = process.argv.slice(2);
  const fixturePath = argv[0] ? path.resolve(argv[0]) : FIXTURE;

  const raw = await fs.readFile(fixturePath, 'utf8');
  const bundle = JSON.parse(raw);
  const strategy = bundle.strategy as StrategySpec;
  if (!strategy?.structured_strategy) {
    throw new Error(`${fixturePath} has no strategy.structured_strategy — not a valid RunBundle fixture.`);
  }

  const recorded = bundle.backtest ?? {};
  const ss = strategy.structured_strategy;

  console.log('─'.repeat(64));
  console.log('TradeTrace — backtest reproduction (judge verification)');
  console.log('─'.repeat(64));
  console.log(`fixture          : ${path.relative(process.cwd(), fixturePath)}`);
  console.log(`strategy         : ${ss.direction.toUpperCase()} ${ss.symbol} @ ${ss.timeframe}`);
  console.log(`entry            : ${(ss.entry_conditions ?? []).join('; ')}`);
  console.log(`stop loss / TP   : ${ss.stop_loss} / ${ss.take_profit}`);
  console.log(`raw prompt       : ${strategy.raw_prompt}`);
  console.log('─'.repeat(64));
  console.log('replaying parsed strategy through runLocalBacktest()...');
  console.log('(pulls REAL Bitget public klines — BTCUSDT, 1h; no keys required)');
  console.log();

  const result = await runLocalBacktest('reproduce_judge', strategy);

  console.log('─'.repeat(64));
  console.log('RESULT vs. values recorded in the fixture');
  console.log('─'.repeat(64));
  const rows: [string, unknown, unknown][] = [
    ['pnl (%)', result.pnl, recorded.pnl],
    ['sharpe', result.sharpe, recorded.sharpe],
    ['max drawdown (%)', result.max_drawdown, recorded.max_drawdown],
    ['win rate (%)', result.win_rate, recorded.win_rate],
    ['trade count', result.trade_count, recorded.trade_count],
  ];
  console.log('metric'.padEnd(20), 'reproduced'.padStart(14), 'recorded'.padStart(14));
  for (const [name, got, want] of rows) {
    console.log(String(name).padEnd(20), String(got).padStart(14), String(want).padStart(14));
  }
  console.log();
  console.log(`provider  : ${result.provider}`);
  console.log(`period    : ${result.period}`);
  console.log(`status    : ${result.status}`);
  if (result.notes?.length) {
    console.log(`notes     : ${result.notes.join(' | ')}`);
  }
  console.log('─'.repeat(64));
  console.log('NOTE: the fixture was captured on 2026-06-20. Re-running later');
  console.log('re-pulls the latest real klines, so the exact PnL can drift as the');
  console.log('market advances — that is real-data variance, not fabrication. The');
  console.log('strategy (direction, EMA-cross entry, SL/TP, bar-close simulation) is');
  console.log('identical and fully deterministic.');
  console.log('─'.repeat(64));
  console.log(`reproduced backtest source: agent/tools/local-backtest.ts`);
  console.log(`replayed strategy source  : ${path.relative(process.cwd(), fixturePath)}`);
}

main().catch((err) => {
  console.error('reproduce failed:', err);
  process.exit(1);
});
