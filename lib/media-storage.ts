import { getSupabaseBrowserClient } from "./supabase-browser";

const BUCKET="kiubo-media";
const ACCEPTED=new Set(["image/jpeg","image/png","image/webp"]);
const MAX_SOURCE_BYTES=15*1024*1024;

type MediaKind="product"|"logo";
type UploadMediaInput={tenantId:string;branchId?:string;entityId:string;file:File;kind:MediaKind};

function safeSegment(value:string){return value.replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,120)||"asset"}
function loadImage(file:File):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("No pudimos leer esa imagen"))};
    img.src=url;
  });
}
function canvasBlob(canvas:HTMLCanvasElement,type:string,quality:number){
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No pudimos optimizar la imagen")),type,quality));
}

export async function optimizeImage(file:File,kind:MediaKind){
  if(!ACCEPTED.has(file.type))throw new Error("Usa una imagen JPG, PNG o WebP");
  if(file.size>MAX_SOURCE_BYTES)throw new Error("La imagen es demasiado pesada. Usa una de máximo 15 MB");
  const image=await loadImage(file);
  const max=kind==="logo"?1200:960;
  const ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*ratio)),height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:true});if(!ctx)throw new Error("Tu navegador no pudo preparar la imagen");
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(image,0,0,width,height);
  // WebP keeps transparency for logos and is dramatically lighter for product photography.
  const quality=kind==="logo"?.9:.82;
  const blob=await canvasBlob(canvas,"image/webp",quality);
  if(blob.size>6*1024*1024)throw new Error("La imagen optimizada sigue siendo demasiado grande");
  return{blob,width,height,sourceBytes:file.size,optimizedBytes:blob.size};
}

export async function uploadOptimizedMedia(input:UploadMediaInput){
  const client=getSupabaseBrowserClient();if(!client)throw new Error("KIUBO Cloud no está disponible para subir imágenes");
  const optimized=await optimizeImage(input.file,input.kind);
  const id=safeSegment(input.entityId),stamp=Date.now();
  const folder=input.kind==="logo"?`${input.tenantId}/branding`:`${input.tenantId}/${input.branchId||"shared"}/products`;
  const path=`${folder}/${id}-${stamp}.webp`;
  const upload=await client.storage.from(BUCKET).upload(path,optimized.blob,{contentType:"image/webp",cacheControl:"31536000",upsert:false});
  if(upload.error)throw new Error(upload.error.message);
  const publicUrl=client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  if(!publicUrl)throw new Error("KIUBO no pudo obtener la URL de la imagen");
  return{url:publicUrl,path,...optimized};
}

export function mediaSavings(sourceBytes:number,optimizedBytes:number){
  if(sourceBytes<=0)return 0;
  return Math.max(0,Math.round((1-optimizedBytes/sourceBytes)*100));
}
