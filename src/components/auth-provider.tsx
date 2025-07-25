// components/auth-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

// Convenience hook for role checking
export const useRole = () => {
  const { role, isAdmin, isUser } = useAuth()
  return { role, isAdmin, isUser }
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
  const [initialLoad, setInitialLoad] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Auth pages and protected pages
  const authPages = ['/login', '/signup']
  const isAuthPage = authPages.includes(pathname)
  const isProtectedPage = pathname === '/' || pathname.startsWith('/dashboard')

  // Fetch user profile and role
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return profile
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      return null
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
        } else {
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
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
        setInitialLoad(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        const previousUser = user
        const newUser = session?.user ?? null
        
        setSession(session)
        setUser(newUser)

        // Handle user profile and role
        if (newUser) {
          // Only fetch profile if this is a real sign in (not sign out cleanup)
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const profile = await fetchUserProfile(newUser.id)
            setUserProfile(profile)
            setRole(profile?.role ?? null)
          }
        } else {
          // Clear profile and role immediately on sign out
          setUserProfile(null)
          setRole(null)
        }

        setLoading(false)

        // Only handle navigation after initial load and on actual auth state changes
        if (!initialLoad) {
          if (event === 'SIGNED_IN' && newUser && !previousUser) {
            // User just signed in - redirect to home if on auth page
            if (isAuthPage) {
              console.log('User signed in, redirecting to home')
              router.push('/')
            }
          } else if (event === 'SIGNED_OUT' && !newUser && previousUser) {
            // User just signed out - redirect to login if on protected page
            if (isProtectedPage) {
              console.log('User signed out, redirecting to login')
              router.push('/login')
            }
          }
        }
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase, router, pathname, isAuthPage, isProtectedPage, initialLoad, user])

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Error signing out:', error)
        setLoading(false)
      }
      // Auth state change listener will handle the redirect and cleanup
    } catch (error) {
      console.error('Error in signOut:', error)
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