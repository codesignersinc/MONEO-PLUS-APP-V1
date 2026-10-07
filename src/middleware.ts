import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isFinanzasRoute =
    request.nextUrl.pathname.startsWith('/finanzas') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname === '/mini';
  // Exact pages only: a prefix match would also catch static files like /register-sw.js.
  const isAuthRoute = ['/login', '/register', '/recuperar'].some(
    (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`)
  );

  if (!user && isFinanzasRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // MONEO Mini returns to itself after signing in.
    url.search = request.nextUrl.pathname === '/mini' ? '?next=/mini' : '';
    return NextResponse.redirect(url);
  }

  // Signed-in users skip the public landing.
  if (user && (isAuthRoute || request.nextUrl.pathname === '/')) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get('next');
    url.pathname = next === '/mini' ? '/mini' : '/finanzas';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|json|webmanifest|txt|xml|gz|wasm)$).*)',
  ],
};
