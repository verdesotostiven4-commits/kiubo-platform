from pathlib import Path

path=Path('lib/sync-engine.ts')
text=path.read_text()
needle='One sync cycle belongs to exactly one active workspace'
if needle not in text:
    target='  const db=loadLocalDatabase(),ctx=getWorkspaceContext(db),activeTenantId=ctx.tenant&&ctx.tenant.plan!=="Internal"&&UUID_RE.test(ctx.tenantId)?ctx.tenantId:null;'
    assert text.count(target)==1, 'sync workspace marker target missing'
    text=text.replace(target,'  // One sync cycle belongs to exactly one active workspace\n'+target)
    path.write_text(text)
