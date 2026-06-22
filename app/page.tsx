import { listRuns } from '@/lib/store';
import { StatusPill } from '@/components/status-pill';

export default async function HomePage() {
  const runs = (await listRuns()).slice(0, 4);

  return (
    <main>
      {/* HERO — the single 120-point element is the live terminal */}
      <section className="hero">
        <div>
          <div className="hero-eyebrow">
            <span className="kicker">Bitget AI Hackathon · Track 2 Infra</span>
          </div>
          <h1>
            A flight recorder
            <br />
            for AI trading agents.
          </h1>
          <p className="lead">
            Every strategy run becomes a replayable audit trail — what the user asked, how Qwen parsed it,
            how a local backtest tested it on real Bitget klines, which risks fired, who approved it, and what happened next.
          </p>
          <div className="hero-actions">
            <a className="button" href="/runs/new">Start a run</a>
            <a className="button secondary" href="/dashboard">View dashboard</a>
          </div>
        </div>

        {/* Live tool-call terminal — the visual anchor */}
        <div className="terminal" aria-hidden>
          <div className="terminal-bar">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">run_8f3a · live trace</span>
          </div>
          <div className="terminal-body">
            <span className="t-line"><span className="t-actor">qwen.parse</span> <span className="t-muted">→</span> strategy structured</span>
            <span className="t-line"><span className="t-actor">evidence.collect</span> <span className="t-muted">→</span> bitget klines · 180d</span>
            <span className="t-line"><span className="t-actor">local_backtest</span> <span className="t-muted">→</span> <span className="t-ok">pnl +12.4%</span> · sharpe 1.8</span>
            <span className="t-line"><span className="t-actor">risk.score</span> <span className="t-muted">→</span> 28/100 <span className="t-muted">low</span></span>
            <span className="t-line"><span className="t-actor">approval</span> <span className="t-muted">→</span> <span className="t-ok">awaiting human</span></span>
            <span className="t-line"><span className="t-actor">risk.gate</span> <span className="t-muted">→</span> <span className="t-block">blocked · martingale</span></span>
            <span className="t-line"><span className="t-muted">▍ recording · 6 events captured</span></span>
          </div>
        </div>
      </section>

      {/* FEATURES — three supporting cards, intentionally quieter than the hero */}
      <section className="features">
        <div className="features-head">
          <div className="kicker">Why it matters</div>
          <h2>Built for demos that survive the worst case.</h2>
        </div>
        <div className="grid three">
          <div className="feature-card">
            <div className="section-kicker">Trace</div>
            <h3>Every tool call is evidence.</h3>
            <p>Parse, backtest, risk, approval, and execution events captured into one ordered, replayable timeline.</p>
          </div>
          <div className="feature-card">
            <div className="section-kicker">Govern</div>
            <h3>Risk before execution.</h3>
            <p>Deterministic rules block martingale, high leverage, missing stop loss, and statistically weak backtests.</p>
          </div>
          <div className="feature-card">
            <div className="section-kicker">Replay</div>
            <h3>Demos survive API failure.</h3>
            <p>Historical real runs replay without live external APIs — auditable end to end, offline-safe.</p>
          </div>
        </div>
      </section>

      {/* RECENT RUNS */}
      {runs.length > 0 ? (
        <section className="section-gap">
          <div className="kicker" style={{ marginBottom: 24, display: 'flex' }}>Recent runs</div>
          <div className="run-list">
            {runs.map((bundle) => (
              <a className="run-row" href={`/runs/${bundle.run.run_id}`} key={bundle.run.run_id}>
                <div>
                  <strong>{bundle.run.run_id}</strong>
                  <p>{bundle.run.user_input}</p>
                </div>
                <StatusPill status={bundle.run.status} />
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
