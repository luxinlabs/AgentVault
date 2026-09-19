import { env } from 'cloudflare:workers';

export async function GET() {
  const config = env as unknown as Record<string, string | undefined>;
  const base = config.TRUEFORGE_BASE_URL;
  const name = config.TRUEFORGE_AGENT_NAME || 'agentvault-ap';
  const headers = { 'Cache-Control': 'no-store' };
  if (!base) return Response.json({ status: 'unconfigured', message: 'Configure a TrueForge endpoint for this deployment.', agent: name }, { headers });
  try {
    const auth = config.TRUEFORGE_TOKEN ? { Authorization: `Bearer ${config.TRUEFORGE_TOKEN}` } : undefined;
    const get = async (path: string) => {
      const response = await fetch(`${base.replace(/\/$/, '')}/api/v1${path}`, { headers: auth, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`TrueForge returned HTTP ${response.status}.`);
      return await response.json() as { data: Array<{ id?: string; name: string; manifest?: { model?: { name?: string } } }> };
    };
    const [agents, models] = await Promise.all([get('/agents'), get('/models')]);
    const agent = agents.data.find(item => item.name === name);
    const model = agent?.manifest?.model?.name;
    const modelConfigured = Boolean(model && models.data.some(item => item.name === model));
    const hasOpenAI = models.data.some(item => item.name.startsWith('openai/'));
    return Response.json({ status: !hasOpenAI ? 'model_required' : !agent ? 'agent_missing' : !modelConfigured ? 'model_required' : 'ready', serverConnected: true, agent: name, model, modelConfigured, message: !hasOpenAI ? 'Server connected. Add your OpenAI key in TrueForge Settings → Models to finish agent setup.' : !agent ? 'Server connected; finish AP agent setup.' : !modelConfigured ? 'The agent model is not configured in TrueForge Settings → Models.' : 'Server, AP agent, and model configuration are ready.', baseUrl: base, localWorkspaceAvailable: process.env.NODE_ENV !== 'production' && Boolean(config.AGENTVAULT_WORKSPACE) }, { headers });
  } catch (error) {
    return Response.json({ status: 'offline', serverConnected: false, agent: name, message: error instanceof Error ? error.message : 'TrueForge is unreachable.' }, { headers });
  }
}
