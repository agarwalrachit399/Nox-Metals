// src/components/sign-out-loading.tsx
'use client'

import { Loader2, LogOut } from 'lucide-react'

export default function SignOutLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
          <LogOut className="h-6 w-6 text-gray-600" />
        </div>
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-semibold mb-2">Signing Out</h3>
        <p className="text-muted-foreground">Please wait while we securely sign you out...</p>
      </div>
    </div>
  )
}