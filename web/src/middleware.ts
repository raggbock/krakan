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

    const hasSession = request.cookies.has("sb-access-token") ||
                       request.cookies.getAll().some(c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
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
