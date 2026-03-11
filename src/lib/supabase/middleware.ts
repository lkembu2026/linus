import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClientRaw } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE } from "@/lib/branch";

// Route restrictions: path prefix → allowed roles
const ROUTE_ROLES: Record<string, string[]> = {
  "/branches": ["super_admin", "admin"],
  "/users": ["super_admin", "admin"],
  "/audit": ["super_admin", "admin"],
  "/settings": ["super_admin", "admin"],
  "/transfers": ["super_admin", "admin", "supervisor"],
  "/analytics": ["super_admin", "admin", "supervisor"],
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
    request.nextUrl.pathname.startsWith("/register") ||
    request.nextUrl.pathname.startsWith("/reset-password");
  const isPublicRoute =
    isAuthPage ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/auth/callback");
  const isDashboardPage = !isPublicRoute;

  if (!user && isDashboardPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // If logged in and on auth page (but NOT reset-password), redirect to dashboard
  if (
    user &&
    isAuthPage &&
    !request.nextUrl.pathname.startsWith("/reset-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
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
      // Use service-role client to bypass RLS for role lookup
      const adminSupabase = createAdminClientRaw(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const { data: userData } = await adminSupabase
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
