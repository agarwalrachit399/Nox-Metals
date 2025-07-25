// components/role-guard.tsx
'use client'

import { useAuth } from './auth-provider'
import { UserRole } from '@/lib/database.types'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
  requireAuth?: boolean
}

export default function RoleGuard({ 
  children, 
  allowedRoles, 
  fallback = null,
  requireAuth = true 
}: RoleGuardProps) {
  const { user, role, loading } = useAuth()

  // Show loading while checking auth
  if (loading) {
    return fallback
  }

  // Check authentication if required
  if (requireAuth && !user) {
    return fallback
  }

  // Check role authorization
  if (role && allowedRoles.includes(role)) {
    return <>{children}</>
  }

  // User doesn't have required role
  return fallback
}

// Convenience component for admin-only content
export function AdminOnly({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['Admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

// Convenience component for user-only content (excluding admins)
export function UserOnly({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['User']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

// Convenience component for any authenticated user
export function AuthenticatedOnly({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['Admin', 'User']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}