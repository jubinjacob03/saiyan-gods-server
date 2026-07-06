import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshing the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If this request is coming from the Discord Activity iframe, instantly redirect to /nexkord--movies
  // This prevents Discord users from ever hitting the dashboard or the login page.
  if (request.nextUrl.searchParams.has("frame_id") && !request.nextUrl.pathname.startsWith("/nexkord--movies")) {
    const url = request.nextUrl.clone();
    url.pathname = "/nexkord--movies";
    return NextResponse.redirect(url);
  }

  // Protect routes - redirect to login if not authenticated
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/nexkord--movies")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect to home if already logged in and trying to access login
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Exclude API routes, nexkord--movies, tmdb proxy paths, and Discord's .proxy path
    "/((?!_next/static|_next/image|favicon.ico|api/|nexkord--movies/|tmdb-api/|tmdb-image/|\\.proxy/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
