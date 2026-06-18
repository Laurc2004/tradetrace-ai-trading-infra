import { useTranslations } from 'next-intl';
import type { Report } from '@/lib/types';

export function ReportPanel({ report }: { report?: Report }) {
  const t = useTranslations('ReportPanel');
  if (!report) return <section className="panel muted">{t('empty')}</section>;

  return (
    <section className="panel report-panel">
      <div className="section-kicker">{t('kicker')}</div>
      <h2>{report.executive_summary}</h2>
      <h3>{t('keyFindings')}</h3>
      <ul>{report.key_findings.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>{t('riskNotes')}</h3>
      <ul>{report.risk_notes.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>{t('nextActions')}</h3>
      <ul>{report.next_actions.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
