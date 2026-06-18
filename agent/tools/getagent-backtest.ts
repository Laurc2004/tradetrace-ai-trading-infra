import { requireEnv } from '@/lib/env';
import { makeId, nowIso } from '@/lib/id';
import { errorMeta, logError, logInfo, logWarn } from '@/lib/logger';
import type { BacktestResult, StrategySpec } from '@/lib/types';
import { gzipSync } from 'node:zlib';

const BITGET_API_BASE_URL = 'https://api.bitget.com';

/**
 * The Playbook control-plane wants the dedicated Playbook API Key as the
 * `ACCESS-KEY` header (minted from the Playbook page → create agent →
 * sub-account), NOT the regular Bitget OpenAPI key. Prefer the dedicated
 * `PLAYBOOK_ACCESS_KEY` when set, and fall back to `BITGET_API_KEY` for
 * backwards compatibility. Throws if neither is configured.
 */
function resolveAccessKey(): string {
  const playbookKey = process.env.PLAYBOOK_ACCESS_KEY;
  if (playbookKey) {
    logInfo('getagent.backtest', 'using dedicated Playbook API key', { source: 'PLAYBOOK_ACCESS_KEY' });
    return playbookKey;
  }
  const bitgetKey = process.env.BITGET_API_KEY;
  if (bitgetKey) {
    logWarn('getagent.backtest', 'PLAYBOOK_ACCESS_KEY not set; falling back to BITGET_API_KEY (regular Bitget key may 401/403 on Playbook endpoints)', { source: 'BITGET_API_KEY' });
    return bitgetKey;
  }
  return requireEnv('BITGET_API_KEY');
}

export async function runGetAgentBacktest(runId: string, strategy: StrategySpec): Promise<BacktestResult> {
  logInfo('getagent.backtest', 'starting GetAgent backtest flow', {
    runId,
    strategyId: strategy.strategy_id,
    symbol: strategy.structured_strategy.symbol,
  });

  try {
    const accessKey = resolveAccessKey();
    const draftId = await uploadTemporaryGetAgent(runId, accessKey, strategy);
    const getagentRunId = await dispatchRun(runId, accessKey, draftId);
    const completed = await pollRun(runId, accessKey, getagentRunId);
    const metrics = completed.metrics_output ?? completed.signal_output?.[0]?.metrics ?? {};
    const report = completed.backtest_report ?? {};

    const result = {
      backtest_id: getagentRunId,
      run_id: runId,
      provider: 'bitget_playbook' as const,
      period: report.period_start && report.period_end ? `${report.period_start} to ${report.period_end}` : 'playbook-run-period',
      pnl: Number(metrics.total_return_pct ?? metrics.pnl ?? 0),
      sharpe: Number(metrics.sharpe_ratio ?? metrics.sharpe ?? 0),
      win_rate: Number(metrics.win_rate ?? 0),
      max_drawdown: Number(metrics.max_drawdown_pct ?? metrics.max_drawdown ?? 0),
      trade_count: Number(metrics.total_trades ?? metrics.trade_count ?? 0),
      raw_summary_ref: `getagent:${draftId}:${getagentRunId}`,
      created_at: nowIso(),
    } satisfies BacktestResult;

    logInfo('getagent.backtest', 'GetAgent backtest completed', {
      runId,
      draftId,
      getagentRunId,
      pnl: result.pnl,
      sharpe: result.sharpe,
      maxDrawdown: result.max_drawdown,
      tradeCount: result.trade_count,
    });
    return result;
  } catch (error) {
    logError('getagent.backtest', 'GetAgent backtest flow failed', { runId, ...errorMeta(error) });
    throw error;
  }
}

