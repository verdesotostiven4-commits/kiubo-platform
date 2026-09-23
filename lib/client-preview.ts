const CLIENT_PREVIEW_KEY="kiubo.admin.client-preview.v1";
const CLIENT_PREVIEW_WORKSPACE_KEY="kiubo.admin.client-preview.workspace.v1";

export type ClientPreviewWorkspace={tenantId:string;branchId?:string};

function requestedWorkspace():ClientPreviewWorkspace|null{
  if(typeof window==="undefined")return null;
  const params=new URLSearchParams(window.location.search);
  if(params.get("preview")!=="client")return null;
  const tenantId=String(params.get("tenant")||"").trim();
  const branchId=String(params.get("branch")||"").trim();
  if(!tenantId)return null;
  return{tenantId,branchId:branchId||undefined};
}

function persistRequestedPreview(){
  if(typeof window==="undefined")return null;
  const requested=new URLSearchParams(window.location.search).get("preview")==="client";
  const workspace=requestedWorkspace();
  if(requested)window.sessionStorage.setItem(CLIENT_PREVIEW_KEY,"1");
  if(workspace)window.sessionStorage.setItem(CLIENT_PREVIEW_WORKSPACE_KEY,JSON.stringify(workspace));
  return{requested,workspace};
}

export function isClientPreviewMode(){
  if(typeof window==="undefined")return false;
  const state=persistRequestedPreview();
  return state.requested||window.sessionStorage.getItem(CLIENT_PREVIEW_KEY)==="1";
}

export function getClientPreviewWorkspace():ClientPreviewWorkspace|null{
  if(typeof window==="undefined")return null;
  const state=persistRequestedPreview();
  if(state.workspace)return state.workspace;
  try{
    const raw=window.sessionStorage.getItem(CLIENT_PREVIEW_WORKSPACE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as Partial<ClientPreviewWorkspace>;
    const tenantId=String(parsed.tenantId||"").trim(),branchId=String(parsed.branchId||"").trim();
    return tenantId?{tenantId,branchId:branchId||undefined}:null;
  }catch{return null}
}

export function setClientPreviewWorkspace(tenantId:string,branchId?:string){
  if(typeof window==="undefined")return;
  window.sessionStorage.setItem(CLIENT_PREVIEW_KEY,"1");
  window.sessionStorage.setItem(CLIENT_PREVIEW_WORKSPACE_KEY,JSON.stringify({tenantId,branchId:branchId||undefined}));
}

export function clientPreviewUrl(tenantId:string,branchId?:string){
  const params=new URLSearchParams({preview:"client",tenant:tenantId});
  if(branchId)params.set("branch",branchId);
  return `/app?${params.toString()}`;
}

export function clearClientPreviewMode(){
  if(typeof window!=="undefined"){
    window.sessionStorage.removeItem(CLIENT_PREVIEW_KEY);
    window.sessionStorage.removeItem(CLIENT_PREVIEW_WORKSPACE_KEY);
  }
}

export function effectivePlatformAdmin(platformAdmin?:boolean){
  return Boolean(platformAdmin)&&!isClientPreviewMode();
}
