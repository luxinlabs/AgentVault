import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';

const base = process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790';
const app = process.env.AGENTVAULT_BASE_URL || 'http://localhost:3000';
const agentName = process.env.TRUEFORGE_AGENT_NAME || 'agentvault-ap';
const token = process.env.AGENTVAULT_MCP_TOKEN || randomBytes(32).toString('hex');
const workspace = process.env.AGENTVAULT_WORKSPACE || randomUUID();
let text = await readFile('.env', 'utf8').catch(() => '');
for (const [key, value] of Object.entries({ TRUEFORGE_BASE_URL: base, TRUEFORGE_AGENT_NAME: agentName, AGENTVAULT_BASE_URL: app, AGENTVAULT_MCP_TOKEN: token, AGENTVAULT_WORKSPACE: workspace })) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`;
}
await writeFile('.env', text, { mode: 0o600 });

async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(process.env.TRUEFORGE_TOKEN ? { Authorization: `Bearer ${process.env.TRUEFORGE_TOKEN}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${result.error?.message || response.status}`);
  return result;
}

await api('/settings/mcp-servers', 'PUT', { manifest: {
  name: 'agentvault', type: 'remote', url: `${app}/api/mcp`,
  description: 'AgentVault financial firewall: trusted invoice evidence, privacy redaction, authorization, human review, and simulated settlement.',
  auth: { type: 'header', headers: { Authorization: `Bearer ${token}` } },
} });
let models = (await api('/models')).data;
let openaiModels = models.filter(model => model.name?.startsWith('openai/'));
if (!openaiModels.length && process.argv.includes('--watch')) {
  console.log(`Connector ready. Waiting for OpenAI configuration at ${base} (Settings → Models).`);
  while (!openaiModels.length) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    models = (await api('/models')).data;
    openaiModels = models.filter(model => model.name?.startsWith('openai/'));
  }
}
const modelName = process.env.TRUEFORGE_MODEL || openaiModels.find(model => model.name === 'openai/gpt-5-4-mini')?.name || openaiModels[0]?.name || 'openai/gpt-5-4-mini';
const manifest = {
  model: { name: modelName }, instructions: await readFile('docs/ap-agent-instructions.md', 'utf8'),
  mcp_servers: [{ name: 'agentvault', enable_tools: ['@all'], preload: true, require_approval_for_tools: ['payment_pay_invoice'] }],
  config: { iteration_limit: 30, sandbox: { enabled: false }, dynamic_sub_agents: { enabled: false }, generative_ui: { enabled: false }, ask_user_questions: { enabled: false }, web_search: { enabled: false } },
};
await mkdir('.trueforge', { recursive: true });
await writeFile('.trueforge/agent-manifest.json', JSON.stringify({ name: agentName, description: 'Accounts-payable agent protected by AgentVault.', manifest }, null, 2));
const existing = (await api('/agents')).data.find(agent => agent.name === agentName);
let saved;
try {
  saved = existing
    ? await api(`/agents/${existing.id}`, 'PATCH', { description: 'Accounts-payable agent protected by AgentVault.', manifest })
    : await api('/agents', 'POST', { name: agentName, description: 'Accounts-payable agent protected by AgentVault.', manifest });
} catch (error) {
  if (!openaiModels.length) {
    console.log(`MCP connector configured. Agent manifest saved locally. Configure OpenAI at ${base}, then rerun npm run trueforge:setup.\n${error.message}`);
    process.exitCode = 2;
  } else throw error;
}
if (saved) console.log(`Saved agent ${agentName} (${saved.data.id}) using ${modelName}.`);
console.log(`TrueForge: ${base}\nAgentVault: ${app}\nOpen the AgentVault Integrations page and choose Use agent workspace.`);
if (!openaiModels.length) console.log('OpenAI credentials are not configured yet. No model call was made.');
else console.log('Configured OpenAI model found. Run npm run trueforge to start the AP investigation.');
