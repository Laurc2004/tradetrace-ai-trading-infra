'use client';

import { useId } from 'react';
import type { BacktestChart, BacktestTrade } from '@/lib/types';

const CHART_W = 760;
const PRICE_H = 280;
const EQUITY_H = 120;
const PAD_L = 8;
const PAD_R = 8;
const GAP = 16;

type Props = { chart: BacktestChart };

export function BacktestChart({ chart }: Props) {
  const gradId = useId();
  const { candles, equity_curve, trades } = chart;
  if (candles.length < 2) return null;

  const priceChart = renderPriceChart(candles, trades, gradId);
  const equityChart = renderEquityChart(candles, equity_curve, gradId);

  return (
    <div className="backtest-chart" style={{ marginTop: 16 }}>
      <div className="chart-label">Price action · entry / exit markers</div>
      <svg viewBox={`0 0 ${CHART_W} ${PRICE_H}`} className="bt-svg" role="img" aria-label="Backtest price chart">
        {priceChart}
      </svg>
      <div className="chart-label" style={{ marginTop: GAP }}>Equity curve · drawdown in red</div>
      <svg viewBox={`0 0 ${CHART_W} ${EQUITY_H}`} className="bt-svg" role="img" aria-label="Backtest equity curve">
        {equityChart}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price chart — candles + trade markers.
// ---------------------------------------------------------------------------

function renderPriceChart(candles: BacktestChart['candles'], trades: BacktestTrade[], gradId: string) {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  let max = Math.max(...highs);
  let min = Math.min(...lows);
  // Pad the range so markers near the edges aren't clipped.
  const pad = (max - min) * 0.06 || max * 0.01;
  max += pad;
  min -= pad;

  const plotW = CHART_W - PAD_L - PAD_R;
  const slot = plotW / candles.length;
  const bodyW = Math.max(1.5, slot * 0.62);
  const x = (i: number) => PAD_L + slot * (i + 0.5);
  const y = (price: number) => ((max - price) / (max - min)) * PRICE_H;

  const firstTs = candles[0].ts;
  const lastTs = candles[candles.length - 1].ts;
  const xForTs = (ts: number) => {
    if (lastTs === firstTs) return CHART_W / 2;
    return PAD_L + ((ts - firstTs) / (lastTs - firstTs)) * plotW;
  };

  const candleEls = candles.map((c, i) => {
    const cx = x(i);
    const up = c.close >= c.open;
    const color = up ? 'var(--green)' : 'var(--red)';
    const yHigh = y(c.high);
    const yLow = y(c.low);
    const yOpen = y(c.open);
    const yClose = y(c.close);
    const top = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    return (
      <g key={c.ts}>
        <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} opacity={0.9} />
        <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bodyH} fill={color} opacity={0.92} />
      </g>
    );
  });

  // Trade markers: triangle at entry price, hollow dot at exit price.
  const markerEls = trades.map((t) => {
    const ex = xForTs(t.exit_ts);
    const ey = y(t.exit_price);
    const inWindow = t.entry_ts >= firstTs;
    const entryEl = inWindow ? (
      t.side === 'long' ? (
        <polygon points={`${xForTs(t.entry_ts)},${y(t.entry_price)} ${xForTs(t.entry_ts) - 4},${y(t.entry_price) + 7} ${xForTs(t.entry_ts) + 4},${y(t.entry_price) + 7}`} fill="var(--green)" />
      ) : (
        <polygon points={`${xForTs(t.entry_ts)},${y(t.entry_price)} ${xForTs(t.entry_ts) - 4},${y(t.entry_price) - 7} ${xForTs(t.entry_ts) + 4},${y(t.entry_price) - 7}`} fill="var(--red)" />
      )
    ) : null;
    const exitColor = t.reason === 'stop-loss' ? 'var(--red)' : t.reason === 'take-profit' ? 'var(--green)' : 'var(--muted)';
    return (
      <g key={`${t.entry_ts}-${t.exit_ts}`}>
        {entryEl}
        <circle cx={ex} cy={ey} r={2.6} fill="none" stroke={exitColor} strokeWidth={1.4} />
      </g>
    );
  });

  return (
    <>
      <defs>
        <linearGradient id={`${gradId}-pfade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bg-elev)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--bg-elev)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect x={PAD_L} y={0} width={plotW} height={PRICE_H} fill={`url(#${gradId}-pfade)`} />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD_L} x2={CHART_W - PAD_R} y1={PRICE_H * f} y2={PRICE_H * f} stroke="var(--line)" strokeWidth={1} />
      ))}
      {candleEls}
      {markerEls}
    </>
  );
}

// ---------------------------------------------------------------------------
// Equity curve — green when above start (1.0), red when below.
// ---------------------------------------------------------------------------

function renderEquityChart(candles: BacktestChart['candles'], equity: number[], gradId: string) {
  if (equity.length < 2) return null;
  // Align equity points to candles (equity[j] ~ candles[j+1]); for the visible
  // window we treat equity as sampled at the candle close it corresponds to.
  const eq = equity.length > candles.length ? equity.slice(equity.length - candles.length) : equity;
  const n = eq.length;
  const min = Math.min(...eq, 1);
  const max = Math.max(...eq, 1);
  const span = max - min || 1;

  const plotW = CHART_W - PAD_L - PAD_R;
  const x = (i: number) => PAD_L + (plotW * i) / Math.max(1, n - 1);
  const y = (v: number) => EQUITY_H - ((v - min) / span) * (EQUITY_H - 8) - 4;

  const baselineY = y(1);
  const pts = eq.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const areaPts = `${x(0)},${baselineY} ${pts} ${x(n - 1)},${baselineY}`;

  // Drawdown shading: area between curve and running peak, in red.
  let peak = eq[0];
  const ddSegs: string[] = [];
  let segStart = 0;
  for (let i = 0; i < n; i += 1) {
    peak = Math.max(peak, eq[i]);
    const inDd = eq[i] < peak;
    const nextInDd = i + 1 < n && eq[i + 1] < Math.max(peak, eq[i + 1]);
    if (inDd && !nextInDd) {
      const seg = eq.slice(segStart, i + 1).map((v, j) => `${x(segStart + j)},${y(v)}`).join(' ');
      ddSegs.push(seg);
      segStart = i + 1;
    } else if (!inDd) {
      segStart = i;
    }
  }

  return (
    <>
      <defs>
        <linearGradient id={`${gradId}-eq`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={PAD_L} x2={CHART_W - PAD_R} y1={baselineY} y2={baselineY} stroke="var(--subtle)" strokeWidth={1} strokeDasharray="3 3" />
      <polygon points={areaPts} fill={`url(#${gradId}-eq)`} />
      {ddSegs.length > 0 && ddSegs.map((seg, i) => (
        <polyline key={i} points={seg} fill="none" stroke="var(--red)" strokeWidth={1.6} opacity={0.85} />
      ))}
      <polyline points={pts} fill="none" stroke="var(--green)" strokeWidth={1.8} strokeLinejoin="round" />
    </>
  );
}
