import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "./lib/supabase/middleware";
import { loppisRoute } from "./lib/loppis-routing";

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
  const { response, supabase, userId } = await updateSupabaseSession(request);

  // Server-side gate for /admin/*. The client AdminShell already does this,
  // but enforcing here closes the SSR window where someone could observe
  // any HTML that admin pages emit before the client redirect fires.
  // /admin/invite/accept is intentionally open — invitees may be either
  // unauthenticated (new user) or authenticated-but-not-admin (existing
  // user accepting the role), and the page validates the token itself.
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/invite")) {
    if (!userId) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const { data: isAdmin } = await supabase.rpc("is_admin", { uid: userId });
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // /loppis/<slug> without a session goes to the ISR-cached copy; signed-in
  // visitors stay on the cookie route so organizers see their drafts. See
  // lib/loppis-routing.ts.
  const loppis = loppisRoute(pathname, userId !== null);
  if (loppis.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = loppis.pathname;
    return NextResponse.redirect(url, 308);
  }
  if (loppis.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = loppis.pathname;
    const rewritten = NextResponse.rewrite(url, { request });
    // Keep anything the session refresh wrote (e.g. clearing a dead session).
    for (const cookie of response.cookies.getAll()) rewritten.cookies.set(cookie);
    return rewritten;
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next internals + static assets. The api/* exclusion is from the
    // pre-existing config; if you add API routes that need auth they must
    // construct their own server client via createSupabaseServerClient().
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
