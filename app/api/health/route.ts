import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function projectHost(raw?: string) {
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

type Probe = { reachable: boolean; status: number | null };
type RouterProbe = Probe & { ready: boolean | null };

async function probeSupabaseAuth(url: string, publishableKey: string): Promise<Probe> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      cache: "no-store",
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(3000),
    });
    return { reachable: response.ok, status: response.status };
  } catch {
    return { reachable: false, status: null };
  }
}

async function probeCatalogRouter(url: string, publishableKey: string): Promise<RouterProbe> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/catalog-router?health=1`, {
      cache: "no-store",
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(3500),
    });
    const payload = (await response.json().catch(() => null)) as { ready?: boolean } | null;
    return { reachable: response.ok, status: response.status, ready: payload?.ready === true };
  } catch {
    return { reachable: false, status: null, ready: false };
  }
}

export async function GET() {
  const authMode = process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE || "local";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const configured = Boolean(supabaseUrl && publishableKey);
  const explicitDataMode = process.env.NEXT_PUBLIC_KIUBO_DATA_MODE || "local";
  const dataMode = explicitDataMode === "supabase" || (authMode === "supabase" && configured)
    ? "supabase"
    : "local";
  const cloudRequested = authMode === "supabase" || dataMode === "supabase";

  const [authProbe, routerProbe] = configured
    ? await Promise.all([
        probeSupabaseAuth(supabaseUrl, publishableKey),
        probeCatalogRouter(supabaseUrl, publishableKey),
      ])
    : [
        { reachable: false, status: null as number | null },
        { reachable: false, status: null as number | null, ready: false as boolean | null },
      ];

  const cloudReady = configured && authProbe.reachable && routerProbe.reachable && routerProbe.ready === true;
  const ready = cloudRequested ? cloudReady : true;

  return NextResponse.json(
    {
      service: "kiubo-platform",
      ready,
      mode: { auth: authMode, data: dataMode },
      cloud: {
        requested: cloudRequested,
        configured,
        projectHost: projectHost(supabaseUrl),
        authReachable: configured ? authProbe.reachable : null,
        authStatus: configured ? authProbe.status : null,
        dataPlaneReachable: configured ? routerProbe.reachable : null,
        dataPlaneReady: configured ? routerProbe.ready : null,
        dataPlaneStatus: configured ? routerProbe.status : null,
      },
      checkedAt: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
