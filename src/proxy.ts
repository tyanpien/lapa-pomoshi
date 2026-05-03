import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type AuthRole = "user" | "volunteer" | "organization";

const isAuthRole = (role: string | undefined): role is AuthRole =>
  role === "user" || role === "volunteer" || role === "organization";

const getDefaultRouteByRole = (role: AuthRole) => {
  if (role === "volunteer") return "/volunteer/profile";
  if (role === "organization") return "/organization/profile";
  return "/profile";
};

const isAllowedByRole = (pathname: string, role: AuthRole) => {
  if (pathname.startsWith("/volunteer")) return role === "volunteer";
  if (pathname.startsWith("/organization")) return role === "organization";
  if (pathname.startsWith("/messages")) return true;
  if (pathname.startsWith("/profile")) return role === "user" || role === "volunteer";
  return false;
};

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;
  const roleCookie = request.cookies.get("auth_role")?.value;
  const role = isAuthRole(roleCookie) ? roleCookie : undefined;

  if (!token || !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAllowedByRole(pathname, role)) {
    return NextResponse.redirect(new URL(getDefaultRouteByRole(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*", "/volunteer/:path*", "/messages/:path*", "/organization/:path*"],
};
