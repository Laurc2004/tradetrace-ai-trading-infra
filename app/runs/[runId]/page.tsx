import { notFound } from 'next/navigation';
import { ApprovalActions } from '@/components/approval-actions';
import { EvidencePackPanel } from '@/components/evidence-pack';
import { ReportPanel } from '@/components/report-panel';
import { RiskLedger } from '@/components/risk-ledger';
import { StatusPill } from '@/components/status-pill';
import { Timeline } from '@/components/timeline';
import { getRun } from '@/lib/store';
import type { BacktestResult } from '@/lib/types';

type Props = { params: Promise<{ runId: string }> };

function backtestProviderLabel(bt: BacktestResult): string {
  switch (bt.provider) {
    case 'local_deterministic':
      return bt.status === 'failed' ? 'Local backtest (failed)' : 'Local deterministic backtest · Bitget public klines';
    case 'replay_fixture':
      return 'Replay fixture (captured from a real local backtest)';
    case 'degraded_estimate':
      return 'Degraded estimate (no real backtest ran)';
    default:
      return bt.provider;
  }
}

export default async function RunDetailPage({ params }: Props) {
  const { runId } = await params;
  const bundle = await getRun(runId);
  if (!bundle) notFound();

  return (
    <main>
      <div className="kicker">Flight Recorder</div>
      <h1 className="mono" style={{ fontSize: 32, marginTop: 14 }}>{bundle.run.run_id}</h1>

      <div className="grid three" style={{ marginTop: 32 }}>
        <div className="panel metric"><span>Status</span><strong><StatusPill status={bundle.run.status} /></strong></div>
        <div className="panel metric"><span>Decision</span><strong>{bundle.run.final_decision ?? 'Pending'}</strong></div>
        <div className="panel metric"><span>Channel</span><strong>{bundle.run.source_channel}</strong></div>
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="section-kicker">Original strategy</div>
        <h2>{bundle.run.user_input}</h2>
      </section>

      <div className="grid two" style={{ marginTop: 24 }}>
        <RiskLedger risk={bundle.risk} />
        <section className="panel">
          <div className="section-kicker">Backtest Evidence</div>
          {bundle.backtest ? (
            <>
              <p className="muted" style={{ marginTop: 12 }}>
                <strong style={{ color: 'var(--ink)' }}>{backtestProviderLabel(bundle.backtest)}</strong>
                {bundle.backtest.period && bundle.backtest.period !== 'unavailable' ? ` · ${bundle.backtest.period}` : ''}
                {bundle.backtest.trade_count != null ? ` · ${bundle.backtest.trade_count} trades` : ''}
              </p>
              {bundle.backtest.status === 'failed' && (
                <p className="warn">Backtest failed: {bundle.backtest.raw_summary_ref}. Metrics below are zeroed; the run is still auditable.</p>
              )}
              <div className="grid two" style={{ marginTop: 16 }}>
                <div className="metric"><span>PnL</span><strong>{bundle.backtest.pnl}%</strong></div>
                <div className="metric"><span>Sharpe</span><strong>{bundle.backtest.sharpe}</strong></div>
                <div className="metric"><span>Max drawdown</span><strong>{bundle.backtest.max_drawdown}%</strong></div>
                <div className="metric"><span>Win rate</span><strong>{bundle.backtest.win_rate}%</strong></div>
              </div>
              {bundle.backtest.notes && bundle.backtest.notes.length > 0 && (
                <details style={{ marginTop: 16 }}>
                  <summary>Backtest provenance & interpretation</summary>
                  <ul>{bundle.backtest.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
                </details>
              )}
            </>
          ) : <p>No backtest available.</p>}
          <ApprovalActions runId={bundle.run.run_id} enabled={bundle.run.status === 'awaiting_approval'} />
        </section>
      </div>

      <div style={{ marginTop: 24 }}>
        <EvidencePackPanel evidence={bundle.evidence} />
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="section-kicker">Replay Timeline</div>
        <Timeline events={bundle.events} />
      </section>

      <div id="report" style={{ marginTop: 24 }}>
        <ReportPanel report={bundle.report} />
      </div>
    </main>
  );
}
