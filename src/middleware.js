import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Apenas o dashboard é protegido
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)', 
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};