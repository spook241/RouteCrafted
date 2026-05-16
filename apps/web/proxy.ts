import { auth } from "@/auth";
import { NextResponse } from "next/server";

const MOBILE_API_PREFIXES = ["/api/mobile", "/api/auth/mobile"];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Handle CORS for mobile API routes
  const isMobileApi = MOBILE_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (isMobileApi) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }
    const res = NextResponse.next();
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Auth guard for protected page routes
  const isLoggedIn = !!req.auth;
  const protectedPrefixes = ["/dashboard", "/trips", "/profile", "/admin"];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trips/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/api/mobile/:path*",
    "/api/auth/mobile/:path*",
  ],
};
