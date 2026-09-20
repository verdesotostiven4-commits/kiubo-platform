const CLIENT_PREVIEW_KEY="kiubo.admin.client-preview.v1";

export function isClientPreviewMode(){
  if(typeof window==="undefined")return false;
  const requested=new URLSearchParams(window.location.search).get("preview")==="client";
  if(requested)window.sessionStorage.setItem(CLIENT_PREVIEW_KEY,"1");
  return requested||window.sessionStorage.getItem(CLIENT_PREVIEW_KEY)==="1";
}

export function clearClientPreviewMode(){
  if(typeof window!=="undefined")window.sessionStorage.removeItem(CLIENT_PREVIEW_KEY);
}

export function effectivePlatformAdmin(platformAdmin?:boolean){
  return Boolean(platformAdmin)&&!isClientPreviewMode();
}
