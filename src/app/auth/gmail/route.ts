import { NextResponse, type NextRequest } from 'next/server';

// Return address of Google's Gmail consent screen. It lives on moneo.plus so Google shows
// "Ir a moneo.plus" instead of the Supabase domain; it only hands the query (code, state or
// error) to the mail-oauth Edge Function, which does the token exchange.
export function GET(request: NextRequest) {
  const fn = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mail-oauth/google`;
  return NextResponse.redirect(`${fn}${request.nextUrl.search}`);
}
