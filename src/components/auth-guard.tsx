// components/auth-guard.tsx
"use client";

import { useAuth } from "./auth-provider";
import { FullScreenLoading } from "./ui/loading-spinner";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading } = useAuth();

  // Show loading while checking auth or during transitions
  if (loading) {
    return fallback || <FullScreenLoading message="Loading..." />;
  }

  // If user is not authenticated, show loading while redirect happens
  if (!user) {
    return <FullScreenLoading message="Redirecting..." />;
  }

  // User is authenticated, show protected content
  return <>{children}</>;
}
