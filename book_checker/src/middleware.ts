import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Home Assistant Ingress Path is provided in the headers
  const ingressPath = request.headers.get('x-ingress-path');
  
  // Our built-in base path from next.config.ts
  const internalBasePath = '/api/hassio_ingress/book_checker';

  // If we are being accessed via a different ingress path (e.g., a dynamic token),
  // we rewrite the request to match the internalBasePath Next.js expects.
  if (ingressPath && ingressPath !== internalBasePath) {
    if (pathname.startsWith(ingressPath)) {
      const newPath = pathname.replace(ingressPath, internalBasePath);
      return NextResponse.rewrite(new URL(newPath, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths so we can handle asset rewriting
  matcher: '/:path*',
};
