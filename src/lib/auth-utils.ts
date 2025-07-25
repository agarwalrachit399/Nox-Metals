// lib/auth-utils.ts
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { UserRole } from './database.types'

// Create server-side Supabase client for API routes
export const createServerSupabaseClient = () => {
  try {
    // Await cookies() since it returns a Promise
    const getCookieStore = async () => await cookies();

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async getAll() {
            try {
              const cookieStore = await getCookieStore();
              return cookieStore.getAll();
            } catch (error) {
              // Handle case where cookies are not available (e.g., during sign out)
              return [];
            }
          },
          async setAll(cookiesToSet) {
            try {
              const cookieStore = await getCookieStore();
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // The `setAll` method was called from a Server Component
              // or cookies are not available. This can be ignored.
              console.warn('Could not set cookies:', error);
            }
          },
        },
      }
    )
  } catch (error) {
    console.warn('Could not create Supabase client:', error)
    // Return a minimal client that will fail auth checks gracefully
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {}
        }
      }
    )
  }
}

// Get authenticated user from API request
export const getAuthenticatedUser = async () => {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null, error: 'Not authenticated' }
    }

    return { user, error: null }
  } catch (error) {
    return { user: null, error: 'Authentication failed' }
  }
}

// Get user role from database
export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const supabase = createServerSupabaseClient()
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user role:', error)
      return null
    }

    return userProfile?.role ?? null
  } catch (error) {
    console.error('Error in getUserRole:', error)
    return null
  }
}

// Validate user has required role
export const validateUserRole = async (requiredRole: UserRole) => {
  const { user, error } = await getAuthenticatedUser()
  
  if (error || !user) {
    return {
      success: false,
      error: 'Authentication required',
      status: 401
    }
  }

  const userRole = await getUserRole(user.id)
  
  if (!userRole) {
    return {
      success: false,
      error: 'User role not found',
      status: 403
    }
  }

  if (userRole !== requiredRole) {
    return {
      success: false,
      error: `${requiredRole} access required`,
      status: 403
    }
  }

  return {
    success: true,
    user,
    role: userRole
  }
}

// Validate admin access
export const validateAdminAccess = async () => {
  return validateUserRole('Admin')
}

// Validate any authenticated user
export const validateAuthenticatedUser = async () => {
  const { user, error } = await getAuthenticatedUser()
  
  if (error || !user) {
    return {
      success: false,
      error: 'Authentication required',
      status: 401
    }
  }

  const userRole = await getUserRole(user.id)
  
  return {
    success: true,
    user,
    role: userRole
  }
}

// API Response helpers
export const createErrorResponse = (message: string, status: number) => {
  return Response.json({ error: message }, { status })
}

export const createSuccessResponse = (data: any, status: number = 200) => {
  return Response.json(data, { status })
}