// lib/auth-utils.ts - Enhanced with 401 recovery
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { UserRole } from './database.types'
import { authCache } from './auth-cache'
import { AuthErrorHandler, AuthErrorType } from './auth-errors'

// Create server-side Supabase client for API routes
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

// Enhanced auth function with retry and error handling
export const getAuthenticatedUser = async (request?: NextRequest, retryOnFailure: boolean = true) => {
  try {
    // Get cookies string for cache key
    let cookiesString = ''
    
    if (request) {
      // From middleware/API route
      cookiesString = request.headers.get('cookie') || ''
    } else {
      // From server component
      const cookieStore = await cookies()
      cookiesString = cookieStore.getAll()
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join(';')
    }
    
    // Check cache first
    const cached = authCache.get(cookiesString)
    if (cached) {
      console.log('⚡ Using cached auth state')
      return { user: cached.user, error: cached.user ? null : 'Not authenticated' }
    }
    
    console.log('🔍 Cache miss - fetching auth state')
    
    // Cache miss - perform actual auth check
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    console.log('👤 Fresh auth result:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      hasError: !!error,
      errorMessage: error?.message
    })

    // Handle different types of auth errors
    if (error) {
      console.log('❌ Auth error detected:', error.message)
      
      // Clear cache on auth error
      authCache.clear(cookiesString)
      
      // Categorize the error
      if (error.message.includes('invalid_token') || 
          error.message.includes('token_expired') ||
          error.message.includes('JWT expired')) {
        
        AuthErrorHandler.createError(
          AuthErrorType.TOKEN_EXPIRED,
          `Token expired: ${error.message}`,
          retryOnFailure
        )
        
        // Try to refresh session if retry is enabled
        if (retryOnFailure) {
          console.log('🔄 Attempting token refresh due to expired token...')
          try {
            const { data, error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError || !data.session) {
              console.error('❌ Token refresh failed:', refreshError?.message)
              AuthErrorHandler.createError(
                AuthErrorType.REFRESH_FAILED,
                `Refresh failed: ${refreshError?.message || 'No session returned'}`
              )
              return { user: null, error: 'Token refresh failed' }
            }
            
            console.log('✅ Token refresh successful, caching new session')
            const refreshedUser = data.session.user
            authCache.set(cookiesString, refreshedUser)
            return { user: refreshedUser, error: null }
            
          } catch (refreshError) {
            console.error('💥 Error during token refresh:', refreshError)
            AuthErrorHandler.createError(
              AuthErrorType.NETWORK_ERROR,
              `Network error during refresh: ${refreshError}`
            )
          }
        }
      } else {
        AuthErrorHandler.createError(
          AuthErrorType.INVALID_SESSION,
          `Auth error: ${error.message}`
        )
      }
      
      return { user: null, error: error.message }
    }

    // Cache the successful result
    authCache.set(cookiesString, user)

    if (!user) {
      console.log('❌ No authenticated user')
      return { user: null, error: 'Not authenticated' }
    }

    return { user, error: null }
  } catch (error) {
    console.error('💥 Error in getAuthenticatedUser:', error)
    AuthErrorHandler.createError(
      AuthErrorType.NETWORK_ERROR,
      `Network error: ${error}`
    )
    return { user: null, error: 'Authentication failed' }
  }
}

// Get user role from database
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

    return (userProfile?.role as UserRole) ?? null
  } catch (error) {
    console.error('💥 Error in getUserRole:', error)
    return null
  }
}

// Validate any authenticated user with enhanced error handling
export const validateAuthenticatedUser = async (request?: NextRequest) => {
  console.log('🔒 Validating authenticated user...')
  
  const { user, error } = await getAuthenticatedUser(request)
  
  if (error || !user) {
    console.log('❌ User validation failed:', error)
    
    // Determine appropriate status code based on error type
    let status = 401
    if (error?.includes('refresh failed') || error?.includes('token expired')) {
      status = 401 // Unauthorized - need to re-authenticate
    } else if (error?.includes('network') || error?.includes('failed')) {
      status = 503 // Service unavailable - temporary issue
    }
    
    return {
      success: false,
      error: 'Authentication required',
      status,
      originalError: error
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

// Validate admin access with enhanced error handling
export const validateAdminAccess = async (request?: NextRequest) => {
  console.log('🔒 Validating admin access...')
  
  const { user, error } = await getAuthenticatedUser(request)
  
  if (error || !user) {
    console.log('❌ Admin validation failed: No user')
    
    let status = 401
    if (error?.includes('refresh failed') || error?.includes('token expired')) {
      status = 401
    } else if (error?.includes('network') || error?.includes('failed')) {
      status = 503
    }
    
    return {
      success: false,
      error: 'Authentication required',
      status,
      originalError: error
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

// Enhanced error response with retry information
export const createErrorResponse = (message: string, status: number, retryable: boolean = false) => {
  console.log(`📤 Sending error response: ${status} - ${message}`)
  
  const response = {
    error: message,
    timestamp: new Date().toISOString(),
    retryable
  }
  
  // Add retry headers for 401s
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (status === 401 && retryable) {
    headers['X-Auth-Retry'] = 'true'
    headers['X-Auth-Error'] = 'token_expired'
  }
  
  return new Response(JSON.stringify(response), { status, headers })
}

export const createSuccessResponse = (data: any, status: number = 200) => {
  console.log(`📤 Sending success response: ${status}`)
  return Response.json(data, { status })
}