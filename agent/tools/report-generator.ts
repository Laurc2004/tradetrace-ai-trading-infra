import { requireEnv } from '@/lib/env';
import { makeId, nowIso } from '@/lib/id';
import type { Report, RunBundle } from '@/lib/types';

export async function generateReport(bundle: RunBundle): Promise<Report> {
  return callQwenReport(bundle);
}

async function callQwenReport(bundle: RunBundle): Promise<Report> {
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
          content:
            'Write a concise JSON audit report for an AI trading agent run. Return only JSON with executive_summary,key_findings,risk_notes,audit_trail,next_actions.',
        },
        { role: 'user', content: JSON.stringify(bundle).slice(0, 12000) },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) throw new Error(`Qwen report request failed: ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Qwen report response missing content');
  const json = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? content);
  return {
    report_id: makeId('report'),
    run_id: bundle.run.run_id,
    executive_summary: String(json.executive_summary ?? ''),
    key_findings: Array.isArray(json.key_findings) ? json.key_findings.map(String) : [],
    risk_notes: Array.isArray(json.risk_notes) ? json.risk_notes.map(String) : [],
    audit_trail: Array.isArray(json.audit_trail) ? json.audit_trail.map(String) : [],
    next_actions: Array.isArray(json.next_actions) ? json.next_actions.map(String) : [],
    created_at: nowIso(),
  };
}
