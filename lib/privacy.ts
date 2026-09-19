/** Data minimization at the tool-output boundary. No model or network calls. */
export type PrivacyReport = { detector: string; detectedSpans: number; redactedCharacters: number; inputCharacters: number; outputCharacters: number; categories: Record<string, number>; elapsedMs: number };
export type Disclosure = { id: string; transaction_id: string | null; tool: string; destination: string; mode: 'preview' | 'mcp_response'; report: PrivacyReport; preview: string; created: string };
export function redactPayload(value: unknown, accountHints: string[] = []) {
 const start=performance.now();const categories:Record<string,number>={};let redactedCharacters=0;
 const count=(kind:string,size:number)=>{categories[kind]=(categories[kind]??0)+1;redactedCharacters+=size;};
 const accounts=[...new Set(accountHints)].filter(v=>/^\d{4,}$/.test(v));
 function sanitize(input:string,key:string){
  if(input && /^(?:account|trustedAccount|destination|account_number|bankAccount|routing|routing_number)$/i.test(key)){count('account_number',input.length);return '[ACCOUNT]';}
  if(input && /^(?:password|api_?key|access_?token|secret|authorization)$/i.test(key)){count('secret',input.length);return '[SECRET]';}
  let result=input;
  for(const account of accounts)result=result.replace(new RegExp(`\\b${account}\\b`,'g'),match=>{count('account_number',match.length);return '[ACCOUNT]';});
  result=result.replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,})\b/g,match=>{count('secret',match.length);return '[SECRET]';});
  result=result.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/gi,match=>{count('secret',match.length-7);return 'Bearer [SECRET]';});
  result=result.replace(/\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi,(_,local:string,domain:string)=>{count('private_email',local.length);return `[EMAIL]@${domain}`;});
  result=result.replace(/\b\d{3}-\d{2}-\d{4}\b/g,match=>{count('government_id',match.length);return '[GOVERNMENT_ID]';});
  result=result.replace(/\b(?:account|routing)(?:\s+(?:number|ending))?\s*[:#-]?\s*(\d[\d -]{3,20}\d)\b/gi,(match:string,number:string)=>{count('account_number',number.length);return match.replace(number,'[ACCOUNT]');});
  result=result.replace(/(?<!\w)(?:\+1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}\b/g,match=>{count('private_phone',match.length);return '[PHONE]';});
  return result;
 }
 function walk(v:unknown,key=''):unknown {if(typeof v==='string')return sanitize(v,key);if(typeof v==='number'&&/^(?:account|routing|account_number)$/.test(key))return sanitize(String(v),key);if(Array.isArray(v))return v.map(item=>walk(item,key));if(v&&typeof v==='object'){const o=v as Record<string,unknown>;const mapped=Object.fromEntries(Object.entries(o).map(([k,x])=>[k,walk(x,k)]));if(typeof o.account==='string'&&typeof o.trustedAccount==='string')mapped.bankAccountMatches=o.account===o.trustedAccount;if(typeof o.sender==='string'&&typeof o.domain==='string')mapped.senderDomainMatches=o.sender.toLowerCase().split('@').at(-1)===o.domain.toLowerCase();return mapped;}return v;}
 const redacted=walk(value);const input=JSON.stringify(value)??'';const output=JSON.stringify(redacted)??'';
 const report:PrivacyReport={detector:'Deterministic rules v1 · not the OpenAI model',detectedSpans:Object.values(categories).reduce((a,b)=>a+b,0),redactedCharacters,inputCharacters:input.length,outputCharacters:output.length,categories,elapsedMs:performance.now()-start};
 return {redacted,report};
}
