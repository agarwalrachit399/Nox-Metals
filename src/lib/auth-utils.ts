// lib/auth-utils.ts - Simplified version
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { UserRole } from "./database.types";

// Create server-side Supabase client for API routes
export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    },
  );
};

// Get authenticated user
export const getAuthenticatedUser = async (request?: NextRequest) => {
  console.log(request);
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, error: error?.message || "Not authenticated" };
    }

    return { user, error: null };
  } catch (error) {
    console.error("Error in getAuthenticatedUser:", error);
    return { user: null, error: "Authentication failed" };
  }
};

// Get user role from database
export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userProfile, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user role:", error);
      return null;
    }

    return (userProfile?.role as UserRole) ?? null;
  } catch (error) {
    console.error("Error in getUserRole:", error);
    return null;
  }
};

// Validate any authenticated user
export const validateAuthenticatedUser = async (request?: NextRequest) => {
  const { user, error } = await getAuthenticatedUser(request);

  if (error || !user) {
    return {
      success: false,
      error: "Authentication required",
      status: 401,
    };
  }

  const userRole = await getUserRole(user.id);

  return {
    success: true,
    user,
    role: userRole,
  };
};

// Validate admin access
export const validateAdminAccess = async (request?: NextRequest) => {
  const { user, error } = await getAuthenticatedUser(request);

  if (error || !user) {
    return {
      success: false,
      error: "Authentication required",
      status: 401,
    };
  }

  const userRole = await getUserRole(user.id);

  if (!userRole) {
    return {
      success: false,
      error: "User role not found",
      status: 403,
    };
  }

  if (userRole !== "Admin") {
    return {
      success: false,
      error: "Admin access required",
      status: 403,
    };
  }

  return {
    success: true,
    user,
    role: userRole,
  };
};

// Simple error response
export const createErrorResponse = (message: string, status: number) => {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
};

export const createSuccessResponse = <T>(data: T, status: number = 200) => {
  return Response.json(data, { status });
};
