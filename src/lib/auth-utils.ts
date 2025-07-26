// lib/auth-utils.ts - COMPLETE FINAL VERSION
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { UserRole } from './database.types'

// Create server-side Supabase client for API routes - FIXED
export const createServerSupabaseClient = async () => {
  try {
    console.log('🏗️ Creating server Supabase client...')
    
    const cookieStore = await cookies()

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const allCookies = cookieStore.getAll()
            console.log('🍪 Server: Got cookies:', allCookies.length)
            return allCookies
          },
          setAll(cookiesToSet) {
            console.log('🍪 Server: Setting cookies:', cookiesToSet.length)
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              // This can fail in API routes, that's ok
              console.log('⚠️ Could not set cookies in API route:', error)
            }
          },
        },
      }
    )
  } catch (error) {
    console.error('💥 Error creating server Supabase client:', error)
    throw error
  }
}

// Get authenticated user from API request - FIXED
export const getAuthenticatedUser = async () => {
  try {
    console.log('🔐 Getting authenticated user...')
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    console.log('👤 Auth user result:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      hasError: !!error,
      error: error?.message
    })

    if (error || !user) {
      console.log('❌ No authenticated user:', error?.message || 'No user')
      return { user: null, error: 'Not authenticated' }
    }

    return { user, error: null }
  } catch (error) {
    console.error('💥 Error in getAuthenticatedUser:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

// Get user role from database - FIXED
export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    console.log('👑 Getting user role for:', userId)
    const supabase = await createServerSupabaseClient()
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    console.log('👑 User role result:', {
      role: userProfile?.role,
      hasError: !!error,
      error: error?.message,
      userId
    })

    if (error) {
      console.error('❌ Error fetching user role:', error)
      return null
    }

    // Explicit type assertion to ensure TypeScript recognizes both Admin and User
    return (userProfile?.role as UserRole) ?? null
  } catch (error) {
    console.error('💥 Error in getUserRole:', error)
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
  console.log('🔒 Validating admin access...')
  
  const { user, error } = await getAuthenticatedUser()
  
  if (error || !user) {
    console.log('❌ Admin validation failed: No user')
    return {
      success: false,
      error: 'Authentication required',
      status: 401
    }
  }

  const userRole = await getUserRole(user.id)
  
  if (!userRole) {
    console.log('❌ Admin validation failed: No role found')
    return {
      success: false,
      error: 'User role not found',
      status: 403
    }
  }

  if (userRole !== 'Admin') {
    console.log('❌ Admin validation failed: Not admin role:', userRole)
    return {
      success: false,
      error: 'Admin access required',
      status: 403
    }
  }

  console.log('✅ Admin validation success:', {
    userId: user.id,
    email: user.email,
    role: userRole
  })

  return {
    success: true,
    user,
    role: userRole
  }
}

// Validate any authenticated user
export const validateAuthenticatedUser = async () => {
  console.log('🔒 Validating authenticated user...')
  
  const { user, error } = await getAuthenticatedUser()
  
  if (error || !user) {
    console.log('❌ User validation failed:', error)
    return {
      success: false,
      error: 'Authentication required',
      status: 401
    }
  }

  const userRole = await getUserRole(user.id)
  
  console.log('✅ User validation success:', {
    userId: user.id,
    email: user.email,
    role: userRole
  })
  
  return {
    success: true,
    user,
    role: userRole
  }
}

// Check if user is admin (without throwing errors)
export const isUserAdmin = async (): Promise<boolean> => {
  try {
    const { user, error } = await getAuthenticatedUser()
    
    if (error || !user) {
      return false
    }

    const userRole = await getUserRole(user.id)
    return userRole === 'Admin'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// Get current user profile (returns null if not authenticated)
export const getCurrentUserProfile = async () => {
  try {
    const { user, error } = await getAuthenticatedUser()
    
    if (error || !user) {
      return null
    }

    const supabase = await createServerSupabaseClient()
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return null
    }

    return profile
  } catch (error) {
    console.error('Error in getCurrentUserProfile:', error)
    return null
  }
}

// API Response helpers
export const createErrorResponse = (message: string, status: number) => {
  console.log(`📤 Sending error response: ${status} - ${message}`)
  return Response.json({ error: message }, { status })
}

export const createSuccessResponse = (data: any, status: number = 200) => {
  console.log(`📤 Sending success response: ${status}`)
  return Response.json(data, { status })
}

// Utility function to get user from request headers (alternative approach)
export const getUserFromRequest = async (request: NextRequest) => {
  try {
    // This could be used if you want to pass auth via headers instead of cookies
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}

// Utility to check permissions for specific resources
export const canUserAccessResource = async (resourceType: string, resourceId: string | number) => {
  try {
    const { user, error } = await getAuthenticatedUser()
    
    if (error || !user) {
      return false
    }

    const userRole = await getUserRole(user.id)
    
    // Admins can access everything
    if (userRole === 'Admin') {
      return true
    }

    // Add resource-specific logic here
    switch (resourceType) {
      case 'product':
        // All authenticated users can view products
        return true
      case 'category':
        // All authenticated users can view categories
        return true
      case 'audit_log':
        // Only admins can view audit logs
        return userRole === 'Admin'
      case 'user_profile':
        // Users can only access their own profile
        return user.id === resourceId
      default:
        return false
    }
  } catch (error) {
    console.error('Error checking resource access:', error)
    return false
  }
}

// Rate limiting helper (basic implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export const checkRateLimit = (userId: string, maxRequests: number = 100, windowMs: number = 60000): boolean => {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (userLimit.count >= maxRequests) {
    return false
  }

  userLimit.count++
  return true
}

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now()
  for (const [userId, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(userId)
    }
  }
}, 60000) // Clean up every minute