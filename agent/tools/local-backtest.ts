import { promises as fs } from 'node:fs';
import path from 'node:path';
import { clamp, makeId, nowIso } from '@/lib/id';
import { errorMeta, logError, logInfo, logWarn } from '@/lib/logger';
import type { BacktestCandle, BacktestChart, BacktestResult, BacktestTrade, StrategySpec } from '@/lib/types';

/**
 * Local deterministic backtest engine.
 *
 * Replaces the removed Bitget GetAgent/Playbook integration. Pulls real
 * historical OHLCV from Bitget's *public* market-data endpoints (the same
 * endpoints the Agent Hub `spot_get_candles` / `futures_get_candles` skills
 * call) — no API key required — and replays a parsed strategy against it.
 *
 * This is a replayable, explainable backtest, NOT live exchange matching. We
 * are honest about that in the UI and reports.
 */

const BITGET_API_BASE_URL = 'https://api.bitget.com';
const CACHE_DIR = path.join(process.cwd(), 'data', 'klines-cache');

// Map our internal timeframe values to Bitget's granularity enum.
// Spot uses lowercase (1h, 4h, 1day); futures uses uppercase (1H, 4H, 1D).
const SPOT_GRANULARITY: Record<string, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '4h': '4h',
  '6h': '6h',
  '12h': '12h',
  '1d': '1day',
  '1w': '1week',
};

const GRANULARITY_MS: Record<string, number> = {
  '1min': 60_000,
  '5min': 5 * 60_000,
  '15min': 15 * 60_000,
  '30min': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1day': 24 * 60 * 60_000,
  '1week': 7 * 24 * 60 * 60_000,
};

