import { env } from 'cloudflare:workers';
import { assess, defaultPolicy, scenarios, runEvaluations, validatePolicy, type Policy, type Evidence, type Assessment } from './engine';
export type TraceEvent = {
    id: string;
    tool: string;
    label: string;
    detail: string;
    source: string;
    at: string;
    state: 'ok' | 'warning' | 'blocked';
};
export type Transaction = {
    id: string;
    run_id: string;
    scenario: string;
    invoice: string;
    amount: number;
    status: string;
    evidence: Evidence;
    assessment: Assessment;
    trace: TraceEvent[];
    verification: null | {
        confirmed: boolean;
        reply: string;
        at: string;
    };
    created: string;
    updated: string;
};
type Row = {
    id: string;
    workspace: string;
    run_id: string;
    scenario: string;
    invoice: string;
    amount: number;
    status: string;
    evidence: string;
    assessment: string;
    trace: string;
    verification: string | null;
    created: string;
    updated: string;
};
export async function database() {
    const db = env.DB;
    if (!db)
        throw new Error('Database binding unavailable.');
    await db.batch([
        db.prepare('CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, policy TEXT NOT NULL, created TEXT NOT NULL)'),
        db.prepare('CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, run_id TEXT NOT NULL, scenario TEXT NOT NULL, invoice TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, evidence TEXT NOT NULL, assessment TEXT NOT NULL, trace TEXT NOT NULL, verification TEXT, created TEXT NOT NULL, updated TEXT NOT NULL)'),
        db.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_workspace_created ON transactions(workspace,created)'),
        db.prepare('CREATE TABLE IF NOT EXISTS evaluations (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, result TEXT NOT NULL, created TEXT NOT NULL)'),
        db.prepare('CREATE INDEX IF NOT EXISTS idx_evaluations_workspace_created ON evaluations(workspace,created)')
    ]);
    return db;
}
function parsed(r: Row): Transaction { return { ...r, evidence: JSON.parse(r.evidence), assessment: JSON.parse(r.assessment), trace: JSON.parse(r.trace), verification: r.verification ? JSON.parse(r.verification) : null }; }
export async function ensureWorkspace(id: string) { const db = await database(); await db.prepare('INSERT OR IGNORE INTO workspaces(id,policy,created) VALUES(?,?,?)').bind(id, JSON.stringify(defaultPolicy), new Date().toISOString()).run(); return db; }
export async function policyFor(id: string): Promise<Policy> { const db = await ensureWorkspace(id); const row = await db.prepare('SELECT policy FROM workspaces WHERE id=?').bind(id).first<{
    policy: string;
}>(); return JSON.parse(row!.policy); }
export async function snapshot(id: string) { const db = await ensureWorkspace(id); const { results } = await db.prepare('SELECT * FROM transactions WHERE workspace=? ORDER BY created DESC LIMIT 200').bind(id).all<Row>(); const evaluation = await db.prepare('SELECT result FROM evaluations WHERE workspace=? ORDER BY created DESC LIMIT 1').bind(id).first<{
    result: string;
}>(); return { transactions: results.map(parsed), policy: await policyFor(id), evaluation: evaluation ? JSON.parse(evaluation.result) : null, scenarios: scenarios.map(({ id, name, description, category, amount }) => ({ id, name, description, category, amount })), mode: 'simulation', workspace: id }; }
const evt = (tool: string, label: string, detail: string, source: string, state: TraceEvent['state'] = 'ok'): TraceEvent => ({ id: crypto.randomUUID(), tool, label, detail, source, at: new Date().toISOString(), state });
export async function getTransaction(workspace: string, id: string) { const db = await database(); const row = await db.prepare('SELECT * FROM transactions WHERE workspace=? AND id=?').bind(workspace, id).first<Row>(); if (!row)
    throw new Error('Transaction not found.'); return parsed(row); }
