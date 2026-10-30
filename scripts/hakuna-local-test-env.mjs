import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function localEnvironment(file){
  assert.ok(file,'Supply the status.env of an isolated local Supabase stack');
  const env={};for(const line of readFileSync(file,'utf8').split('\n')){
    const m=/^([A-Z_]+)=(.*)$/.exec(line);if(m)env[m[1]]=m[2].replace(/^"|"$/g,'');
  }
  for(const key of ['API_URL','DB_URL'])assert.ok(['127.0.0.1','localhost'].includes(new URL(env[key]).hostname),'Tests refuse cloud URLs');
  assert.ok(env.ANON_KEY&&env.SERVICE_ROLE_KEY,'Missing isolated-stack API keys');
  return env;
}
export async function waitForApi(url,key){
  for(let i=0;i<60;i++){
    try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',apikey:key,authorization:'Bearer '+key},body:'{"action":"catalog_identity","slug":"hakuna-matata"}',signal:AbortSignal.timeout(2000)});if(r.status!==502&&r.status!==503)return;}catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  throw Error('Local Edge Function failed to become ready');
}
