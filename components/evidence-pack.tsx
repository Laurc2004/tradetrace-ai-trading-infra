import type { EvidencePack } from '@/lib/types';

export function EvidencePackPanel({ evidence }: { evidence?: EvidencePack }) {
  if (!evidence) return <section className="panel muted">Evidence Pack will appear after Bitget skills are collected.</section>;

  return (
    <section className="panel">
      <div className="section-kicker">Bitget Skill Evidence Pack</div>
      <h2>{evidence.aggregate_signal} signal</h2>
      <p>Provider: {evidence.provider}. These skills enrich the run before risk scoring.</p>
      <div className="grid" style={{ marginTop: 16 }}>
        {evidence.skills.map((skill) => (
          <article className="event-content" key={skill.skill}>
            <div className="event-meta">
              <span>{skill.skill}</span>
              <span>{skill.status}</span>
              <span>{skill.signal}</span>
              <span>{Math.round(skill.confidence * 100)}% confidence</span>
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
