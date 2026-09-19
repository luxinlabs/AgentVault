// Local-only test: temporarily configures a generated MCP token, then restores .env.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://localhost:3000';const original=await readFile('.env','utf8');
const response=await fetch(`${base}/api/vault`);const cookie=response.headers.get('set-cookie').split(';')[0];const initial=await response.json();
const token=randomBytes(32).toString('hex');let count=0;
async function rpc(method,params={}){const r=await fetch(`${base}/api/mcp`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:`Bearer ${token}`},body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method,params})});return {status:r.status,data:await r.json()};}
async function call(name,args){const r=await rpc('tools/call',{name,arguments:args});assert.equal(r.status,200);count++;return r.data.result;}
try{
 const clean=original.split('\n').filter(line=>!line.startsWith('AGENTVAULT_MCP_TOKEN=')&&!line.startsWith('AGENTVAULT_WORKSPACE=')).join('\n');
 await writeFile('.env',`${clean}\nAGENTVAULT_MCP_TOKEN=${token}\nAGENTVAULT_WORKSPACE=${initial.workspace}\n`);
 let ready=false;
 for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,500));try{const r=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'agentvault-test',version:'1'}});if(r.status===200){ready=true;break;}}catch{}}
 assert.ok(ready,'Dev server did not reload MCP configuration');
 const tools=await rpc('tools/list');assert.equal(tools.data.result.tools.length,7);
 const email=await call('gmail_read',{scenarioId:'impersonation'});const e=JSON.parse(email.content[0].text);assert.equal(e.sender,'[EMAIL]@acme-payments.co');assert.equal(e.destination,'[ACCOUNT]');assert.equal(e.destinationMatchesTrusted,false);assert.ok(!email.content[0].text.includes('7742'));
 const authorized=await call('agentvault_authorize',{scenarioId:'impersonation',runId:randomUUID()});const tx=JSON.parse(authorized.content[0].text);assert.equal(tx.status,'blocked');assert.equal(tx.evidence.bankAccountMatches,false);assert.ok(!('workspace' in tx));assert.equal(tx.evidence.account,'[ACCOUNT]');
 const bypass=await call('payment_pay_invoice',{transactionId:tx.id});assert.equal(bypass.isError,true);
 const verify=await call('vendor_verify',{transactionId:tx.id});const verified=JSON.parse(verify.content[0].text);assert.equal(verified.evidence.trustedAccount,'[ACCOUNT]');assert.ok(!/\b8219\b/.test(verified.verification.reply));
 const override=await call('agentvault_authorize',{scenarioId:'legitimate',runId:randomUUID(),amount:1});assert.equal(override.isError,true);
 const state=await (await fetch(`${base}/api/vault`,{headers:{Cookie:cookie}})).json();assert.equal(state.disclosures.filter(d=>d.mode==='mcp_response').length,3);assert.ok(state.disclosures.every(d=>!d.preview.includes('billing@')&&!d.preview.includes('7742')));
 console.log(`Passed MCP protocol, ${count} tool calls, output redaction, comparison preservation, no workspace disclosure, hard-block enforcement, and persisted disclosure ledger.`);
}finally{await writeFile('.env',original);}
