import { StatusPill } from '@/components/status-pill';
import { listRuns } from '@/lib/store';

export default async function DashboardPage() {
  const runs = await listRuns();
  const completed = runs.filter((bundle) => bundle.run.status === 'completed').length;
  const blocked = runs.filter((bundle) => bundle.run.status === 'blocked').length;
  const review = runs.filter((bundle) => bundle.run.status === 'awaiting_approval').length;
  const avgEvents = runs.length ? Math.round(runs.reduce((sum, bundle) => sum + bundle.events.length, 0) / runs.length) : 0;

  return (
    <main>
      <div className="kicker">Dashboard</div>
      <h1>AgentOps for trading runs.</h1>
      <section className="grid four grid three">
        <div className="panel metric"><span>Total runs</span><strong>{runs.length}</strong></div>
        <div className="panel metric"><span>Completed</span><strong>{completed}</strong></div>
        <div className="panel metric"><span>Blocked</span><strong>{blocked}</strong></div>
        <div className="panel metric"><span>Avg events/run</span><strong>{avgEvents}</strong></div>
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="section-kicker">Recent runs</div>
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
      {review > 0 ? <p>{review} run(s) are waiting for human approval.</p> : null}
    </main>
  );
}
