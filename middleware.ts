export { default } from "next-auth/middleware";

export const config = {
  // Protect all routes except auth endpoints and static assets
  matcher: [
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
