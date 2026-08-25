import type { MetadataRoute } from "next";

type KiuboManifest=MetadataRoute.Manifest&{display_override?:string[]};

export default function manifest():KiuboManifest{
  return{
    name:"KIUBO · Todo tu negocio, en orden",
    short_name:"KIUBO",
    description:"Ventas, inventario, caja, clientes y control en un solo lugar.",
    start_url:"/app",
    scope:"/",
    display:"standalone",
    display_override:["window-controls-overlay","standalone"],
    background_color:"#f7faff",
    theme_color:"#0b2d27",
    icons:[
      {src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"},
    ],
  };
}
