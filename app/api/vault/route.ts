import { snapshot, authorize, pay, investigate, review, updatePolicy, evaluate } from '../../../lib/store';
import { env } from 'cloudflare:workers';
function identity(req: Request) { const value = req.headers.get('cookie')?.match(/(?:^|;\s*)agentvault_workspace=([a-f0-9-]{36})(?:;|$)/)?.[1]; return value ?? crypto.randomUUID(); }
function response(data: unknown, id: string, status = 200) { return Response.json(data, { status, headers: { 'Set-Cookie': `agentvault_workspace=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`, 'Cache-Control': 'no-store' } }); }
export async function GET(req: Request) { const id = identity(req); try {
    return response(await snapshot(id), id);
}
catch (e) {
    console.error(e);
    return response({ error: 'Could not load the workspace.' }, id, 500);
} }
export async function POST(req: Request) {
    const id = identity(req);
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin))
        return response({ error: 'Cross-origin request denied.' }, id, 403);
    try {
        const b = await req.json() as Record<string, unknown>;
        if (!b || typeof b.action !== 'string')
            throw new Error('An action is required.');
        if (b.action === 'agent-workspace') {
            const workspace = (env as unknown as Record<string, string | undefined>).AGENTVAULT_WORKSPACE;
            if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(new URL(req.url).hostname) || !workspace || !/^[a-f0-9-]{36}$/.test(workspace))
                return response({ error: 'The shared agent workspace is available only in the local development server.' }, id, 403);
            return response(await snapshot(workspace), workspace);
        }
        if (b.action === 'run') {
            const ids = b.scenario === 'all' ? ['legitimate', 'impersonation', 'bank-change'] : [String(b.scenario)];
            const runId = typeof b.runId === 'string' ? b.runId : crypto.randomUUID();
            for (const scenario of ids) {
                const tx = await authorize(id, scenario, runId);
                if (tx.status === 'authorized')
                    await pay(id, tx.id);
            }
        }
        else if (b.action === 'verify')
            await investigate(id, String(b.id));
        else if (b.action === 'review') {
            if (typeof b.allow !== 'boolean' || typeof b.reason !== 'string')
                throw new Error('Invalid review.');
            await review(id, String(b.id), b.allow, b.reason);
        }
        else if (b.action === 'policy')
            await updatePolicy(id, b.policy);
        else if (b.action === 'eval')
            await evaluate(id);
        else
            throw new Error('Unknown action.');
        return response(await snapshot(id), id);
    }
    catch (e) {
        return response({ error: e instanceof Error ? e.message : 'Request failed.' }, id, 400);
    }
}
