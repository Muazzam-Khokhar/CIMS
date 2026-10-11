import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "@/lib/auth";

const LOGIN_PAGE = "/login";

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/logout",
];

async function isAuthenticated(
  request: NextRequest,
) {
  const token = request.cookies.get(
    AUTH_COOKIE_NAME,
  )?.value;

  if (!token) {
    return false;
  }

  const auth = await verifyAuthToken(token);

  return !!auth;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === LOGIN_PAGE;

  const isPublicApi = PUBLIC_API_ROUTES.includes(
    pathname,
  );

  if (isPublicApi) {
    return NextResponse.next();
  }

  const authenticated =
    await isAuthenticated(request);

  /*
   * Authenticated user should not see login page.
   */
  if (isLoginPage && authenticated) {
    return NextResponse.redirect(
      new URL("/", request.url),
    );
  }

  /*
   * Login page is public.
   */
  if (isLoginPage) {
    return NextResponse.next();
  }

  /*
   * Everything else requires authentication.
   */
  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const loginUrl = new URL(
      LOGIN_PAGE,
      request.url,
    );

    loginUrl.searchParams.set(
      "next",
      pathname,
    );

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};