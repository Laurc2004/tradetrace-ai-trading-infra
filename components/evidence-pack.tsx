import { useTranslations } from 'next-intl';
import type { EvidencePack } from '@/lib/types';

export function EvidencePackPanel({ evidence }: { evidence?: EvidencePack }) {
  const t = useTranslations('EvidencePack');
  if (!evidence) return <section className="panel muted">{t('empty')}</section>;

  return (
    <section className="panel">
      <div className="section-kicker">{t('kicker')}</div>
      <h2>{t('signal', { signal: evidence.aggregate_signal })}</h2>
      <p>{t('providerLine', { provider: evidence.provider })}</p>
      <div className="grid" style={{ marginTop: 16 }}>
        {evidence.skills.map((skill) => (
          <article className="event-content" key={skill.skill}>
            <div className="event-meta">
              <span>{skill.skill}</span>
              <span>{skill.status}</span>
              <span>{skill.signal}</span>
              <span>{t('confidence', { percent: Math.round(skill.confidence * 100) })}</span>
            </div>
            <h3>{skill.summary}</h3>
            <ul>
              {skill.key_points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
