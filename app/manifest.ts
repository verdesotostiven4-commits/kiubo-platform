import type { MetadataRoute } from "next";

const KIUBO_INSTALL_ICON="https://blogger.googleusercontent.com/img/a/AVvXsEhKMHanXsqFTA1HgWHkeQmCzsHpL_qqREfV7uY6U_97DnHM0Ito7RorUwZk8VY94alzkhDc4gjqWJx82xuxDo_mwHkdC_0PCL7xu2KDES5_gBMTEos4pJF8bkujdRn81sjcNZO7QNlrqTH5sX9kmCd4Wgh1XDq3XvKOE-m_ZVRBnC_pIUbG4ae7txFoLpA";

export default function manifest():MetadataRoute.Manifest{
  return{
    name:"KIUBO · Todo tu negocio, en orden",
    short_name:"KIUBO",
    description:"Ventas, inventario, caja, clientes y control en un solo lugar.",
    start_url:"/app",
    scope:"/",
    display:"fullscreen",
    background_color:"#f7faff",
    theme_color:"#0b2748",
    icons:[{src:KIUBO_INSTALL_ICON,purpose:"any"}],
  };
}
