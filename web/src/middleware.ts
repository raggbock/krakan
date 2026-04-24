import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.replace("www.", "");
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/invite/accept")) return NextResponse.next();

    // Supabase SSR can chunk the auth token into cookies named
    // `sb-<ref>-auth-token`, `.0`, `.1`, etc. A broad `sb-*` match picks
    // up all shapes. Layout's is_admin() remains the authoritative gate;
    // middleware is just a cheap redirect for obviously-unauth traffic.
    const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
