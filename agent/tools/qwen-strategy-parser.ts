import { z } from 'zod';
import { makeId, nowIso } from '@/lib/id';
import { requireEnv } from '@/lib/env';
import type { StrategySpec, StructuredStrategy } from '@/lib/types';

const strategySchema = z.object({
  symbol: z.string().default('BTCUSDT'),
  timeframe: z.string().default('1h'),
  direction: z.enum(['long', 'short', 'both', 'unknown']).default('unknown'),
  entry_conditions: z.array(z.string()).default([]),
  exit_conditions: z.array(z.string()).default([]),
  stop_loss: z.string().nullable().default(null),
  take_profit: z.string().nullable().default(null),
  position_limit: z.string().nullable().default(null),
  risk_constraints: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  playbook_version_id: z.string().optional(),
  confidence_notes: z.array(z.string()).default([]),
});

export async function parseStrategyWithQwen(runId: string, prompt: string): Promise<StrategySpec> {
  const parsed = await callQwen(prompt);
  return toStrategySpec(runId, prompt, parsed);
}

async function callQwen(prompt: string) {
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
            'Extract a trading strategy as strict JSON. Return only JSON with symbol,timeframe,direction,entry_conditions,exit_conditions,stop_loss,take_profit,position_limit,risk_constraints,unknowns,confidence_notes.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Qwen request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Qwen response missing content');
  }

  const json = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  return JSON.parse(json) as unknown;
}

function toStrategySpec(runId: string, rawPrompt: string, value: unknown): StrategySpec {
  const parsed = strategySchema.parse(value);
  const { confidence_notes, ...structured } = parsed;
  return {
    strategy_id: makeId('strategy'),
    run_id: runId,
    raw_prompt: rawPrompt,
    structured_strategy: structured as StructuredStrategy,
    confidence_notes,
    created_at: nowIso(),
  };
}
