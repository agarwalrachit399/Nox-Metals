// components/auth-provider.tsx - Enhanced with failure handling
'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/auth'
import { UserRole, UserProfile } from '@/lib/database.types'
import { authCache } from '@/lib/auth-cache'
import { AuthErrorHandler, AuthErrorType, AuthError } from '@/lib/auth-errors'

interface AuthContextType {
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  isAdmin: boolean
  isUser: boolean
  authError: AuthError | null
  clearAuthError: () => void
  refreshSession: () => Promise<boolean>
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
  authError: null,
  clearAuthError: () => {},
  refreshSession: async () => false
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [initRetryCount, setInitRetryCount] = useState(0)
  const [authError, setAuthError] = useState<AuthError | null>(null)
  
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  // Track refresh attempts to prevent infinite loops
  const refreshAttempts = useRef(0)
  const maxRefreshAttempts = 3
  const refreshCooldown = useRef(0)
  
  // Constants
  const MAX_INIT_RETRIES = 3
  const RETRY_DELAY = 1000 // 1 second
  const REFRESH_COOLDOWN = 10000 // 10 seconds between refresh attempts

  // Auth pages and protected pages
  const authPages = ['/login', '/signup']
  const isAuthPage = authPages.includes(pathname)
  const isProtectedPage = pathname === '/' || pathname.startsWith('/dashboard') || pathname === '/audit-logs'

  console.log('🔄 AuthProvider render:', { 
    user: !!user, 
    role, 
    loading, 
    initialized, 
    initRetryCount,
    isSigningOut,
    authError: authError?.type,
    pathname 
  })

  // Clear auth error
  const clearAuthError = () => {
    setAuthError(null)
  }

