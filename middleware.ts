import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session-token";

const SESSION_COOKIE_NAME = "auth_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login/signup pages and API auth routes
  if (pathname === "/login" || pathname === "/signup" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    // No session, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate session
  const session = await verifySession(sessionCookie.value);

  if (!session) {
    // Invalid or expired session, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // Session is valid, allow request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    // manifest.webmanifest: browsers fetch it without cookies, so it must stay public
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

