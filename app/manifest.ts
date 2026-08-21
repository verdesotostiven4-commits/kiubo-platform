import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{return{name:"KIUBO",short_name:"KIUBO",description:"Todo tu negocio, en orden.",start_url:"/app",display:"standalone",background_color:"#fff6e8",theme_color:"#ff5b55",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml"}]}}
