import { database } from './store';
import { redactPayload,type Disclosure } from './privacy';
export async function recordDisclosure(workspace:string,tool:string,value:unknown,accounts:string[],mode:Disclosure['mode'],transactionId:string|null=null){
 const result=redactPayload(value,accounts);const db=await database();const created=new Date().toISOString();
 const id=mode==='preview'&&transactionId?`${transactionId}:privacy-preview`:crypto.randomUUID();
 const preview=JSON.stringify(result.redacted,null,2);
 await db.prepare('INSERT OR IGNORE INTO disclosures(id,workspace,transaction_id,tool,destination,mode,report,preview,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,workspace,transactionId,tool,'Agent / model context',mode,JSON.stringify(result.report),preview,created).run();
 return result.redacted;
}
