import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ApprovalRecord,
  BacktestResult,
  EvidencePack,
  Report,
  RiskAssessment,
  Run,
  RunBundle,
  RunEvent,
  StrategySpec,
} from './types';

const dataDir = path.join(process.cwd(), 'data');
const sampleDir = path.join(process.cwd(), 'samples');
const dbPath = path.join(dataDir, 'runs.json');

type Db = {
  runs: Record<string, RunBundle>;
};

async function ensureDb(): Promise<Db> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(raw) as Db;
  } catch {
    const db: Db = { runs: {} };
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
    return db;
  }
}

async function saveDb(db: Db) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

export async function upsertRun(run: Run) {
  const db = await ensureDb();
  const existing = db.runs[run.run_id];
  db.runs[run.run_id] = existing ? { ...existing, run } : { run, events: [] };
  await saveDb(db);
  return db.runs[run.run_id];
}

export async function updateRun(runId: string, patch: Partial<Run>) {
  const db = await ensureDb();
  const bundle = db.runs[runId];
  if (!bundle) throw new Error(`Run not found: ${runId}`);
  bundle.run = { ...bundle.run, ...patch };
  await saveDb(db);
  return bundle;
}

export async function appendEvent(event: RunEvent) {
  const db = await ensureDb();
  const bundle = db.runs[event.run_id];
  if (!bundle) throw new Error(`Run not found: ${event.run_id}`);
  bundle.events.push(event);
  await saveDb(db);
  return event;
}

export async function saveStrategy(strategy: StrategySpec) {
  const db = await ensureDb();
  const bundle = db.runs[strategy.run_id];
  if (!bundle) throw new Error(`Run not found: ${strategy.run_id}`);
  bundle.strategy = strategy;
  await saveDb(db);
  return strategy;
}

export async function saveBacktest(backtest: BacktestResult) {
  const db = await ensureDb();
  const bundle = db.runs[backtest.run_id];
  if (!bundle) throw new Error(`Run not found: ${backtest.run_id}`);
  bundle.backtest = backtest;
  await saveDb(db);
  return backtest;
}

export async function saveEvidence(evidence: EvidencePack) {
  const db = await ensureDb();
  const bundle = db.runs[evidence.run_id];
  if (!bundle) throw new Error(`Run not found: ${evidence.run_id}`);
  bundle.evidence = evidence;
  await saveDb(db);
  return evidence;
}

export async function saveRisk(risk: RiskAssessment) {
  const db = await ensureDb();
  const bundle = db.runs[risk.run_id];
  if (!bundle) throw new Error(`Run not found: ${risk.run_id}`);
  bundle.risk = risk;
  await saveDb(db);
  return risk;
}

export async function saveApproval(approval: ApprovalRecord) {
  const db = await ensureDb();
  const bundle = db.runs[approval.run_id];
  if (!bundle) throw new Error(`Run not found: ${approval.run_id}`);
  bundle.approval = approval;
  await saveDb(db);
  return approval;
}

export async function saveReport(report: Report) {
  const db = await ensureDb();
  const bundle = db.runs[report.run_id];
  if (!bundle) throw new Error(`Run not found: ${report.run_id}`);
  bundle.report = report;
  bundle.run.report_id = report.report_id;
  await saveDb(db);
  return report;
}

export async function getRun(runId: string): Promise<RunBundle | null> {
  const db = await ensureDb();
  if (db.runs[runId]) return db.runs[runId];

  const sample = await getSampleRun(runId);
  return sample;
}

export async function listRuns(): Promise<RunBundle[]> {
  const db = await ensureDb();
  const liveRuns = Object.values(db.runs);
  const samples = await listSampleRuns();
  const seen = new Set(liveRuns.map((bundle) => bundle.run.run_id));
  return [...liveRuns, ...samples.filter((bundle) => !seen.has(bundle.run.run_id))].sort((a, b) =>
    b.run.started_at.localeCompare(a.run.started_at),
  );
}

export async function getSampleRun(runId: string): Promise<RunBundle | null> {
  try {
    const files = await fs.readdir(sampleDir);
    for (const file of files.filter((name) => name.endsWith('.json'))) {
      const raw = await fs.readFile(path.join(sampleDir, file), 'utf8');
      const bundle = JSON.parse(raw) as RunBundle;
      if (bundle.run.run_id === runId) return bundle;
    }
  } catch {
    return null;
  }
  return null;
}

export async function listSampleRuns(): Promise<RunBundle[]> {
  try {
    const files = await fs.readdir(sampleDir);
    const bundles = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => JSON.parse(await fs.readFile(path.join(sampleDir, file), 'utf8')) as RunBundle),
    );
    return bundles;
  } catch {
    return [];
  }
}
