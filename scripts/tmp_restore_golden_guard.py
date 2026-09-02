from pathlib import Path

path=Path('lib/sync-engine.ts')
text=path.read_text()
needle='One sync cycle belongs to exactly one active workspace'
if needle not in text:
    target='  const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);'
    assert text.count(target)==1, 'sync workspace marker target missing'
    text=text.replace(target,target+'\n  // One sync cycle belongs to exactly one active workspace')
    path.write_text(text)
