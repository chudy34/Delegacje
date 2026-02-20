import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/auth/login', '/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Przepuść publiczne ścieżki i zasoby Next.js
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Backend ustawia httpOnly cookie 'accessToken' po loginie.
  // Next.js middleware ma dostęp do cookies (nie localStorage).
  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    // Zapisz docelową stronę żeby po loginie wrócić
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Dopasuj wszystkie ścieżki poza statycznymi plikami i internals Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
