import assert from 'node:assert/strict';
import {mkdirSync,copyFileSync,cpSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';

// A disposable LOCAL Supabase stack, never a linked cloud project.
const root=path.resolve(process.argv[2]||'');
assert.ok(root.startsWith('/tmp/')||root.startsWith(process.env.RUNNER_TEMP+'/'),'Use a scratch directory');
assert.ok(existsSync(path.join(root,'supabase/config.toml')),'Run supabase init in the scratch directory first');
const config=path.join(root,'supabase/config.toml');
writeFileSync(config,readFileSync(config,'utf8').replace('project_id = "'+path.basename(root)+'"','project_id = "hakuna-integration"')+'\n[functions.catalog-api]\nverify_jwt = false\n[functions.catalog-notify]\nverify_jwt = false\n[functions.catalog-router]\nverify_jwt = false\n');
mkdirSync(path.join(root,'supabase/migrations'),{recursive:true});
copyFileSync('scripts/fixtures/hakuna-pre-v2-schema.sql',path.join(root,'supabase/migrations/20261029000000_catalog_baseline.sql'));
for(const name of ['20261030074358_hakuna_order_lifecycle_v2.sql','20261030080140_hakuna_push_multi_order_v2.sql'])
  copyFileSync('supabase/migrations/'+name,path.join(root,'supabase/migrations',name));
for(const name of ['catalog-api','catalog-notify','catalog-router'])
  cpSync('supabase/functions/'+name,path.join(root,'supabase/functions',name),{recursive:true});
console.log('Isolated stack prepared: production schema + two migrations + three functions; no production rows or secrets.');
