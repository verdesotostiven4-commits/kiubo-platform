import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * proxy.ts — reemplaza a middleware.ts en Next.js 16.
 * Refresca la sesión de Supabase en cada request antes del render.
 * Runtime: nodejs (no edge).
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión. Si no existe, continúa sin sesionar (las rutas deciden auth).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Excluir estáticos e imágenes para no correr auth sobre assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
