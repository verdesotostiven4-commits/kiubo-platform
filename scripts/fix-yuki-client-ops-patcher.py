from pathlib import Path
p=Path('scripts/apply-yuki-client-ops-suite-v1.py')
t=p.read_text()
old="""needle='  const checkout=async()=>{\\n    if(!cart.length){setMessage(\"Agrega al menos un producto\");return}\\n'\nreplacement='  const checkout=async()=>{\\n    if(!cart.length){setMessage(\"Agrega al menos un producto\");return}\\n    if(payment===\"cash\"&&!internalConsumption&&total>0&&cashReceived.trim()&&(!Number.isFinite(receivedNumber)||receivedNumber<total)){setMessage(`Recibido insuficiente · faltan ${money(total-(Number.isFinite(receivedNumber)?receivedNumber:0))}`);return}\\n'"""
new="""needle='  const checkout=async()=>{\\n    if(!cart.length){setMessage(\"Agrega al menos un producto\");return}if(payment===\"mixed\"&&!mixedIsValid){setMessage(\"En pago mixto debe haber una parte en efectivo y otra por transferencia\");return}'\nreplacement='  const checkout=async()=>{\\n    if(!cart.length){setMessage(\"Agrega al menos un producto\");return}\\n    if(payment===\"cash\"&&!internalConsumption&&total>0&&cashReceived.trim()&&(!Number.isFinite(receivedNumber)||receivedNumber<total)){setMessage(`Recibido insuficiente · faltan ${money(total-(Number.isFinite(receivedNumber)?receivedNumber:0))}`);return}\\n    if(payment===\"mixed\"&&!mixedIsValid){setMessage(\"En pago mixto debe haber una parte en efectivo y otra por transferencia\");return}'"""
if old not in t: raise SystemExit('checkout matcher source not found')
t=t.replace(old,new,1)
t=t.replace("if(payment===\"cash\"&&settings.requireCashSession&&!cashSession)","if(payment===\"cash\"&&currentSettings.requireCashSession&&!cashSession)")
t=t.replace("if(payment===\"cash\"&&total>0&&settings.requireCashSession&&!cashSession)","if(payment===\"cash\"&&total>0&&currentSettings.requireCashSession&&!cashSession)")
p.write_text(t)
print('patch matcher repaired')