  // Manual session refresh with error handling
  const refreshSession = async (): Promise<boolean> => {
    try {
      const now = Date.now()
      
      // Check cooldown
      if (now < refreshCooldown.current) {
        console.log('⏰ Refresh on cooldown, skipping')
        return false
      }
      
      // Check max attempts
      if (refreshAttempts.current >= maxRefreshAttempts) {
        console.log('🚫 Max refresh attempts reached')
        AuthErrorHandler.createError(
          AuthErrorType.REFRESH_FAILED,
          'Maximum refresh attempts exceeded'
        )
        return false
      }
      
      console.log('🔄 Manually refreshing session...')
      refreshAttempts.current++
      refreshCooldown.current = now + REFRESH_COOLDOWN
      
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error || !data.session) {
        console.error('❌ Manual refresh failed:', error?.message)
        AuthErrorHandler.createError(
          AuthErrorType.REFRESH_FAILED,
          error?.message || 'Session refresh failed'
        )
        
        // If refresh fails, force logout
        await forceCleanLogout('Session refresh failed')
        return false
      }
      
      console.log('✅ Manual refresh successful')
      refreshAttempts.current = 0 // Reset on success
      return true
      
    } catch (error) {
      console.error('💥 Error in manual refresh:', error)
      AuthErrorHandler.createError(
        AuthErrorType.NETWORK_ERROR,
        'Network error during refresh'
      )
      return false
    }
  }

  // Force clean logout on auth failures
  const forceCleanLogout = async (reason: string) => {
    console.log('🚨 Forcing clean logout:', reason)
    
    // Clear all auth state
    setSession(null)
    setUser(null)
    setUserProfile(null)
    setRole(null)
    setLoading(false)
    setIsSigningOut(false)
    
    // Clear cache
    authCache.clear()
    
    // Reset refresh tracking
    refreshAttempts.current = 0
    refreshCooldown.current = 0
    
    // Don't call supabase.auth.signOut() to avoid potential loops
    // Just clean up local state and redirect
  }

  // Listen for auth errors
  useEffect(() => {
    const unsubscribe = AuthErrorHandler.onError((error) => {
      setAuthError(error)
      
      // Auto-logout on critical errors
      if (error.type === AuthErrorType.REFRESH_FAILED || 
          error.type === AuthErrorType.INVALID_SESSION) {
        setTimeout(() => {
          forceCleanLogout(`Auth error: ${error.type}`)
        }, 2000) // Give user time to see the error
      }
    })
    
    return unsubscribe
  }, [])

  // Fetch user profile and role
  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('📊 Fetching user profile for:', userId)
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Error fetching user profile:', error)
        return null
      }

      console.log('✅ User profile fetched:', profile)
      return profile
    } catch (error) {
      console.error('❌ Error in fetchUserProfile:', error)
      return null
    }
  }

  // Robust initialization with retry logic
  const initializeAuth = async (retryCount = 0) => {
    try {
      console.log(`🚀 Initializing auth (attempt ${retryCount + 1}/${MAX_INIT_RETRIES + 1})...`)
      
      // Wait a moment for cookies to be available on retry
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount))
      }
      
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('❌ Error getting session:', error)
        throw error // Trigger retry logic
      }
      
      console.log('📱 Initial session:', !!session?.user)
      setSession(session)
      setUser(session?.user ?? null)

      // Fetch user profile if authenticated
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        setUserProfile(profile)
        setRole(profile?.role ?? null)
      } else {
        setUserProfile(null)
        setRole(null)
      }
      
      // Success - reset retry count and mark as initialized
      setInitRetryCount(0)
      setInitialized(true)
      setLoading(false)
      console.log('✅ Auth initialization successful')
      
    } catch (error) {
      console.error(`❌ Auth initialization failed (attempt ${retryCount + 1}):`, error)
      
      if (retryCount < MAX_INIT_RETRIES) {
        // Retry after delay
        console.log(`🔄 Retrying auth initialization in ${RETRY_DELAY * (retryCount + 1)}ms...`)
        setInitRetryCount(retryCount + 1)
        setTimeout(() => {
          initializeAuth(retryCount + 1)
        }, RETRY_DELAY * (retryCount + 1))
      } else {
        // Max retries reached - give up gracefully
        console.error('💥 Auth initialization failed after max retries')
        AuthErrorHandler.createError(
          AuthErrorType.NETWORK_ERROR,
          'Failed to initialize authentication'
        )
        setInitialized(true) // Stop retrying
        setLoading(false) // Allow app to continue (logged out state)
        setInitRetryCount(0)
      }
    }
  }

  // Initialize auth state once with retry logic
  useEffect(() => {
    if (initialized) return

    initializeAuth()
  }, [initialized])

  // Listen for auth changes with enhanced failure handling
  useEffect(() => {
    if (!initialized) return // Wait for initialization
    
    console.log('👂 Setting up auth listener...')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth state changed:', event, !!session?.user)
        
        // Clear auth cache on significant auth events
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
          console.log('🗑️ Clearing auth cache due to:', event)
          authCache.clear()
        }
        
        // Handle different auth events
        switch (event) {
          case 'SIGNED_OUT':
            console.log('👋 Sign out event detected')
            setSession(null)
            setUser(null)
            setUserProfile(null)
            setRole(null)
            setIsSigningOut(false)
            setLoading(false)
            // Reset refresh tracking
            refreshAttempts.current = 0
            refreshCooldown.current = 0
            clearAuthError() // Clear any auth errors
            break
            
          case 'SIGNED_IN':
            console.log('🔑 Sign in event detected')
            setSession(session)
            setUser(session?.user ?? null)
            
            if (session?.user) {
              const profile = await fetchUserProfile(session.user.id)
              setUserProfile(profile)
              setRole(profile?.role ?? null)
            }
            setLoading(false)
            // Reset refresh tracking on successful sign in
            refreshAttempts.current = 0
            refreshCooldown.current = 0
            clearAuthError() // Clear any auth errors
            break
            
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token refresh event detected')
            
            // CRITICAL: Check if refresh actually succeeded
            if (!session || !session.user) {
              console.error('❌ Token refresh failed - no session returned')
              AuthErrorHandler.createError(
                AuthErrorType.REFRESH_FAILED,
                'Token refresh returned empty session'
              )
              await forceCleanLogout('Token refresh failed')
              break
            }
            
            setSession(session)
            setUser(session.user)
            // Reset refresh tracking on successful refresh
            refreshAttempts.current = 0
            refreshCooldown.current = 0
            console.log('✅ Token refreshed successfully')
            break
            
          case 'USER_UPDATED':
            console.log('👤 User update event detected')
            setSession(session)
            setUser(session?.user ?? null)
            
            if (session?.user) {
              const profile = await fetchUserProfile(session.user.id)
              setUserProfile(profile)
              setRole(profile?.role ?? null)
            }
            break
            
          default:
            console.log('❓ Unknown auth event:', event)
            setSession(session)
            setUser(session?.user ?? null)
            
            if (session?.user) {
              const profile = await fetchUserProfile(session.user.id)
              setUserProfile(profile)
              setRole(profile?.role ?? null)
            } else {
              setUserProfile(null)
              setRole(null)
            }
            setLoading(false)
        }
      }
    )

    return () => {
      console.log('🧹 Cleaning up auth listener')
      subscription?.unsubscribe()
    }
  }, [initialized])

  // Handle navigation (separate effect, only when auth state is stable)
  useEffect(() => {
    // Skip navigation during loading, initialization, or sign out process
    if (loading || !initialized || isSigningOut) return

    const currentAuthState = {
      hasUser: !!user,
      pathname
    }

    console.log('🧭 Navigation check:', currentAuthState)

    // Handle redirects
    if (!user && isProtectedPage) {
      console.log('➡️ Redirecting to login')
      router.push('/login')
    } else if (user && isAuthPage) {
      console.log('➡️ Redirecting to home')
      router.push('/')
    }
  }, [user, pathname, isAuthPage, isProtectedPage, loading, initialized, isSigningOut, router])

  const signOut = async () => {
    try {
      console.log('👋 Starting sign out process...')
      setIsSigningOut(true)
      setLoading(true)
      
      // Clear auth cache before signing out
      authCache.clear()
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Error signing out:', error)
        // Even if signOut fails, force clean logout
        await forceCleanLogout('Sign out error')
      } else {
        console.log('✅ Sign out successful')
        // Don't reset states here - let the auth listener handle it
      }
    } catch (error) {
      console.error('❌ Error in signOut:', error)
      // Force clean logout on error
      await forceCleanLogout('Sign out exception')
    }
  }

  // Computed role helpers
  const isAdmin = role === 'Admin'
  const isUser = role === 'User'

  const value = {
    user,
    session,
    userProfile,
    role,
    loading,
    signOut,
    isAdmin,
    isUser,
    authError,
    clearAuthError,
    refreshSession
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}