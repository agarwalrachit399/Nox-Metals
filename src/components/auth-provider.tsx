// components/auth-provider.tsx - Simplified version
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/auth";
import { UserRole, UserProfile } from "@/lib/database.types";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isUser: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userProfile: null,
  role: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  isUser: false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Auth pages and protected pages
  const authPages = ["/login", "/signup"];
  const isAuthPage = authPages.includes(pathname);
  const isProtectedPage =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname === "/audit-logs";

  // Fetch user profile and role
  const fetchUserProfile = useCallback(
    async (userId: string) => {
      try {
        const { data: profile, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return null;
        }

        return profile;
      } catch (error) {
        console.error("Error in fetchUserProfile:", error);
        return null;
      }
    },
    [supabase],
  );

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
          setRole(profile?.role ?? null);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [supabase.auth, fetchUserProfile]);

  // Listen for auth changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        setUserProfile(profile);
        setRole(profile?.role ?? null);
      } else {
        setUserProfile(null);
        setRole(null);
      }

      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase.auth, fetchUserProfile]);

  // Handle navigation
  useEffect(() => {
    if (loading) return;

    if (!user && isProtectedPage) {
      router.push("/login");
    } else if (user && isAuthPage) {
      router.push("/");
    }
  }, [user, pathname, isAuthPage, isProtectedPage, loading, router]);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
      }
    } catch (error) {
      console.error("Error in signOut:", error);
    } finally {
      setLoading(false);
    }
  };

  // Computed role helpers
  const isAdmin = role === "Admin";
  const isUser = role === "User";

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    role,
    loading,
    signOut,
    isAdmin,
    isUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
