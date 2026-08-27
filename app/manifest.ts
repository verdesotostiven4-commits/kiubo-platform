import type { MetadataRoute } from "next";
import { KIUBO_ICON_URL } from "@/lib/kiubo-brand-assets";

type KiuboManifest=MetadataRoute.Manifest&{display_override?:string[]};
export default function manifest():KiuboManifest{return{name:"KIUBO · Todo tu negocio, en orden",short_name:"KIUBO",description:"Ventas, inventario, caja, clientes y control en un solo lugar.",start_url:"/app",scope:"/",display:"fullscreen",display_override:["fullscreen","window-controls-overlay","standalone"],background_color:"#0a201d",theme_color:"#0b2d27",icons:[{src:KIUBO_ICON_URL,sizes:"512x512",purpose:"any"},{src:KIUBO_ICON_URL,sizes:"512x512",purpose:"maskable"}]}}
