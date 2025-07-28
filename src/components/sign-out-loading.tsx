// src/components/sign-out-loading.tsx
"use client";

import { LogOut } from "lucide-react";
import { FullScreenLoading } from "./ui/loading-spinner";

export default function SignOutLoading() {
  return (
    <FullScreenLoading
      title="Signing Out"
      message="Please wait while we securely sign you out..."
      icon={<LogOut className="h-6 w-6 text-gray-600" />}
    />
  );
}
