import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./database.types";

// Client-side Supabase client for components
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
};
