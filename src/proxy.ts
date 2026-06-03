import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { handleOrderSession } from "@/lib/orderSessionProxy";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/order(.*)",
  "/event(.*)",
  "/store(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const orderResult = await handleOrderSession(req);
  if (orderResult) return orderResult;

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)",
    "/(api|trpc)(.*)",
  ],
};
