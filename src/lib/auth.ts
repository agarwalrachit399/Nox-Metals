// lib/auth.ts
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { Database } from "./database.types";
import { cookies } from "next/headers";

// Client-side Supabase client for components
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
};

// Server-side Supabase client for server components and API routes
export const createServerSupabaseClient = async (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};
// Auth helper functions
export const getUser = async (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) => {
  const supabase = await createServerSupabaseClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Error getting user:", error);
    return null;
  }

  return user;
};
export const getSession = async (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) => {
  const supabase = await createServerSupabaseClient(cookieStore);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Error getting session:", error);
    return null;
  }

  return session;
};
