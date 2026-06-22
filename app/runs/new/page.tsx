'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Template = {
  id: string;
  label: string;
  description: string;
  strategy: string;
};

type ConsoleLine = {
  timestamp: string;
  actor: string;
  status: string;
  type: string;
  message: string;
  detail?: string;
};

const templates: Template[] = [
  {
    id: 'btc-momentum-guarded',
    label: 'BTC momentum + guardrails',
    description: 'Healthy demo path: trend confirmation, stop loss, take profit, position cap.',
    strategy: 'When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long. Use 1.5% stop loss, 4% take profit, max position 15%, pause after two consecutive losses.',
  },
  {
    id: 'danger-martingale',
    label: 'Danger: averaging down',
    description: 'Blocked demo path: leverage, martingale-like behavior, no clear stop.',
    strategy: 'Whenever price drops, keep adding to the position until it rebounds. Use high leverage and recover losses as fast as possible.',
  },
  {
    id: 'eth-breakout',
    label: 'ETH breakout',
    description: 'Review demo path: breakout, volume expansion, tight stop.',
    strategy: 'If ETH breaks above the previous 4h high with volume expansion, go long with 2% stop loss, 3% take profit, max position 10%.',
  },
];

export default function NewRunPage() {
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0].id);
  const [strategy, setStrategy] = useState(templates[0].strategy);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const router = useRouter();

  const selected = useMemo(() => templates.find((item) => item.id === selectedTemplate) ?? templates[0], [selectedTemplate]);

  function chooseTemplate(template: Template) {
    setMode('template');
    setSelectedTemplate(template.id);
    setStrategy(template.strategy);
    setError(null);
    setConsoleLines([]);
    setRunId(null);
  }

  function useCustom() {
    setMode('custom');
    setStrategy('');
    setError(null);
    setConsoleLines([]);
    setRunId(null);
  }

  async function submit() {
    setError(null);
    setRunId(null);
    setConsoleLines([]);
    setIsRunning(true);

    try {
      const response = await fetch('/api/runs/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });

      if (!response.ok || !response.body) {
        const fallback = await response.json().catch(() => ({}));
        throw new Error(fallback?.error ?? 'Failed to create run. Check provider environment variables.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const payload = JSON.parse(line);
          if (payload.kind === 'progress') {
            setConsoleLines((existing) => [
              ...existing,
              {
                timestamp: payload.timestamp,
                actor: payload.actor,
                status: payload.status,
                type: payload.type,
                message: payload.message,
                detail: payload.detail,
              },
            ]);
            setRunId(payload.runId);
          }
          if (payload.kind === 'done') {
            setRunId(payload.runId);
            setConsoleLines((existing) => [
              ...existing,
              {
                timestamp: new Date().toISOString(),
                actor: 'system',
                status: 'completed',
                type: 'redirect.ready',
                message: 'Run complete. Flight recorder detail page is ready.',
              },
            ]);
          }
          if (payload.kind === 'error') {
            throw new Error(payload.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run. Check provider environment variables.');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main>
      <div className="kicker">New Run</div>
      <h1>Start the recorder.</h1>
      <p className="lead">Describe a strategy in plain language. The recorder will parse it, backtest on real Bitget klines, score the risk, and gate execution — all streamed live below.</p>

      <div className="grid two" style={{ marginTop: 40 }}>
        <section className="panel">
          <div className="section-kicker">Natural-language strategy</div>
          <h2>Describe what the agent should do.</h2>
          <div className="examples">
            {templates.map((template) => (
              <button className="example" key={template.id} onClick={() => chooseTemplate(template)} type="button">
                {template.label}
              </button>
            ))}
            <button className="example" onClick={useCustom} type="button">
              Fully custom
            </button>
          </div>
          <p>{mode === 'template' ? selected.description : 'Start from a blank strategy prompt.'}</p>
          <textarea
            placeholder="Enter any natural-language trading strategy..."
            value={strategy}
            onChange={(event) => setStrategy(event.target.value)}
          />
          {error ? <p className="warn" style={{ marginTop: 14 }}>{error}</p> : null}
          <div className="hero-actions" style={{ marginTop: 24 }}>
            <button onClick={submit} disabled={isRunning || !strategy.trim()} type="button">
              {isRunning ? 'Running recorder...' : 'Create run'}
            </button>
            {runId ? (
              <button className="secondary" onClick={() => router.push(`/runs/${runId}`)} type="button">
                Open detail page
              </button>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-kicker">What happens next</div>
          <h2>Six stages, fully recorded.</h2>
          <div className="step-list">
            <div className="step"><span className="step-num">01</span><span className="step-label">Qwen parses the strategy into structured intent</span></div>
            <div className="step"><span className="step-num">02</span><span className="step-label">Evidence pack enriches the run (Bitget klines)</span></div>
            <div className="step"><span className="step-num">03</span><span className="step-label">Local deterministic backtest on real klines</span></div>
            <div className="step"><span className="step-num">04</span><span className="step-label">Risk engine scores and gates the strategy</span></div>
            <div className="step"><span className="step-num">05</span><span className="step-label">Human approval on Web UI or Telegram</span></div>
            <div className="step"><span className="step-num">06</span><span className="step-label">Report generated, run archived as replayable</span></div>
          </div>
        </section>
      </div>

      <section className="panel section-gap">
        <div className="section-kicker">Live tool-call console</div>
        {consoleLines.length === 0 ? (
          <p style={{ marginTop: 12 }}>Start a run to see live AI and tool output stream here in real time.</p>
        ) : (
          <div className="timeline" style={{ marginTop: 20 }}>
            {consoleLines.map((line, index) => (
              <article className="event-card" key={`${line.timestamp}-${line.type}-${index}`}>
                <div className="event-dot" />
                <div className="event-content">
                  <div className="event-meta">
                    <span>{line.actor}</span>
                    <span>{line.status}</span>
                    <span>{line.type}</span>
                    <span>{new Date(line.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <h3>{line.message}</h3>
                  {line.detail ? <pre>{line.detail}</pre> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
