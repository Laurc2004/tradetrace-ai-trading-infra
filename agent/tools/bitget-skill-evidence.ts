import { requireEnv } from '@/lib/env';
import { makeId, nowIso } from '@/lib/id';
import type { BitgetSkillName, EvidencePack, SkillEvidence, StrategySpec } from '@/lib/types';

export const RECOMMENDED_SKILLS: BitgetSkillName[] = [
  'technical-analysis',
  'sentiment-analyst',
  'news-briefing',
  'market-intel',
  'macro-analyst',
];

export async function collectEvidencePack(runId: string, strategy: StrategySpec): Promise<EvidencePack> {
  const skills = await Promise.all(RECOMMENDED_SKILLS.map((skill) => callQwenSkillAnalyst(skill, strategy)));
  return buildPack(runId, skills);
}

async function callQwenSkillAnalyst(skill: BitgetSkillName, strategy: StrategySpec): Promise<SkillEvidence> {
  const baseUrl = requireEnv('QWEN_BASE_URL');
  const model = requireEnv('QWEN_MODEL');
  const apiKey = requireEnv('QWEN_API_KEY');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are the Bitget Agent Hub ${skill} skill persona. Analyze the provided structured trading strategy for pre-execution evidence. Return only JSON with signal (bullish|bearish|neutral|risk-off|risk-on|mixed), confidence (0-1), summary, key_points array. Do not invent live market prices if not supplied.`,
        },
        { role: 'user', content: JSON.stringify(strategy.structured_strategy) },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) throw new Error(`${skill} evidence request failed: ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error(`${skill} evidence response missing content`);
  const json = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? content);
  return {
    skill,
    status: 'live',
    signal: normalizeSignal(json.signal),
    confidence: Number(json.confidence ?? 0.6),
    summary: String(json.summary ?? `${skill} evidence generated.`),
    key_points: Array.isArray(json.key_points) ? json.key_points.map(String) : [],
    raw_ref: `qwen-skill-persona:${skill}`,
  };
}

function buildPack(runId: string, skills: SkillEvidence[]): EvidencePack {
  const riskFlags = skills
    .filter((skill) => skill.signal === 'risk-off' || skill.signal === 'bearish')
    .flatMap((skill) => skill.key_points.map((point) => `${skill.skill}: ${point}`));

  return {
    evidence_id: makeId('evidence'),
    run_id: runId,
    provider: 'qwen_skill_persona',
    skills,
    aggregate_signal: aggregate(skills),
    risk_flags: riskFlags,
    created_at: nowIso(),
  };
}

function normalizeSignal(value: unknown): SkillEvidence['signal'] {
  const signal = String(value ?? 'neutral').toLowerCase();
  if (['bullish', 'bearish', 'neutral', 'risk-off', 'risk-on', 'mixed'].includes(signal)) return signal as SkillEvidence['signal'];
  return 'neutral';
}

function aggregate(skills: SkillEvidence[]): EvidencePack['aggregate_signal'] {
  const riskOff = skills.filter((skill) => skill.signal === 'risk-off' || skill.signal === 'bearish').length;
  const riskOn = skills.filter((skill) => skill.signal === 'risk-on' || skill.signal === 'bullish').length;
  if (riskOff >= 2) return 'risk-off';
  if (riskOn >= 2 && riskOff === 0) return 'risk-on';
  if (riskOn > riskOff) return 'bullish';
  if (riskOff > riskOn) return 'bearish';
  return 'mixed';
}
