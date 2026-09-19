# Connect TrueForge to AgentVault

The dashboard's built-in demo is a deterministic fixture workflow, not a live LLM run. This integration uses the official `@truefoundry/trueforge-sdk`, a real TrueForge session, streaming events, persistent session IDs, and human tool checkpoints. No TrueForge server/model credentials were provided during implementation, so live model execution remains an integration check for your environment.

1. Run AgentVault with `npm run dev`, then open its Integrations page. Copy the workspace identifier. The workspace cookie binds the browser to its review queue.
2. Set `AGENTVAULT_WORKSPACE` to that identifier and `AGENTVAULT_MCP_TOKEN` to a random secret of at least 32 characters in your ignored `.env` file. Restart the dev server. Hosted values must be configured as server-side environment values. Never put this token in browser code.
3. Run or use an existing TrueForge server with a configured model. See https://trueforge.dev/api/quickstart. Local TrueForge defaults to `http://localhost:8790`; the model name/provider is chosen in your TrueForge configuration.
4. In TrueForge Settings → MCP servers, register AgentVault's `/api/mcp` endpoint using Streamable HTTP and header authentication: `Authorization: Bearer <AGENTVAULT_MCP_TOKEN>`. The server running TrueForge must be able to reach this URL. A private Sites sign-in gate is separate from MCP token authentication; use the local endpoint for the hackathon unless you explicitly configure a machine-accessible deployment.
5. Create a saved agent named `agentvault-ap`, attach the AgentVault MCP server, and use the instructions in `docs/ap-agent-instructions.md`. Configure TrueForge's `require_approval_for_tools` for `payment_pay_invoice` if you also want a visible harness-level checkpoint. This is additional to AgentVault authorization: allowing a TrueForge tool call cannot bypass AgentVault review/block status.
6. Configure `TRUEFORGE_BASE_URL`, `TRUEFORGE_AGENT_NAME=agentvault-ap`, and, only for authenticated servers, `TRUEFORGE_TOKEN` (OIDC ID token) in `.env`. Run `npm run trueforge`.
7. Watch actual TrueForge output in the terminal. Open/refresh the AgentVault dashboard to see transactions created by MCP. A bank-change payment remains paused until a human verifies and approves it in Approvals. The MCP agent has no approve or policy-edit tool.
8. The runner saves raw SDK events as `outputs/trueforge-<session>.jsonl`, plus reconnect state. `npm run trueforge -- --resume` reconnects to that session and can submit checkpoint decisions or request a final status check.

## Boundaries

- Email, ERP, vendor replies, and settlement are fixtures. No email is sent and no money moves.
- The MCP token is privileged but scoped server-side to one configured workspace. The caller cannot pick another workspace or alter trusted evidence.
- MoneyTrace currently shows the stored authorization evidence/tool pipeline. The runner's JSONL is the source for raw TrueForge execution provenance; the dashboard does not yet render the live SDK event stream or claim harness token/cost measurements.
- MCP uses stateless JSON responses; GET correctly returns 405 because server-push SSE is not needed for these tools.
- For real finance, replace fixture source adapters with authenticated ERP/vendor integrations, add organization identity/RBAC, validated out-of-band verification, calibrated risk models, immutable audit retention, and a production payment adapter. This repository is a hackathon sandbox.
