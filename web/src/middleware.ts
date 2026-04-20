import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isProtectedRoute(pathname: string): boolean {
  if (pathname.startsWith("/profile")) return true
  if (pathname.match(/^\/fleamarkets\/[^/]+\/edit/)) return true
  return false
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // www redirect
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.replace("www.", "");
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  // Auth guard for protected routes
  if (isProtectedRoute(request.nextUrl.pathname)) {
    const hasAuthCookie = request.cookies.getAll().some(
      (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
    )
    if (!hasAuthCookie) {
      const loginUrl = new URL("/auth", request.url)
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
