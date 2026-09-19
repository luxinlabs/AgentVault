# Privacy Trace

The useful part of the Codex privacy-monitor idea is the **disclosure boundary**, not a generic "privacy score". AgentVault should account for what a model receives while keeping financial truth inside deterministic authorization.

## Implemented in this MVP

- **MCP egress guard:** every successful MCP tool response is redacted before returning to the agent. If redaction or disclosure persistence fails, the response fails closed rather than falling back to the raw payload.
- **Task-preserving minimization:** bank identifiers and email local parts are masked; domains, amounts, invoice identifiers, risk factors, and explicit bank/domain comparison booleans survive. The policy engine still evaluates original fixture evidence.
- **Disclosure ledger:** tool, destination, timestamp, detected categories, occurrence count, withheld source-character count, measured scan time, and redacted payload. No original match values are added to the ledger. The rule detector is limited and can miss other PII.
- **Honest accounting:** authorization creates a labeled context preview. It is not recorded as an actual model disclosure. MCP records a response prepared at the outbound boundary; it cannot prove receipt, model consumption, downstream tools, or retention.
- **Local scratchpad:** the Privacy page can scan text inside the browser without submission, persistence, analytics, or model calls. It uses deterministic rules, not OpenAI's model.
- **Optional local model adapter:** `privacy/local_filter.py` supports the `openai/privacy-filter` token-classification model using Transformers. It requires a separately downloaded model and runs with network access disabled at the library level.

Rule coverage: known bank identifiers, named account/secret fields, email local parts (domains intentionally preserved), formatted US phone/SSN patterns, common API key formats. It does not claim broad name/address detection or universal secret coverage. This is data minimization, not guaranteed anonymization or a calibrated privacy metric.

## Run OpenAI privacy-filter locally

This is optional and **was not downloaded or benchmarked during the MVP build**. Model inference is not silently replaced with regex. Prepare the environment and weights before processing private documents:

```sh
python3 -m venv .venv-privacy
.venv-privacy/bin/pip install -r privacy/requirements.txt
.venv-privacy/bin/hf download openai/privacy-filter --local-dir models/privacy-filter
.venv-privacy/bin/python privacy/local_filter.py \
  --model-dir models/privacy-filter \
  --input /path/to/local-invoice.txt \
  --output /path/to/redacted-invoice.txt
```

The download obtains model assets; private input is not supplied to the download command. Inference then uses only the local model directory with Hugging Face/Transformers offline flags and telemetry disabled. The output path must not already exist. Only aggregate counts and timing are printed. Unknown labels and invalid offsets fail closed. Unit tests cover offset handling; real model inference remains unverified.

Apply this adapter on the source machine **before** sending real source text to a hosted AgentVault service or model. The hosted MVP's built-in guard sits between the AgentVault server and MCP consumer; it cannot claim that source data never left your laptop. The current app uses fixture data, not private uploads.

For a full runtime integration, use the local model as a source-side scanner, retain originals in the trusted finance service, and send only permitted context plus comparison facts. Model availability, loading time, inference latency, and detection quality must be measured on the deployment hardware. Download and cold-start time are not included in the adapter's inference timing.

## References

- Model: https://huggingface.co/openai/privacy-filter
- Source: https://github.com/openai/privacy-filter
- OpenAI agent-data guidance: https://developers.openai.com/api/docs/guides/deep-research
