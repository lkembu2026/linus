import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE } from "@/lib/branch";

// Route restrictions: path prefix → allowed roles
const ROUTE_ROLES: Record<string, string[]> = {
  "/branches": ["admin"],
  "/users": ["admin"],
  "/audit": ["admin"],
  "/settings": ["admin"],
  "/transfers": ["admin", "supervisor"],
  "/analytics": ["admin", "supervisor"],
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const requestedBranch = request.nextUrl.searchParams.get("branch");
  if (requestedBranch) {
    request.cookies.set(ACTIVE_BRANCH_COOKIE, requestedBranch);
    supabaseResponse.cookies.set(ACTIVE_BRANCH_COOKIE, requestedBranch, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  } else if (
    request.nextUrl.pathname.startsWith("/") &&
    request.cookies.get(ACTIVE_BRANCH_COOKIE)?.value === ALL_BRANCHES_VALUE
  ) {
    request.cookies.set(ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE);
    supabaseResponse.cookies.set(ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  }

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

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes: redirect to login if not authenticated
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register");
  const isDashboardPage = !isAuthPage && request.nextUrl.pathname !== "/";

  if (!user && isDashboardPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged in and on auth page, redirect to dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Role-based route protection
  if (user && isDashboardPage) {
    const pathname = request.nextUrl.pathname;
    const restrictedRoute = Object.entries(ROUTE_ROLES).find(([path]) =>
      pathname.startsWith(path),
    );

    if (restrictedRoute) {
      const [, allowedRoles] = restrictedRoute;
      // Fetch user role from the users table
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = (userData as { role: string } | null)?.role;

      if (!userRole || !allowedRoles.includes(userRole)) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
