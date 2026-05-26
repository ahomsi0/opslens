import { NextResponse, type NextRequest } from "next/server";

// Routes that require a session cookie. Anything not in this list (landing,
// /login, /signup, OAuth callbacks, static assets) is public.
const PROTECTED = ["/dashboard", "/projects", "/integrations"];

const SESSION_COOKIE = "opslens_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return NextResponse.next();

  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
  if (hasSession) return NextResponse.next();

  // Redirect to /login with a "next" param so we can bounce them back after auth.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Limit middleware to the paths it might gate, plus the auth pages so we
// can redirect already-signed-in users away from /login.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/integrations/:path*",
  ],
};
