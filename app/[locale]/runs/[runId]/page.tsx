import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ApprovalActions } from '@/components/approval-actions';
import { EvidencePackPanel } from '@/components/evidence-pack';
import { ReportPanel } from '@/components/report-panel';
import { RiskLedger } from '@/components/risk-ledger';
import { StatusPill } from '@/components/status-pill';
import { Timeline } from '@/components/timeline';
import { getRun } from '@/lib/store';

type Props = { params: Promise<{ runId: string; locale: string }> };

export default async function RunDetailPage({ params }: Props) {
  const { runId, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('RunDetailPage');
  const tCommon = await getTranslations('Common');
  const bundle = await getRun(runId);
  if (!bundle) notFound();

  return (
    <main>
      <div className="kicker">{t('kicker')}</div>
      <h1>{bundle.run.run_id}</h1>
      <div className="grid three">
        <div className="panel metric"><span>{t('labelStatus')}</span><strong><StatusPill status={bundle.run.status} /></strong></div>
        <div className="panel metric"><span>{t('labelDecision')}</span><strong>{bundle.run.final_decision ?? tCommon('pending')}</strong></div>
        <div className="panel metric"><span>{t('labelChannel')}</span><strong>{bundle.run.source_channel}</strong></div>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-kicker">{t('originalStrategyKicker')}</div>
        <h2>{bundle.run.user_input}</h2>
      </section>

      <div className="grid two" style={{ marginTop: 20 }}>
        <RiskLedger risk={bundle.risk} />
        <section className="panel">
          <div className="section-kicker">{t('backtestKicker')}</div>
          {bundle.backtest ? (
            <div className="grid two">
              <div className="metric"><span>{t('backtestPnL')}</span><strong>{bundle.backtest.pnl}%</strong></div>
              <div className="metric"><span>{t('backtestSharpe')}</span><strong>{bundle.backtest.sharpe}</strong></div>
              <div className="metric"><span>{t('backtestDrawdown')}</span><strong>{bundle.backtest.max_drawdown}%</strong></div>
              <div className="metric"><span>{t('backtestWinRate')}</span><strong>{bundle.backtest.win_rate}%</strong></div>
            </div>
          ) : <p>{t('backtestEmpty')}</p>}
          <ApprovalActions runId={bundle.run.run_id} enabled={bundle.run.status === 'awaiting_approval'} />
        </section>
      </div>

      <div style={{ marginTop: 20 }}>
        <EvidencePackPanel evidence={bundle.evidence} />
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-kicker">{t('timelineKicker')}</div>
        <Timeline events={bundle.events} />
      </section>

      <div style={{ marginTop: 20 }}>
        <ReportPanel report={bundle.report} />
      </div>
    </main>
  );
}
