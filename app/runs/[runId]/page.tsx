import { notFound } from 'next/navigation';
import { ApprovalActions } from '@/components/approval-actions';
import { EvidencePackPanel } from '@/components/evidence-pack';
import { ReportPanel } from '@/components/report-panel';
import { RiskLedger } from '@/components/risk-ledger';
import { StatusPill } from '@/components/status-pill';
import { Timeline } from '@/components/timeline';
import { getRun } from '@/lib/store';

type Props = { params: Promise<{ runId: string }> };

export default async function RunDetailPage({ params }: Props) {
  const { runId } = await params;
  const bundle = await getRun(runId);
  if (!bundle) notFound();

  return (
    <main>
      <div className="kicker">Flight Recorder</div>
      <h1>{bundle.run.run_id}</h1>
      <div className="grid three">
        <div className="panel metric"><span>Status</span><strong><StatusPill status={bundle.run.status} /></strong></div>
        <div className="panel metric"><span>Decision</span><strong>{bundle.run.final_decision ?? 'Pending'}</strong></div>
        <div className="panel metric"><span>Channel</span><strong>{bundle.run.source_channel}</strong></div>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-kicker">Original strategy</div>
        <h2>{bundle.run.user_input}</h2>
      </section>

      <div className="grid two" style={{ marginTop: 20 }}>
        <RiskLedger risk={bundle.risk} />
        <section className="panel">
          <div className="section-kicker">Backtest Evidence</div>
          {bundle.backtest ? (
            <div className="grid two">
              <div className="metric"><span>PnL</span><strong>{bundle.backtest.pnl}%</strong></div>
              <div className="metric"><span>Sharpe</span><strong>{bundle.backtest.sharpe}</strong></div>
              <div className="metric"><span>Max drawdown</span><strong>{bundle.backtest.max_drawdown}%</strong></div>
              <div className="metric"><span>Win rate</span><strong>{bundle.backtest.win_rate}%</strong></div>
            </div>
          ) : <p>No backtest available.</p>}
          <ApprovalActions runId={bundle.run.run_id} enabled={bundle.run.status === 'awaiting_approval'} />
        </section>
      </div>

      <div style={{ marginTop: 20 }}>
        <EvidencePackPanel evidence={bundle.evidence} />
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-kicker">Replay Timeline</div>
        <Timeline events={bundle.events} />
      </section>

      <div style={{ marginTop: 20 }}>
        <ReportPanel report={bundle.report} />
      </div>
    </main>
  );
}