export async function authorize(workspace: string, scenarioId: string, runId: string) {
    const e = scenarios.find(s => s.id === scenarioId);
    if (!e)
        throw new Error('Unknown scenario.');
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(runId))
        throw new Error('Invalid run identifier.');
    const db = await ensureWorkspace(workspace);
    const id = `${runId}-${e.id}`;
    const existing = await db.prepare('SELECT * FROM transactions WHERE workspace=? AND id=?').bind(workspace, id).first<Row>();
    if (existing)
        return parsed(existing);
    const p = await policyFor(workspace);
    const day = new Date().toISOString().slice(0, 10);
    const total = await db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE workspace=? AND ((status='paid' AND updated>=?) OR status IN ('authorized','review'))").bind(workspace, day).first<{
        total: number;
    }>();
    const a = assess(e, p, (total?.total ?? 0) / 100);
    const trace = [evt('human.authority', 'Human authority', `Process approved USD invoices under $${p.maxPayment.toLocaleString()}. Daily budget $${p.dailyBudget.toLocaleString()}.`, 'authority'), evt('gmail.read', 'Read invoice email', `From ${e.sender}: ${e.subject}\n${e.body}`, 'email'), evt('erp.get_invoice', 'Verify invoice', `${e.invoice} • $${e.invoiceAmount.toLocaleString()} • ${e.approved ? 'Approved' : 'Not approved'}`, 'erp'), evt('erp.get_vendor', 'Compare trusted vendor', `${e.vendor} • ${e.domain} • Account ending ${e.trustedAccount}`, 'erp'), evt('agent.propose_payment', 'Payment intent', `Proposed $${e.amount.toLocaleString()} to account ending ${e.account}. Evidence is untrusted until evaluated.`, 'intent'), evt('agentvault.authorize', 'Financial firewall', `${a.decision.toUpperCase()} • ${a.signals.map(s => s.label).join('; ') || 'All checks passed'}`, 'decision', a.decision === 'block' ? 'blocked' : a.decision === 'review' ? 'warning' : 'ok')];
    const now = new Date().toISOString();
    const status = a.decision === 'allow' ? 'authorized' : a.decision === 'review' ? 'review' : 'blocked';
    // The INSERT rechecks budget, pause, and policy version atomically to prevent concurrent overspend.
    const inserted = await db.prepare(`INSERT OR IGNORE INTO transactions(id,workspace,run_id,scenario,invoice,amount,status,evidence,assessment,trace,created,updated)
 SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ?='blocked' OR ((SELECT policy FROM workspaces WHERE id=?)=? AND COALESCE((SELECT SUM(amount) FROM transactions WHERE workspace=? AND ((status='paid' AND updated>=?) OR status IN ('authorized','review'))),0)+?<=?)`).bind(id, workspace, runId, e.id, e.invoice, Math.round(e.amount * 100), status, JSON.stringify(e), JSON.stringify(a), JSON.stringify(trace), now, now, status, workspace, JSON.stringify(p), workspace, day, Math.round(e.amount * 100), Math.round(p.dailyBudget * 100)).run();
    if (!inserted.meta.changes) {
        const row = await db.prepare('SELECT * FROM transactions WHERE workspace=? AND id=?').bind(workspace, id).first<Row>();
        if (row)
            return parsed(row);
        throw new Error('Policy or available budget changed. Retry authorization.');
    }
    return getTransaction(workspace, id);
}
export async function pay(workspace: string, id: string) {
    const tx = await getTransaction(workspace, id);
    if (tx.status === 'paid')
        return tx;
    if (tx.status !== 'authorized')
        throw new Error('Payment denied: no server-side authorization.');
    const p = await policyFor(workspace);
    if (!p.enabled || tx.amount > Math.round(p.maxPayment * 100))
        throw new Error('Payment denied: current policy disallows settlement.');
    const db = await database();
    const trace = [...tx.trace, evt('payment.pay_invoice', 'Simulated payment settled', `Receipt ${id}. No real money moved.`, 'payment')];
    await db.prepare("UPDATE transactions SET status='paid',trace=?,updated=? WHERE id=? AND workspace=? AND status='authorized' AND (SELECT policy FROM workspaces WHERE id=?)=?").bind(JSON.stringify(trace), new Date().toISOString(), id, workspace, workspace, JSON.stringify(p)).run();
    const result = await getTransaction(workspace, id);
    if (result.status !== 'paid')
        throw new Error('Policy changed before settlement. Retry after review.');
    return result;
}
export async function investigate(workspace: string, id: string) {
    const tx = await getTransaction(workspace, id);
    if (tx.verification)
        return tx;
    if (!['blocked', 'review', 'rejected'].includes(tx.status))
        throw new Error('Only intercepted payments require verification.');
    const e = tx.evidence;
    const verification = { confirmed: e.bankChangeConfirmed, reply: e.trustedReply, at: new Date().toISOString() };
    const trace = [...tx.trace, evt('erp.get_history', 'Retrieve historical destination', `Historical account •••• ${e.trustedAccount}. Contact retrieved from the trusted vendor record.`, 'erp'), evt('vendor.verify', 'Verify through trusted contact', e.trustedReply, 'verification', !e.bankChangeConfirmed && e.account !== e.trustedAccount ? 'blocked' : 'ok')];
    const db = await database();
    await db.prepare('UPDATE transactions SET verification=?,trace=?,updated=? WHERE workspace=? AND id=? AND verification IS NULL').bind(JSON.stringify(verification), JSON.stringify(trace), new Date().toISOString(), workspace, id).run();
    return getTransaction(workspace, id);
}
export async function review(workspace: string, id: string, allow: boolean, reason: string) {
    const tx = await getTransaction(workspace, id);
    if (tx.status !== 'review')
        throw new Error('This payment is no longer awaiting review.');
    if (allow && !tx.verification?.confirmed)
        throw new Error('Verify the destination through the trusted contact before approving.');
    if (reason.trim().length < 3 || reason.length > 500)
        throw new Error('Provide a review note (3–500 characters).');
    const p = await policyFor(workspace);
    if (allow && (!p.enabled || tx.amount > p.maxPayment * 100))
        throw new Error('Current policy prevents approval.');
    const trace = [...tx.trace, evt('human.review', allow ? 'Human approved' : 'Human rejected', reason, 'approval', allow ? 'ok' : 'blocked')];
    const db = await database();
    const result = await db.prepare("UPDATE transactions SET status=?,trace=?,updated=? WHERE workspace=? AND id=? AND status='review' AND (SELECT policy FROM workspaces WHERE id=?)=?").bind(allow ? 'authorized' : 'rejected', JSON.stringify(trace), new Date().toISOString(), workspace, id, workspace, JSON.stringify(p)).run();
    if (!result.meta.changes)
        throw new Error('Review was already resolved or policy changed. Refresh and retry.');
    return allow ? pay(workspace, id) : getTransaction(workspace, id);
}
export async function updatePolicy(workspace: string, value: unknown) { const p = validatePolicy(value); const db = await ensureWorkspace(workspace); const day = new Date().toISOString().slice(0, 10); const result = await db.prepare("UPDATE workspaces SET policy=? WHERE id=? AND COALESCE((SELECT SUM(amount) FROM transactions WHERE workspace=? AND ((status='paid' AND updated>=?) OR status IN ('authorized','review'))),0)<=?").bind(JSON.stringify(p), workspace, workspace, day, Math.round(p.dailyBudget * 100)).run(); if (!result.meta.changes)
    throw new Error('Budget cannot be less than payments already settled or reserved today.'); return p; }
export async function evaluate(workspace: string) { const result = runEvaluations(); const db = await ensureWorkspace(workspace); await db.prepare('INSERT INTO evaluations(id,workspace,result,created) VALUES(?,?,?,?)').bind(crypto.randomUUID(), workspace, JSON.stringify(result), result.at).run(); return result; }
