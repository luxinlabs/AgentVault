# AgentVault

**The financial firewall for AI agents.** A working hackathon sandbox based on the shared AgentVault discussion: allow legitimate invoices, intercept the $48,200 impersonation attempt, explain its provenance, verify through a trusted contact, and review an ambiguous bank change.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by the server (normally http://localhost:3000). Select **Full demo** and click **Run agent demo**. D1/SQLite state persists locally in `.wrangler`. Each browser gets an isolated sandbox via an HttpOnly SameSite cookie.

## Three-minute demonstration

1. Run the full demo: a $12,480 invoice settles, $48,200 is blocked, and $23,100 pauses for review.
2. Open the blocked transaction's **Trace why**. Select the email and ERP nodes to compare destinations 7742 vs. 8219. Fraud rule score: 96/100.
3. Click **Investigate through trusted contact**. The fixture vendor denies changing its bank. The dashboard shows $48,200 protected in simulation.
4. Open **Approvals**. Verify Northstar's legitimate bank change, enter a decision note, and approve. The persisted payment settles exactly once.
5. Run **Security evals** to display measured results for 30 synthetic cases. Policies lets you demonstrate pause, budget, and authority limits.

## Included

- Responsive dashboard: overview, transaction search/filter, MoneyTrace, evidence export, approvals, policy editing, integrations, evaluation results.
- Server-side deterministic risk/intent/policy engine with source-linked decision factors.
- Persistent transactions, payment reservations, idempotent settlement, human review notes and verification.
- Atomic reservation guard against concurrent budget overspend. Paid payments use the settlement UTC date; open reservations count until resolved.
- Seven authenticated Streamable HTTP MCP tools. No approval or policy-edit tool is exposed to the agent.
- Official TrueForge SDK runner with streaming event journal, session resume, and explicit harness checkpoint handling. See [TrueForge integration](docs/TRUEFORGE.md).

## Verify

```sh
npm test                 # engine behavior and edge cases
npm run typecheck
npm run test:integration # requires dev server; uses its own fresh sandbox
npm run build
```

The UI evaluation suite reports actual engine timings and outcomes. It is a regression check, not a held-out or adversarial LLM evaluation. Fixtures are deliberately synthetic; scores are transparent rule scores, not calibrated fraud probabilities.

## Architecture

Browser → server API → trusted fixture adapters → AgentVault authorization → reserved payment → mock settlement.

TrueForge → authenticated MCP → the same server authorization/payment gate. TrueForge's human tool checkpoint does not replace AgentVault authorization. The agent cannot modify trusted evidence, the current workspace, policies, or human-review decisions.

Amounts are stored as integer USD cents. Repeated authorization uses `(runId, scenario)` identity; **a new run intentionally simulates a new execution**, not real invoice deduplication across runs. One sandbox's history is currently limited to the most recent 200 transactions in the UI. Source fixtures are in `lib/engine.ts`, server persistence and enforcement in `lib/store.ts`, and HTTP tools in `app/api/mcp/route.ts`.

## Scope

No real money movement, email sending, bank connection, or claimed live model activity. Built-in demo execution is deterministic; live TrueForge requires a configured external runtime/model and the setup above. TrueForge raw events are saved by the runner; the current dashboard renders stored authorization provenance, not the live SDK stream. Hosted private access is a separate layer from MCP authentication.

This is a hackathon prototype, not a production finance deployment. Organizational authentication/RBAC, authenticated real vendor verification, robust injection detection beyond regex heuristics, independent model evaluations, tamper-evident audit storage, reconciliation, and real settlement are future work.

## References

- [Original product discussion](https://chatgpt.com/share/6aaed6e2-bca8-83e8-9b93-1bcd4a8a7041)
- [TrueForge SDK quickstart](https://trueforge.dev/api/quickstart)
- [TrueForge streaming and approvals](https://trueforge.dev/api/use-agent)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
