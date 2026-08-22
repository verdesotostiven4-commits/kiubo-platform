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

async function probeSupabaseAuth(url: string, publishableKey: string) {
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

export async function GET() {
  const authMode = process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE || "local";
  const dataMode = process.env.NEXT_PUBLIC_KIUBO_DATA_MODE || "local";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const cloudRequested = authMode === "supabase" || dataMode === "supabase";
  const configured = Boolean(supabaseUrl && publishableKey);
  const probe = configured
    ? await probeSupabaseAuth(supabaseUrl, publishableKey)
    : { reachable: false, status: null as number | null };
  const ready = cloudRequested ? configured && probe.reachable : true;

  return NextResponse.json(
    {
      service: "kiubo-platform",
      ready,
      mode: { auth: authMode, data: dataMode },
      cloud: {
        requested: cloudRequested,
        configured,
        projectHost: projectHost(supabaseUrl),
        authReachable: configured ? probe.reachable : null,
        authStatus: configured ? probe.status : null,
      },
      checkedAt: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
