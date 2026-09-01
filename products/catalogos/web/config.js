(() => {
  const themeHref = "/hakuna.theme.css?v=4.3.0";
  if (!document.querySelector(`link[href^="${themeHref.split("?")[0]}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = themeHref;
    link.dataset.kiuboClientTheme = "hakuna-matata";
    document.head.append(link);
  }
})();

window.KIUBO_CATALOG_CONFIG = Object.freeze({
  supabaseUrl: "https://hysrlckmnzlmscwwbibn.supabase.co",
  publishableKey: "sb_publishable_hnsAgTsI1c_wErMMwAYwMQ_crWdOBpT",
  apiUrl: "https://hysrlckmnzlmscwwbibn.supabase.co/functions/v1/catalog-router",
  defaultSlug: "hakuna-matata",
  version: "4.3.0"
});
