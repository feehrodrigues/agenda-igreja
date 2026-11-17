import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Apenas o dashboard é protegido
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/programas(.*)',
]);

// Prévia local do programa (dados fictícios): liberada só em desenvolvimento.
const isPreviewLocal = (request) =>
  process.env.NODE_ENV !== 'production' &&
  request.nextUrl.pathname.replace(/\/$/, '') === '/programas/preview';

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request) && !isPreviewLocal(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
