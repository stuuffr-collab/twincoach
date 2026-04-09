import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_KEY_COOKIE_NAME = "twincoachAdminKey";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/admin") {
    return NextResponse.next();
  }

  const expectedAdminKey = process.env.ALPHA_OPERATOR_KEY?.trim();

  if (!expectedAdminKey) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin";
    redirectUrl.searchParams.set("error", "admin-not-configured");
    return NextResponse.redirect(redirectUrl);
  }

  const providedAdminKey =
    request.cookies.get(ADMIN_KEY_COOKIE_NAME)?.value?.trim() ?? "";

  if (providedAdminKey !== expectedAdminKey) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin";
    redirectUrl.searchParams.set("error", "admin-access-required");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
