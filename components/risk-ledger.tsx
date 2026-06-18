import { useTranslations } from 'next-intl';
import type { RiskAssessment } from '@/lib/types';

export function RiskLedger({ risk }: { risk?: RiskAssessment }) {
  const t = useTranslations('RiskLedger');
  if (!risk) return <div className="panel muted">{t('empty')}</div>;

  return (
    <section className={`panel risk risk-${risk.level.toLowerCase()}`}>
      <div className="section-kicker">{t('kicker')}</div>
      <div className="risk-score">
        <strong>{risk.score}</strong>
        <span>{t('outOf')}</span>
      </div>
      <h2>{t('riskAndRecommendation', { level: risk.level, recommendation: risk.recommendation })}</h2>
      <ul>
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}
