// lib/auth-utils.ts - FIXED VERSION
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

    return userProfile?.role ?? null
  } catch (error) {
    console.error('💥 Error in getUserRole:', error)
    return null
  }
}

// Validate any authenticated user - FIXED
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

// Validate admin access - FIXED
export const validateAdminAccess = async () => {
  const result = await validateAuthenticatedUser()
  
  if (!result.success) {
    return result
  }

  if (result.role !== 'Admin') {
    return {
      success: false,
      error: 'Admin access required',
      status: 403
    }
  }

  return result
}

// API Response helpers
export const createErrorResponse = (message: string, status: number) => {
  return Response.json({ error: message }, { status })
}

export const createSuccessResponse = (data: any, status: number = 200) => {
  return Response.json(data, { status })
}