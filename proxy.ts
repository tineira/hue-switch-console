import { NextResponse, type NextRequest } from "next/server";

const INVITE_COOKIE = "hsw_invite";

export function proxy(request: NextRequest) {
  // /login?invite=inv_… keeps the code in a short-lived cookie so the sign-up gate
  // can read it on any sign-in method, including the OAuth return trip.
  const invite = request.nextUrl.searchParams.get("invite");
  if (request.nextUrl.pathname === "/login" && invite?.startsWith("inv_")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("invite");
    const response = NextResponse.redirect(url);
    response.cookies.set(INVITE_COOKIE, invite, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60,
    });
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
