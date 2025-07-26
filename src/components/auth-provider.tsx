// components/auth-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/auth'
import { UserRole, UserProfile } from '@/lib/database.types'

interface AuthContextType {
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  isAdmin: boolean
  isUser: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userProfile: null,
  role: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  isUser: false
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
  
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  // Use ref to prevent navigation loops
  const lastAuthState = useRef<{ hasUser: boolean; pathname: string }>({ 
    hasUser: false, 
    pathname: '' 
  })

  // Auth pages and protected pages
  const authPages = ['/login', '/signup']
  const isAuthPage = authPages.includes(pathname)
  const isProtectedPage = pathname === '/' || pathname.startsWith('/dashboard')

  // Add debug logging
  console.log('🔄 AuthProvider render:', { 
    user: !!user, 
    role, 
    loading, 
    initialized, 
    pathname 
  })

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

  // Initialize auth state once
  useEffect(() => {
    if (initialized) return

    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing auth...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ Error getting session:', error)
        } else {
          console.log('📱 Initial session:', !!session?.user)
          setSession(session)
          setUser(session?.user ?? null)

          // Fetch user profile if authenticated
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id)
            setUserProfile(profile)
            setRole(profile?.role ?? null)
          }
        }
      } catch (error) {
        console.error('❌ Error in initializeAuth:', error)
      } finally {
        setLoading(false)
        setInitialized(true)
        console.log('✅ Auth initialization complete')
      }
    }

    initializeAuth()
  }, [initialized, supabase])

  // Listen for auth changes (separate from initialization)
  useEffect(() => {
    console.log('👂 Setting up auth listener...')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth state changed:', event, !!session?.user)
        
        setSession(session)
        setUser(session?.user ?? null)

        // Handle user profile and role
        if (session?.user) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const profile = await fetchUserProfile(session.user.id)
            setUserProfile(profile)
            setRole(profile?.role ?? null)
          }
        } else {
          setUserProfile(null)
          setRole(null)
        }

        // Only set loading to false after handling the auth change
        if (event !== 'TOKEN_REFRESHED') {
          setLoading(false)
        }
      }
    )

    return () => {
      console.log('🧹 Cleaning up auth listener')
      subscription?.unsubscribe()
    }
  }, [supabase])

  // Handle navigation (separate effect, only when auth state is stable)
  useEffect(() => {
    // Skip navigation during loading or if not initialized
    if (loading || !initialized) return

    const currentAuthState = {
      hasUser: !!user,
      pathname
    }

    // Prevent navigation loops
    if (
      currentAuthState.hasUser === lastAuthState.current.hasUser &&
      currentAuthState.pathname === lastAuthState.current.pathname
    ) {
      return
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

    lastAuthState.current = currentAuthState
  }, [user, pathname, isAuthPage, isProtectedPage, loading, initialized, router])

  const signOut = async () => {
    try {
      console.log('👋 Signing out...')
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Error signing out:', error)
        setLoading(false)
      }
    } catch (error) {
      console.error('❌ Error in signOut:', error)
      setLoading(false)
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
    isUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}