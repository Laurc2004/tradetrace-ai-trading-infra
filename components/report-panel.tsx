import type { Report } from '@/lib/types';

export function ReportPanel({ report }: { report?: Report }) {
  if (!report) return <section className="panel muted">Report will appear after the run completes or is blocked.</section>;

  return (
    <section className="panel report-panel">
      <div className="section-kicker">Post-run Report</div>
      <h2>{report.executive_summary}</h2>
      <h3>Key findings</h3>
      <ul>{report.key_findings.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>Risk notes</h3>
      <ul>{report.risk_notes.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>Next actions</h3>
      <ul>{report.next_actions.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