async function uploadTemporaryGetAgent(runId: string, accessKey: string, strategy: StrategySpec) {
  const archive = buildGetAgentArchive(strategy);
  logInfo('getagent.upload', 'uploading temporary GetAgent package', {
    runId,
    strategyId: strategy.strategy_id,
    archiveBytes: archive.byteLength,
    endpoint: `${BITGET_API_BASE_URL}/api/v1/playbook/upload`,
  });

  const form = new FormData();
  form.append('package', new Blob([archive], { type: 'application/gzip' }), `${strategy.strategy_id}.tar.gz`);

  const response = await fetch(`${BITGET_API_BASE_URL}/api/v1/playbook/upload`, {
    method: 'POST',
    headers: { 'ACCESS-KEY': accessKey },
    body: form,
  });

  logInfo('getagent.upload', 'upload response received', { runId, status: response.status, ok: response.ok });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logWarn('getagent.upload', 'upload failed response body', { runId, status: response.status, body: body.slice(0, 1000) });
    throw new Error(`GetAgent upload failed: ${response.status} ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  const draftId = data.draft_id ?? data.version_id ?? data.getagent_id;
  if (!draftId) throw new Error('GetAgent upload response missing draft_id');
  logInfo('getagent.upload', 'temporary GetAgent package uploaded', { runId, draftId, strategyId: data.strategy_id });
  return String(draftId);
}

async function dispatchRun(runId: string, accessKey: string, draftId: string) {
  logInfo('getagent.run', 'dispatching GetAgent run', { runId, draftId });
  const response = await fetch(`${BITGET_API_BASE_URL}/api/v1/playbook/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'ACCESS-KEY': accessKey,
    },
    body: JSON.stringify({ version_id: draftId }),
  });

  logInfo('getagent.run', 'dispatch response received', { runId, status: response.status, ok: response.ok });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logWarn('getagent.run', 'dispatch failed response body', { runId, status: response.status, body: body.slice(0, 1000) });
    throw new Error(`GetAgent run dispatch failed: ${response.status} ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  if (!data.run_id) throw new Error('GetAgent dispatch response missing run_id');
  logInfo('getagent.run', 'GetAgent run dispatched', { runId, getagentRunId: data.run_id, draftId });
  return String(data.run_id);
}

async function pollRun(runId: string, accessKey: string, getagentRunId: string) {
  const url = `${BITGET_API_BASE_URL}/api/v1/playbook/run?run_id=${encodeURIComponent(getagentRunId)}`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(url, { headers: { 'ACCESS-KEY': accessKey } });
    logInfo('getagent.poll', 'poll response received', { runId, getagentRunId, attempt, status: response.status, ok: response.ok });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`GetAgent run poll failed: ${response.status} ${body.slice(0, 300)}`);
    }
    const data = await response.json();
    logInfo('getagent.poll', 'poll status parsed', { runId, getagentRunId, attempt, getagentStatus: data.status });
    if (data.status === 'completed') return data;
    if (data.status === 'failed') throw new Error(data.failure_reason || 'GetAgent run failed');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('GetAgent run timed out after 60 seconds');
}

function buildGetAgentArchive(strategy: StrategySpec) {
  const symbol = sanitizeSymbol(strategy.structured_strategy.symbol);
  const packageName = `tradetrace-${strategy.strategy_id}`.toLowerCase().replace(/_/g, '-').slice(0, 63);
  const files = new Map<string, string>();
  files.set('manifest.yaml', manifestYaml(packageName, symbol, strategy));
  files.set('backtest.yaml', backtestYaml(symbol));
  files.set('src/main.py', mainPy());
  files.set('src/strategy.py', strategyPy());
  return gzipSync(createTar(files));
}

function manifestYaml(name: string, symbol: string, strategy: StrategySpec) {
  const description = `TradeTrace generated audit strategy package for ${symbol}`;
  return `name: ${name}
display_name: "TradeTrace ${symbol} Audit Strategy"
version: "1.0.0"
description: "${description}"
long_description: |
  Temporary strategy package generated by TradeTrace Flight Recorder to create a managed
  backtest artifact for an AI trading-agent run. Original strategy:
  ${strategy.raw_prompt.replace(/\n/g, ' ').slice(0, 500)}
market_type: contract
trading_symbols: ["${symbol}"]
tags: ["tradetrace", "audit", "hackathon"]

decision_mode: deterministic
backtest_support: full
runtime_profile: deterministic
execution_mode: signal_only
follow_trade_supported: false

strategy_config:
  trading_symbols: ["${symbol}"]
  fast_period: 12
  slow_period: 26
  leverage: 1
  margin_budget: "100"
`;
}

function backtestYaml(symbol: string) {
  const base = symbol.replace('USDT', '');
  return `venue:
  name: BINANCE
  account_type: MARGIN
  oms_type: NETTING
  starting_balances:
    - amount: 100000
      currency: USDT

strategy:
  module: strategy
  class: EmaCrossStrategy
  config_class: EmaCrossStrategyConfig
  config:
    order_id_tag: "001"
    trade_size: "0.01"
    fast_period: 12
    slow_period: 26

execution:
  start: "2024-01-01T00:00:00Z"
  end: "2024-04-01T00:00:00Z"

instrument:
  id: ${symbol}.BINANCE
  kind: perpetual
  raw_symbol: ${symbol}
  base_currency: ${base}
  quote_currency: USDT
  settlement_currency: USDT
  price_precision: 2
  size_precision: 3
  price_increment: "0.01"
  size_increment: "0.001"
  lot_size: "0.001"
  maker_fee: "0.0002"
  taker_fee: "0.0005"
  bar_type: ${symbol}.BINANCE-1-HOUR-LAST-EXTERNAL
`;
}

function mainPy() {
  // Mirrors the official @bitget-ai/getagent-skill btc-ema-cross-demo entry
  // point (references/examples/.../src/main.py) so the generated package is a
  // fair, replayable backtest under the documented SDK contract.
  return `"""Entry point for the TradeTrace audit Playbook.

For backtest_support: full playbooks, the platform injects
runtime.evaluation_mode="historical" on /api/v1/playbook/run.
"""
import math
from typing import Any

from getagent import backtest, data, runtime


def _sanitize(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _sanitize_metrics(metrics: dict) -> dict:
    return {key: _sanitize(val) for key, val in metrics.items()}


def run() -> None:
    cfg = runtime.manifest.get("strategy_config", {}) or {}
    symbols = cfg.get("trading_symbols") or ["BTCUSDT"]
    symbol = symbols[0]

    bars = data.crypto.futures.kline(
        symbol=symbol,
        interval="1h",
        limit=1000,
    )
    replay_frame = backtest.prepare_frame(bars, datetime_index="date")

    if replay_frame.empty:
        runtime.emit_signal(
            action="watch",
            symbol=symbol,
            confidence=0.0,
            metrics={"rows": 0},
            meta={"reason": "no historical bars returned"},
        )
        return

    instrument_key = f"{symbol}.BINANCE"
    result = backtest.run(
        ohlcv_data={instrument_key: replay_frame},
        spec=runtime.backtest_spec,
    )

    chart_path = backtest.generate_chart(result)
    summary = result.summary or {}
    net_pnl_raw = summary.get("net_pnl", 0)
    try:
        net_pnl = float(net_pnl_raw or 0)
    except (TypeError, ValueError):
        net_pnl = 0.0

    action = "long" if net_pnl > 0 else "watch"
    metrics = _sanitize_metrics(
        {
            "total_return_pct": result.total_return_pct,
            "net_pnl": net_pnl,
            "starting_balance": summary.get("starting_balance"),
            "sharpe_ratio": result.sharpe_ratio,
            "max_drawdown_pct": result.max_drawdown_pct,
            "win_rate": result.win_rate,
            "total_trades": result.total_trades,
            "profit_factor": result.profit_factor,
            "rows": len(replay_frame),
        }
    )

    runtime.emit_signal(
        action=action,
        symbol=symbol,
        confidence=_sanitize(result.win_rate) or 0.0,
        metrics=metrics,
        meta={
            "chart_path": chart_path,
            "fast_period": cfg.get("fast_period"),
            "slow_period": cfg.get("slow_period"),
        },
    )


if __name__ == "__main__":
    run()
`;
}

function strategyPy() {
  // Official @bitget-ai/getagent-skill NautilusTrader EMA crossover strategy
  // (references/examples/.../src/strategy.py). The previous stub here declared
  // `class EmaCrossStrategy` but had no trading logic, which made every
  // backtest fail on start. This is the full reference implementation.
  return `from decimal import Decimal
from typing import Optional

from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.model.objects import Quantity
from nautilus_trader.trading.strategy import Strategy


class EmaCrossStrategyConfig(StrategyConfig):
    instrument_id: Optional[InstrumentId] = None
    bar_type: Optional[BarType] = None
    instrument_ids: tuple = ()
    bar_types: tuple = ()
    trade_size: str = "0.01"
    fast_period: int = 12
    slow_period: int = 26


class EmaCrossStrategy(Strategy):
    def __init__(self, config: EmaCrossStrategyConfig) -> None:
        super().__init__(config)
        self.cfg = config
        self._closes = []
        self._fast_ema = None
        self._slow_ema = None
        self._prev_diff = None
        self._position = "NONE"
        self._instrument = None

    def on_start(self) -> None:
        bar_type = self.cfg.bar_type or (
            self.cfg.bar_types[0] if self.cfg.bar_types else None
        )
        instrument_id = self.cfg.instrument_id or (
            self.cfg.instrument_ids[0] if self.cfg.instrument_ids else None
        )
        if bar_type is None or instrument_id is None:
            raise RuntimeError("bar_type and instrument_id must be set")
        self._instrument = self.cache.instrument(instrument_id)
        self.subscribe_bars(bar_type)

    def on_bar(self, bar: Bar) -> None:
        close = float(bar.close)
        self._closes.append(close)

        warmup = max(self.cfg.slow_period, self.cfg.fast_period) + 1
        if len(self._closes) < warmup:
            self._fast_ema = self._update_ema(self._fast_ema, close, self.cfg.fast_period)
            self._slow_ema = self._update_ema(self._slow_ema, close, self.cfg.slow_period)
            return

        self._fast_ema = self._update_ema(self._fast_ema, close, self.cfg.fast_period)
        self._slow_ema = self._update_ema(self._slow_ema, close, self.cfg.slow_period)

        diff = self._fast_ema - self._slow_ema
        if self._prev_diff is None:
            self._prev_diff = diff
            return

        cross_up = self._prev_diff <= 0.0 < diff
        cross_down = self._prev_diff >= 0.0 > diff
        self._prev_diff = diff

        instrument = self._instrument
        if instrument is None:
            return
        qty = Quantity(Decimal(self.cfg.trade_size), instrument.size_precision)

        if self._position == "NONE":
            if cross_up:
                self._submit(instrument.id, OrderSide.BUY, qty)
                self._position = "LONG"
            elif cross_down:
                self._submit(instrument.id, OrderSide.SELL, qty)
                self._position = "SHORT"
            return

        if self._position == "LONG" and cross_down:
            self._close_open(instrument.id, OrderSide.SELL)
            self._position = "NONE"
        elif self._position == "SHORT" and cross_up:
            self._close_open(instrument.id, OrderSide.BUY)
            self._position = "NONE"

    @staticmethod
    def _update_ema(prev, value: float, period: int) -> float:
        if prev is None:
            return value
        alpha = 2.0 / (period + 1)
        return alpha * value + (1.0 - alpha) * prev

    def _submit(self, instrument_id: InstrumentId, side: OrderSide, quantity: Quantity) -> None:
        order = self.order_factory.market(
            instrument_id=instrument_id,
            order_side=side,
            quantity=quantity,
            time_in_force=TimeInForce.GTC,
        )
        self.submit_order(order)

    def _close_open(self, instrument_id: InstrumentId, side: OrderSide) -> None:
        for position in self.cache.positions_open(instrument_id=instrument_id):
            self._submit(instrument_id, side, position.quantity)

    def on_stop(self) -> None:
        if self._instrument is not None:
            self.cancel_all_orders(self._instrument.id)
            self.close_all_positions(self._instrument.id)
`;
}

function sanitizeSymbol(symbol: string) {
  const upper = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.endsWith('USDT')) return upper;
  return 'BTCUSDT';
}

function createTar(files: Map<string, string>) {
  const chunks: Buffer[] = [];
  for (const [name, content] of files) {
    const body = Buffer.from(content, 'utf8');
    chunks.push(tarHeader(name, body.length));
    chunks.push(body);
    chunks.push(Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

function tarHeader(name: string, size: number) {
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  writeOctal(header, size, 124, 12);
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12);
  header.fill(' ', 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeOctal(header, checksum, 148, 8);
  return header;
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number) {
  const text = value.toString(8).padStart(length - 1, '0').slice(0, length - 1) + '\0';
  buffer.write(text, offset, length, 'ascii');
}