export interface Candle {
  ts: number; // open time, ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Run a deterministic local backtest for a parsed strategy.
 *
 * Fetches real candles from Bitget public endpoints, interprets the parsed
 * strategy into executable rules (EMA cross / RSI / momentum fallback), and
 * returns real PnL / Sharpe / drawdown / win-rate metrics.
 *
 * Throws on failure (data fetch error, empty series, etc.) so the orchestrator
 * can surface an explicit `backtest_failed` status instead of silently
 * degrading.
 */
export async function runLocalBacktest(runId: string, strategy: StrategySpec): Promise<BacktestResult> {
  const s = strategy.structured_strategy;
  const symbol = sanitizeSymbol(s.symbol);
  const granularity = resolveGranularity(s.timeframe);
  const windowBars = 2000; // ~ Enough bars for warmup + a meaningful sample.

  logInfo('backtest.local', 'starting local deterministic backtest', {
    runId,
    strategyId: strategy.strategy_id,
    symbol,
    granularity,
    windowBars,
  });

  const candles = await fetchCandles(runId, symbol, granularity, windowBars);
  if (candles.length < 60) {
    throw new Error(`Insufficient historical candles for ${symbol} (${candles.length} rows); need at least 60`);
  }

  const plan = interpretStrategy(strategy);
  const equity = simulate(candles, plan);
  const metrics = computeMetrics(equity, candles);

  const first = candles[0];
  const last = candles[candles.length - 1];
  const period = `${new Date(first.ts).toISOString().slice(0, 10)} to ${new Date(last.ts).toISOString().slice(0, 10)}`;

  // Build the chart payload: keep the most recent ~120 candles for the SVG
  // (dense enough to read, sparse enough to render). The equity curve is
  // indexed by candle position (curve[j] == mark-to-market at candles[j+1]),
  // so we slice both to the same trailing window for alignment.
  const CHART_BARS = 120;
  const chart = buildChart(candles, equity.equityCurve, equity.trades, CHART_BARS);

  const result: BacktestResult = {
    backtest_id: makeId('local_backtest'),
    run_id: runId,
    provider: 'local_deterministic',
    period,
    pnl: round(metrics.totalReturnPct, 2),
    sharpe: round(metrics.sharpe, 2),
    win_rate: round(metrics.winRate * 100, 1),
    max_drawdown: round(metrics.maxDrawdownPct, 2),
    trade_count: metrics.tradeCount,
    raw_summary_ref: `local:${symbol}:${granularity}:${plan.kind}:bars=${candles.length}`,
    status: 'live',
    chart,
    notes: [
      `Local deterministic backtest over ${candles.length} real Bitget public klines (${symbol}, ${granularity}).`,
      `Interpreted as ${plan.kind} (fast EMA ${plan.fast}, slow EMA ${plan.slow}, direction ${plan.direction}).`,
      `Risk controls: stop-loss ${plan.stopLossPct ? `${(plan.stopLossPct * 100).toFixed(1)}%` : 'none'}, take-profit ${plan.takeProfitPct ? `${(plan.takeProfitPct * 100).toFixed(1)}%` : 'none'}.`,
      'This is a bar-close simulation on historical data, not live exchange matching. Metrics are deterministic and reproducible from the cached klines.',
      ...plan.notes,
    ],
    created_at: nowIso(),
  };

  logInfo('backtest.local', 'local backtest completed', {
    runId,
    symbol,
    plan: plan.kind,
    bars: candles.length,
    pnl: result.pnl,
    sharpe: result.sharpe,
    maxDrawdown: result.max_drawdown,
    trades: result.trade_count,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Strategy interpretation — turn parsed free-text fields into executable rules.
// ---------------------------------------------------------------------------

export type StrategyKind = 'ema_cross' | 'momentum' | 'mean_reversion';

export interface ExecutionPlan {
  kind: StrategyKind;
  fast: number;
  slow: number;
  direction: 'long' | 'short' | 'both';
  stopLossPct: number | null; // e.g. 0.015 = 1.5%
  takeProfitPct: number | null;
  rsiLower?: number;
  rsiUpper?: number;
  notes: string[];
}

/**
 * Interpret the parsed strategy into a concrete execution plan.
 *
 * The Qwen parser yields free-text entry/exit conditions plus optional numeric
 * constraints. We pattern-match the common cases (EMA crossover, RSI band,
 * trend/momentum) and fall back to a sensible default so every strategy yields
 * a runnable plan. The returned `notes` explain what was interpreted, which is
 * surfaced in the audit trail.
 */
export function interpretStrategy(strategy: StrategySpec): ExecutionPlan {
  const s = strategy.structured_strategy;
  const text = [
    ...s.entry_conditions,
    ...s.exit_conditions,
    strategy.raw_prompt,
  ].join(' ').toLowerCase();

  const fast = extractPeriod(text, 'fast', 12);
  const slow = Math.max(extractPeriod(text, 'slow', 26), fast + 4);
  const stopLossPct = parsePercent(s.stop_loss);
  const takeProfitPct = parsePercent(s.take_profit);

  const direction: ExecutionPlan['direction'] = ['short', '做空', '空'].some((k) => text.includes(k))
    ? 'short'
    : ['both', '多空', '双向'].some((k) => text.includes(k))
      ? 'both'
      : 'long';

  let kind: StrategyKind = 'ema_cross';
  const notes: string[] = [];

  if (/\brsi\b|相对强弱|超买|超卖/.test(text)) {
    kind = 'mean_reversion';
    notes.push('Detected RSI/overbought-oversold language → mean-reversion plan.');
  } else if (/ema|均线|exponential|趋势|trend|momentum|动量/.test(text) || /ema\s*\d+/.test(text)) {
    kind = 'ema_cross';
    notes.push(`Detected EMA/trend language → EMA crossover (fast=${fast}, slow=${slow}).`);
  } else if (/突破|breakout|新高|new high|趋势跟随/.test(text)) {
    kind = 'momentum';
    notes.push('Detected breakout/momentum language → momentum plan.');
  } else {
    notes.push(`No specific signal language detected → default EMA crossover (fast=${fast}, slow=${slow}).`);
  }

  if (stopLossPct == null) notes.push('No stop-loss parsed; simulation will ride positions to the next exit signal.');
  if (takeProfitPct == null) notes.push('No take-profit parsed; exits driven by signal flip.');

  const rsiLower = kind === 'mean_reversion' ? 30 : undefined;
  const rsiUpper = kind === 'mean_reversion' ? 70 : undefined;

  return { kind, fast, slow, direction, stopLossPct, takeProfitPct, rsiLower, rsiUpper, notes };
}

// ---------------------------------------------------------------------------
// Simulation — deterministic event-loop over the candle series.
// ---------------------------------------------------------------------------

interface Position {
  side: 'long' | 'short';
  entry: number;
  entryTs: number;
}

interface SimResult {
  equityCurve: number[];
  tradeReturns: number[]; // per-trade fractional returns (e.g. 0.012 = +1.2%)
  tradeCount: number;
  trades: BacktestTrade[]; // per-trade markers for charting
}

/**
 * Simulate the plan against the candle series. Uses a single position at a time,
 * fixed-fractional sizing, and a bar-close evaluation. Returns the equity curve
 * (indexed to 1.0 start) and per-trade returns.
 */
export function simulate(candles: Candle[], plan: ExecutionPlan): SimResult {
  const closes = candles.map((c) => c.close);
  const fastEma = emaSeries(closes, plan.fast);
  const slowEma = emaSeries(closes, plan.slow);
  const rsi = rsiSeries(closes, 14);

  let position: Position | null = null;
  const tradeReturns: number[] = [];
  const trades: BacktestTrade[] = [];
  let equity = 1.0;
  const equityCurve: number[] = [];

  for (let i = 1; i < candles.length; i += 1) {
    const bar = candles[i];
    const prevBar = candles[i - 1];

    // Manage open position first (stop / target / signal-flip exits), then entries.
    if (position) {
      let exitPrice: number | null = null;
      let reason: BacktestTrade['reason'] = 'signal-flip';

      if (position.side === 'long') {
        if (plan.stopLossPct && bar.low <= position.entry * (1 - plan.stopLossPct)) {
          exitPrice = position.entry * (1 - plan.stopLossPct);
          reason = 'stop-loss';
        } else if (plan.takeProfitPct && bar.high >= position.entry * (1 + plan.takeProfitPct)) {
          exitPrice = position.entry * (1 + plan.takeProfitPct);
          reason = 'take-profit';
        } else if (exitSignal(plan, 'long', i, fastEma, slowEma, rsi, prevBar, bar)) {
          exitPrice = bar.close;
          reason = 'signal-flip';
        }
      } else {
        if (plan.stopLossPct && bar.high >= position.entry * (1 + plan.stopLossPct)) {
          exitPrice = position.entry * (1 + plan.stopLossPct);
          reason = 'stop-loss';
        } else if (plan.takeProfitPct && bar.low <= position.entry * (1 - plan.takeProfitPct)) {
          exitPrice = position.entry * (1 - plan.takeProfitPct);
          reason = 'take-profit';
        } else if (exitSignal(plan, 'short', i, fastEma, slowEma, rsi, prevBar, bar)) {
          exitPrice = bar.close;
          reason = 'signal-flip';
        }
      }

      if (exitPrice != null) {
        const ret = position.side === 'long'
          ? exitPrice / position.entry - 1
          : 1 - exitPrice / position.entry;
        equity *= 1 + ret;
        tradeReturns.push(ret);
        trades.push({
          side: position.side,
          entry_ts: position.entryTs,
          entry_price: position.entry,
          exit_ts: bar.ts,
          exit_price: exitPrice,
          return_pct: round(ret * 100, 2),
          reason,
        });
        position = null;
      }
    }

    if (!position) {
      const wantLong = entrySignal(plan, 'long', i, fastEma, slowEma, rsi);
      const wantShort = plan.direction !== 'long' && entrySignal(plan, 'short', i, fastEma, slowEma, rsi);
      if (plan.direction === 'short' && wantShort) {
        position = { side: 'short', entry: bar.close, entryTs: bar.ts };
      } else if (plan.direction === 'long' && wantLong) {
        position = { side: 'long', entry: bar.close, entryTs: bar.ts };
      } else if (plan.direction === 'both') {
        if (wantLong) position = { side: 'long', entry: bar.close, entryTs: bar.ts };
        else if (wantShort) position = { side: 'short', entry: bar.close, entryTs: bar.ts };
      }
    }

    // Mark-to-market equity at bar close.
    const markEquity = position
      ? equity * (1 + (position.side === 'long' ? bar.close / position.entry - 1 : 1 - bar.close / position.entry))
      : equity;
    equityCurve.push(markEquity);
  }

  return { equityCurve, tradeReturns, tradeCount: tradeReturns.length, trades };
}

function entrySignal(
  plan: ExecutionPlan,
  side: 'long' | 'short',
  i: number,
  fast: number[],
  slow: number[],
  rsi: (number | null)[],
): boolean {
  if (i < 2) return false;
  if (plan.kind === 'ema_cross' || plan.kind === 'momentum') {
    const crossUp = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
    const crossDown = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];
    return side === 'long' ? crossUp : crossDown;
  }
  if (plan.kind === 'mean_reversion') {
    const r = rsi[i];
    if (r == null) return false;
    return side === 'long' ? r <= (plan.rsiLower ?? 30) : r >= (plan.rsiUpper ?? 70);
  }
  return false;
}

function exitSignal(
  plan: ExecutionPlan,
  side: 'long' | 'short',
  i: number,
  fast: number[],
  slow: number[],
  rsi: (number | null)[],
  _prevBar: Candle,
  _bar: Candle,
): boolean {
  if (plan.kind === 'ema_cross' || plan.kind === 'momentum') {
    const crossUp = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
    const crossDown = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];
    return side === 'long' ? crossDown : crossUp;
  }
  if (plan.kind === 'mean_reversion') {
    const r = rsi[i];
    if (r == null) return false;
    return side === 'long' ? r >= (plan.rsiUpper ?? 70) : r <= (plan.rsiLower ?? 30);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Indicators.
// ---------------------------------------------------------------------------

export function emaSeries(values: number[], period: number): number[] {
  const out: number[] = [];
  const alpha = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (prev == null) {
      prev = v;
    } else {
      prev = alpha * v + (1 - alpha) * prev;
    }
    out.push(prev);
  }
  return out;
}

export function rsiSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Metrics.
// ---------------------------------------------------------------------------

interface Metrics {
  totalReturnPct: number;
  sharpe: number;
  maxDrawdownPct: number;
  winRate: number;
  tradeCount: number;
}

export function computeMetrics(sim: SimResult, candles: Candle[]): Metrics {
  const curve = sim.equityCurve.length ? sim.equityCurve : [1];
  const final = curve[curve.length - 1];
  const totalReturnPct = (final - 1) * 100;

  // Per-bar returns for Sharpe (annualized using the candle granularity).
  const barReturns: number[] = [];
  for (let i = 1; i < curve.length; i += 1) {
    barReturns.push(curve[i] / curve[i - 1] - 1);
  }
  const mean = avg(barReturns);
  const sd = stdDev(barReturns, mean);
  const granularity = candles.length > 1 ? inferGranularityFromCandles(candles) : '1h';
  const barsPerYear = barsPerYearFor(granularity);
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(barsPerYear) : 0;

  // Max drawdown over the equity curve.
  let peak = curve[0];
  let maxDd = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  const wins = sim.tradeReturns.filter((r) => r > 0).length;
  const winRate = sim.tradeReturns.length ? wins / sim.tradeReturns.length : 0;

  return {
    totalReturnPct,
    sharpe,
    maxDrawdownPct: maxDd * 100,
    winRate,
    tradeCount: sim.tradeReturns.length,
  };
}

// ---------------------------------------------------------------------------
// Data fetching — Bitget public candle endpoints, with on-disk cache.
// ---------------------------------------------------------------------------

async function fetchCandles(runId: string, symbol: string, granularity: string, windowBars: number): Promise<Candle[]> {
  const cacheFile = path.join(CACHE_DIR, `${symbol}_${granularity}_${windowBars}.json`);
  const cached = await readCache(cacheFile);
  if (cached && cached.length >= windowBars * 0.9 && isFresh(cached)) {
    logInfo('backtest.local', 'using cached klines', { runId, symbol, granularity, rows: cached.length });
    return cached;
  }

  const limit = Math.min(windowBars, 1000);
  const url = `${BITGET_API_BASE_URL}/api/v2/spot/market/candles?symbol=${symbol}&granularity=${granularity}&limit=${limit}`;
  logInfo('backtest.local', 'fetching public klines', { runId, url, symbol, granularity });

  const response = await fetch(url, { method: 'GET' });
  logInfo('backtest.local', 'klines response received', { runId, status: response.status, ok: response.ok });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Bitget public klines fetch failed: ${response.status} ${body.slice(0, 300)}`);
  }
  const data = (await response.json()) as { code: string; msg: string; data: string[][] };
  if (data.code !== '00000') {
    throw new Error(`Bitget klines error: ${data.code} ${data.msg}`);
  }
  if (!Array.isArray(data.data) || data.data.length === 0) {
    throw new Error(`Bitget returned no candles for ${symbol}`);
  }

  // Bitget returns newest-first; reverse to chronological.
  const candles = data.data
    .map((row) => parseCandle(row))
    .filter((c): c is Candle => c != null)
    .sort((a, b) => a.ts - b.ts);

  logInfo('backtest.local', 'klines parsed', { runId, rows: candles.length });
  await writeCache(cacheFile, candles);
  return candles;
}

function parseCandle(row: string[]): Candle | null {
  if (!row || row.length < 5) return null;
  const [ts, open, high, low, close, volume] = row;
  const c: Candle = {
    ts: Number(ts),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: volume ? Number(volume) : 0,
  };
  if ([c.open, c.high, c.low, c.close].some((n) => !Number.isFinite(n))) return null;
  return c;
}

async function readCache(file: string): Promise<Candle[] | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as Candle[];
  } catch {
    return null;
  }
}

async function writeCache(file: string, candles: Candle[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(candles), 'utf8');
  } catch (error) {
    logWarn('backtest.local', 'failed to write kline cache', { file, ...errorMeta(error) });
  }
}

function isFresh(candles: Candle[]): boolean {
  if (!candles.length) return false;
  const age = Date.now() - candles[candles.length - 1].ts;
  return age < 24 * 60 * 60 * 1000; // cache valid for 1 day
}

// ---------------------------------------------------------------------------
// Chart payload.
// ---------------------------------------------------------------------------

/**
 * Assemble the chart payload from the full candle series, equity curve, and
 * per-trade markers. Keeps only the trailing `maxBars` candles so the SVG
 * stays readable (the full ~2000-bar window is too dense to render).
 *
 * Alignment: `equityCurve[j]` is the mark-to-market at `candles[j+1]`. We keep
 * the last `maxBars` candles and the last `maxBars` equity points so both
 * arrays line up index-for-index with the visible window. Trades whose exit
 * falls inside the window are kept (their entry may predate it — that's fine,
 * the entry marker just won't render on-screen).
 */
/**
 * Assemble the chart payload covering the WHOLE backtest period. The full
 * series (~2000 bars) is too dense to render as individual candles, so we
 * aggregate it into at most `maxBars` buckets by OHLC-merging equal-sized
 * groups. The equity curve is sampled once per bucket (close of last bar in
 * the bucket). Trades are ALL kept — they index into the full timeline and
 * the client maps them onto the bucket x-axis, so every entry/exit stays
 * visible regardless of where in the period it occurred.
 */
function buildChart(candles: Candle[], equityCurve: number[], trades: BacktestTrade[], maxBars: number): BacktestChart {
  const n = candles.length;
  if (n === 0) return { candles: [], equity_curve: [], trades };
  const bucketSize = Math.max(1, Math.ceil(n / maxBars));

  const aggCandles: BacktestCandle[] = [];
  const aggEquity: number[] = [];
  for (let i = 0; i < n; i += bucketSize) {
    const slice = candles.slice(i, i + bucketSize);
    if (slice.length === 0) continue;
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    aggCandles.push({
      ts: slice[slice.length - 1].ts,
      open: slice[0].open,
      high,
      low,
      close: slice[slice.length - 1].close,
    });
    // equityCurve[j] corresponds to candles[j+1]; sample the equity at the last
    // bar of the bucket (index n-1 maps to equityCurve.length-1).
    const eqIdx = Math.min(i + slice.length, equityCurve.length - 1);
    aggEquity.push(equityCurve[Math.max(0, eqIdx)]);
  }

  return { candles: aggCandles, equity_curve: aggEquity, trades };
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function sanitizeSymbol(symbol: string): string {
  const upper = (symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return upper.endsWith('USDT') ? upper : 'BTCUSDT';
}

function resolveGranularity(timeframe: string): string {
  const key = (timeframe || '1h').toLowerCase();
  return SPOT_GRANULARITY[key] ?? '1h';
}

function inferGranularityFromCandles(candles: Candle[]): string {
  if (candles.length < 2) return '1h';
  const delta = candles[1].ts - candles[0].ts;
  const match = Object.entries(GRANULARITY_MS).find(([, ms]) => Math.abs(ms - delta) < ms * 0.1);
  return match?.[0] ?? '1h';
}

function barsPerYearFor(granularity: string): number {
  const ms = GRANULARITY_MS[granularity] ?? GRANULARITY_MS['1h'];
  return Math.round((365 * 24 * 60 * 60 * 1000) / ms);
}

function extractPeriod(text: string, label: 'fast' | 'slow', fallback: number): number {
  const re = label === 'fast' ? /(?:fast|短期|快线|ema)\s*(\d{1,3})/ : /(?:slow|长期|慢线|ema)\s*(\d{1,3})/;
  const m = text.match(re);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 2 && n <= 400) return n;
  }
  const all = [...text.matchAll(/ema\s*(\d{1,3})/gi)].map((mm) => Number(mm[1])).filter((n) => n >= 2 && n <= 400);
  if (all.length >= 2) return label === 'fast' ? Math.min(...all) : Math.max(...all);
  return fallback;
}

function parsePercent(value: string | null): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Treat bare numbers as percent; values <= 1 as fraction (e.g. 0.015).
  const pct = n <= 1 ? n : n / 100;
  return clamp(pct, 0.001, 0.5);
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
