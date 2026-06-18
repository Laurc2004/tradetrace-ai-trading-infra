import type { RiskAssessment } from '@/lib/types';

export function RiskLedger({ risk }: { risk?: RiskAssessment }) {
  if (!risk) return <div className="panel muted">No risk assessment yet.</div>;

  return (
    <section className={`panel risk risk-${risk.level.toLowerCase()}`}>
      <div className="section-kicker">Risk Ledger</div>
      <div className="risk-score">
        <strong>{risk.score}</strong>
        <span>/100</span>
      </div>
      <h2>{risk.level} Risk - {risk.recommendation}</h2>
      <ul>
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}
