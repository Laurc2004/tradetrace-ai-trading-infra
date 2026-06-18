import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import { makeId, nowIso } from '@/lib/id';
import { errorMeta, logError, logInfo } from '@/lib/logger';
import type { StrategySpec, StructuredStrategy } from '@/lib/types';

const stringArray = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value ? [value] : [];
  if (value == null) return [];
  return [String(value)];
}, z.array(z.string()).default([]));

const nullableString = z.preprocess((value) => {
  if (value == null || value === '') return null;
  return String(value);
}, z.string().nullable().default(null));

const strategySchema = z.object({
  symbol: z.preprocess((value) => String(value ?? 'BTCUSDT').toUpperCase(), z.string().default('BTCUSDT')),
  timeframe: z.preprocess((value) => String(value ?? '1h'), z.string().default('1h')),
  direction: z.preprocess((value) => String(value ?? 'unknown').toLowerCase(), z.enum(['long', 'short', 'both', 'unknown']).default('unknown')),
  entry_conditions: stringArray,
  exit_conditions: stringArray,
  stop_loss: nullableString,
  take_profit: nullableString,
  position_limit: nullableString,
  risk_constraints: stringArray,
  unknowns: stringArray,
  confidence_notes: stringArray,
});

export async function parseStrategyWithQwen(runId: string, prompt: string): Promise<StrategySpec> {
  logInfo('qwen.strategy-parser', 'starting strategy parse', { runId, promptLength: prompt.length });
  try {
    const parsed = await callQwen(prompt, runId);
    const spec = toStrategySpec(runId, prompt, parsed);
    logInfo('qwen.strategy-parser', 'strategy parse completed', {
      runId,
      strategyId: spec.strategy_id,
      symbol: spec.structured_strategy.symbol,
      direction: spec.structured_strategy.direction,
      confidenceNotes: spec.confidence_notes.length,
    });
    return spec;
  } catch (error) {
    logError('qwen.strategy-parser', 'strategy parse failed', { runId, ...errorMeta(error) });
    throw error;
  }
}

async function callQwen(prompt: string, runId: string) {
  const baseUrl = requireEnv('QWEN_BASE_URL');
  const model = requireEnv('QWEN_MODEL');
  const apiKey = requireEnv('QWEN_API_KEY');
  logInfo('qwen.strategy-parser', 'calling chat completions', { runId, baseUrl, model });
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
            'Extract a trading strategy as strict JSON. Return only JSON with symbol,timeframe,direction,entry_conditions,exit_conditions,stop_loss,take_profit,position_limit,risk_constraints,unknowns,confidence_notes. All list fields must be arrays of strings.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  logInfo('qwen.strategy-parser', 'chat completions returned', { runId, status: response.status, ok: response.ok });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Qwen request failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Qwen response missing content');
  }

  logInfo('qwen.strategy-parser', 'raw model content received', { runId, contentPreview: content.slice(0, 500) });
  const json = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  return JSON.parse(json) as unknown;
}

function toStrategySpec(runId: string, rawPrompt: string, value: unknown): StrategySpec {
  const result = strategySchema.safeParse(value);
  if (!result.success) {
    logError('qwen.strategy-parser', 'strategy schema validation failed', {
      runId,
      issues: result.error.issues,
      rawValue: value,
    });
    throw result.error;
  }
  const { confidence_notes, ...structured } = result.data;
  return {
    strategy_id: makeId('strategy'),
    run_id: runId,
    raw_prompt: rawPrompt,
    structured_strategy: structured as StructuredStrategy,
    confidence_notes,
    created_at: nowIso(),
  };
}
