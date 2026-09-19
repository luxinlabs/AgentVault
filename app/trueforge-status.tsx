'use client';
import { useEffect, useState } from 'react';
type Status = { status: string; message: string; serverConnected?: boolean; model?: string; agent?: string; baseUrl?: string; localWorkspaceAvailable?: boolean };
export default function TrueForgeStatus({ onJoin }: { onJoin: () => void }) {
  const [status, setStatus] = useState<Status>({ status: 'checking', message: 'Checking the TrueForge server…' });
  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const response = await fetch('/api/trueforge'); if (!response.ok) throw new Error('Status check failed.'); const data = await response.json() as Status; if (active) setStatus(data); }
      catch { if (active) setStatus({ status: 'offline', message: 'Could not reach the TrueForge status endpoint.' }); }
    };
    void check(); const timer = setInterval(check, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const labels: Record<string, string> = { checking: 'Checking…', unconfigured: 'Not configured here', offline: 'Server offline', agent_missing: 'Server connected', model_required: 'OpenAI key required', ready: 'Configuration ready' };
  return <section className="panel integration-card"><div className="integration-icon">⌘</div><span className="eyebrow">LIVE CONNECTION CHECK</span><h2>TrueForge</h2><p>{status.message}</p><span className="badge">{labels[status.status] || status.status}</span>{status.agent && <p className="fineprint">Agent: {status.agent}{status.model && <><br/>Model: {status.model}</>}</p>}{status.baseUrl && <p><a className="text-link" href={status.baseUrl} target="_blank" rel="noreferrer">Open TrueForge ↗</a></p>}{status.localWorkspaceAvailable && <button onClick={onJoin}>Use agent workspace</button>}</section>;
}
