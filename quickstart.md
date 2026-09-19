# AgentVault quickstart

AgentVault is the financial firewall for an accounts-payable agent. It includes invoice fraud detection, spending limits, human approvals, MoneyTrace, and privacy filtering of model-bound tool results.

## 1. Install

Use Node.js 22.14 or newer. In the project folder:

```sh
npm install
```

Keep secrets in the ignored `.env` file. Do not commit API keys. The setup command creates any missing local integration settings; it does not create an OpenAI API key.

## 2. Start both servers

Terminal 1 — AgentVault:

```sh
npm run dev
```

Open **http://localhost:3000** (or the URL printed by the server).

Terminal 2 — TrueForge:

```sh
npm run trueforge:server
```

Open **http://localhost:8790**. The runtime binds to this computer only and keeps its configuration/sessions under the ignored `.trueforge/` directory.

## 3. Configure OpenAI

In TrueForge, open **Settings → Models → OpenAI**, enter your OpenAI API key, and enable a model. The setup script prefers the catalog's `openai/gpt-5-4-mini` when configured; otherwise it uses the first configured OpenAI model. Set `TRUEFORGE_MODEL` in `.env` to choose a specific fully qualified configured model name.

No real agent inference is possible until a working provider key and model are configured. An existing ChatGPT login does not supply this project's API key.

## 4. Register the AP agent and tools

Terminal 3:

```sh
npm run trueforge:setup
```

This creates or updates the `agentvault` MCP connector and `agentvault-ap` agent, generates a local MCP token/workspace when missing, and writes them to `.env`. The development server reloads its environment automatically. If it does not, restart `npm run dev`.

To start setup before entering the OpenAI key and let it finish automatically afterward:

```sh
npm run trueforge:setup -- --watch
```

The agent has seven payment/evidence tools and requires a TrueForge human checkpoint before invoking simulated payment. The model cannot change AgentVault policy or approve its own financial review.

## 5. Open the same workspace as the agent

In AgentVault, open **Integrations → Use agent workspace**. This local-only action lets your dashboard show the transactions created through the configured MCP connector. The TrueForge card checks the runtime every ten seconds and distinguishes an offline server, missing provider, missing agent, and ready configuration.

Configuration readiness does not prove that the API key has quota or that inference succeeded. A successful agent session is the final check.

## 6. Run the real TrueForge agent

```sh
npm run trueforge
```

The runner creates a real TrueForge session and asks the saved AP agent to investigate three fixture scenarios. It streams model output and records raw runtime events in the ignored `outputs/` folder.

When the runtime asks whether to allow `payment_pay_invoice`, type `allow` only after reviewing its arguments. Allowing the tool call does not bypass AgentVault's financial gate.

Expected scenario outcomes:

| Invoice | Amount | Outcome |
|---|---:|---|
| Acme normal invoice | $12,480 | Authorized, then simulated payment after the runtime checkpoint |
| Acme impersonation attempt | $48,200 | Blocked; trusted-contact investigation denies the bank change |
| Northstar bank change | $23,100 | Review; operator must verify and decide |

Refresh AgentVault to see the agent's transactions. For the bank change, open **Approvals**, run trusted-contact verification, enter a decision note, and approve or reject. You can then type `continue` in the runner to ask the agent to recheck stored receipts.

Resume the last saved runtime session:

```sh
npm run trueforge -- --resume
```

## Try the deterministic demo

The **Run agent demo** button works without a model key. It exercises the actual policy engine against fixed fixtures and is separate from live TrueForge execution. **MoneyTrace** shows stored evidence, **Privacy** shows redacted context previews/MCP disclosure records, and **Security evals** runs 30 synthetic rule tests.

All invoices, vendor replies, and payments remain simulated, including when a real OpenAI model drives the agent. No email is sent and no money moves.

## Validate

```sh
npm run typecheck
npm test
npm run test:privacy-local
npm run build
```

With AgentVault running, `npm run test:integration` exercises the HTTP policy flow. `npm run test:mcp` temporarily substitutes a test MCP token/workspace and restores `.env`; run it only when no live agent is using that connector.

## Troubleshooting

- **OpenAI key required:** configure the provider in TrueForge, then rerun setup or keep `--watch` running.
- **Unknown model:** `TRUEFORGE_MODEL` must match a model shown by your TrueForge server, including its provider prefix.
- **Server offline:** start `npm run trueforge:server`; verify `.env` points to `http://localhost:8790`.
- **No transactions in the dashboard:** choose **Use agent workspace**, then refresh after tool execution.
- **Payment paused:** resolve the terminal's TrueForge checkpoint and, when applicable, the separate AgentVault financial review.
- **Hosted Site cannot connect to local TrueForge:** the hosted server cannot reach your laptop's localhost. Use the local app for this setup; a hosted runtime or configured private tunnel is required for a hosted connection.

More detail: `docs/TRUEFORGE.md`, `docs/PRIVACY.md`, and the local-only, Git-ignored `system design.md`.
