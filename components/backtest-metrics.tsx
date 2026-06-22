import type { BacktestResult } from '@/lib/types';

type Tone = 'good' | 'warn' | 'bad' | 'flat';

const toneColor: Record<Tone, string> = {
  good: 'var(--green)',
  warn: 'var(--amber)',
  bad: 'var(--red)',
  flat: 'var(--muted)',
};
const toneBg: Record<Tone, string> = {
  good: 'var(--green-bg)',
  warn: 'var(--amber-bg)',
  bad: 'var(--red-bg)',
  flat: 'rgba(255,255,255,0.03)',
};

function pnlTone(v: number): Tone {
  if (v > 0) return 'good';
  if (v < 0) return 'bad';
  return 'flat';
}
function sharpeTone(v: number): Tone {
  if (v >= 2) return 'good';
  if (v >= 1) return 'warn';
  if (v >= 0) return 'bad';
  return 'bad';
}
function drawdownTone(v: number): Tone {
  if (v < 10) return 'good';
  if (v <= 25) return 'warn';
  return 'bad';
}
function winRateTone(v: number): Tone {
  if (v >= 50) return 'good';
  if (v >= 40) return 'warn';
  return 'bad';
}

export function BacktestMetrics({ backtest }: { backtest: BacktestResult }) {
  const equity = backtest.chart?.equity_curve ?? [];
  const trades = backtest.chart?.trades ?? [];

  return (
    <div className="metric-grid" style={{ marginTop: 16 }}>
      <MetricCard label="PnL" value={`${backtest.pnl > 0 ? '+' : ''}${backtest.pnl}%`} tone={pnlTone(backtest.pnl)}>
        <EquitySpark equity={equity} tone={pnlTone(backtest.pnl)} />
      </MetricCard>
      <MetricCard label="Sharpe" value={String(backtest.sharpe)} tone={sharpeTone(backtest.sharpe)}>
        <TradeBars trades={trades} />
      </MetricCard>
      <MetricCard label="Max drawdown" value={`${backtest.max_drawdown}%`} tone={drawdownTone(backtest.max_drawdown)}>
        <DrawdownSpark equity={equity} />
      </MetricCard>
      <MetricCard label="Win rate" value={`${backtest.win_rate}%`} tone={winRateTone(backtest.win_rate)}>
        <WinLossDots trades={trades} />
      </MetricCard>
    </div>
  );
}

function MetricCard({ label, value, tone, children }: { label: string; value: string; tone: Tone; children?: React.ReactNode }) {
  return (
    <div className="metric-card" style={{ background: toneBg[tone], borderLeftColor: toneColor[tone] }}>
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value mono" style={{ color: tone === 'flat' ? 'var(--ink)' : toneColor[tone] }}>{value}</div>
      <div className="metric-card-spark">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparklines (inline SVG, fixed viewBox).
// ---------------------------------------------------------------------------

function EquitySpark({ equity, tone }: { equity: number[]; tone: Tone }) {
  if (equity.length < 2) return <EmptySpark />;
  const min = Math.min(...equity);
  const max = Math.max(...equity);
  const span = max - min || 1;
  const n = equity.length;
  const pts = equity.map((v, i) => `${(120 * i) / (n - 1)},${24 - ((v - min) / span) * 22}`).join(' ');
  const color = tone === 'flat' ? 'var(--muted)' : toneColor[tone];
  return (
    <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="spark-svg">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function DrawdownSpark({ equity }: { equity: number[] }) {
  if (equity.length < 2) return <EmptySpark />;
  let peak = equity[0];
  const dd = equity.map((v) => { peak = Math.max(peak, v); return peak > 0 ? (peak - v) / peak : 0; });
  const maxDd = Math.max(...dd, 0.0001);
  const n = dd.length;
  const pts = dd.map((v, i) => `${(120 * i) / (n - 1)},${22 - (v / maxDd) * 20}`).join(' ');
  return (
    <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="spark-svg">
      <polyline points={pts} fill="none" stroke="var(--red)" strokeWidth={1.5} opacity={0.8} />
    </svg>
  );
}

function TradeBars({ trades }: { trades: { return_pct: number }[] }) {
  if (trades.length < 2) return <EmptySpark />;
  const rets = trades.map((t) => t.return_pct);
  const maxAbs = Math.max(...rets.map((r) => Math.abs(r)), 0.0001);
  const n = rets.length;
  const slot = 120 / n;
  return (
    <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="spark-svg">
      {rets.map((r, i) => {
        const h = (Math.abs(r) / maxAbs) * 20;
        const up = r >= 0;
        return (
          <rect
            key={i}
            x={i * slot + slot * 0.15}
            y={up ? 12 - h : 12}
            width={slot * 0.7}
            height={Math.max(0.5, h)}
            fill={up ? 'var(--green)' : 'var(--red)'}
            opacity={0.85}
          />
        );
      })}
      <line x1={0} x2={120} y1={12} y2={12} stroke="var(--line-strong)" strokeWidth={0.5} />
    </svg>
  );
}

function WinLossDots({ trades }: { trades: { return_pct: number }[] }) {
  if (trades.length < 2) return <EmptySpark />;
  const n = trades.length;
  const slot = 120 / n;
  return (
    <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="spark-svg">
      {trades.map((t, i) => (
        <circle
          key={i}
          cx={i * slot + slot / 2}
          cy={t.return_pct >= 0 ? 8 : 16}
          r={Math.max(1.2, slot * 0.28)}
          fill={t.return_pct >= 0 ? 'var(--green)' : 'var(--red)'}
          opacity={0.85}
        />
      ))}
      <line x1={0} x2={120} y1={12} y2={12} stroke="var(--line-strong)" strokeWidth={0.5} />
    </svg>
  );
}

function EmptySpark() {
  return <div className="spark-empty" />;
}
