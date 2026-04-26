import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.replace("www.", "");
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  // Refresh the Supabase session on every navigation so the auth cookies
  // stay valid. The session cookies are httpOnly + secure (set by
  // @supabase/ssr) — tokens are not exposed to client JS.
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    // Skip Next internals + static assets. The api/* exclusion is from the
    // pre-existing config; if you add API routes that need auth they must
    // construct their own server client via createSupabaseServerClient().
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
