import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isPrivateMode } from "@/lib/private-mode";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPrivateMode && req.nextUrl.pathname === "/api/webhook") {
    return new NextResponse(null, { status: 404 });
  }

  const { orgId, userId } = await auth();
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  if (userId && isPublicRoute(req)) {
    let path = "/select-org";

    if (orgId) {
      path = `/organization/${orgId}`;
    }

    const orgSelection = new URL(path, req.url);
    return NextResponse.redirect(orgSelection);
  }

  if (userId && !orgId && req.nextUrl.pathname !== "/select-org") {
    const orgSelection = new URL("/select-org", req.url);
    return NextResponse.redirect(orgSelection);
  }
});

// The MCP route authenticates with agent tokens, not Clerk sessions, so the
// proxy never runs on it; it returns 404 itself unless MCP_ENABLED is set
// (ADR 0001, ADR 0002).
export const config = {
  matcher: [
    // Skip Next.js internals, the MCP route and all static files, unless found in search params
    "/((?!_next|api/mcp\\b|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes except the MCP route
    "/(api(?!/mcp\\b)|trpc)(.*)",
  ],
};
