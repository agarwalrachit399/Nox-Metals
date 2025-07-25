// components/auth-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {}
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
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Auth pages and protected pages
  const authPages = ['/login', '/signup']
  const isAuthPage = authPages.includes(pathname)
  const isProtectedPage = pathname === '/' || pathname.startsWith('/dashboard')

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
      // Auth state change listener will handle the redirect
    } catch (error) {
      console.error('Error in signOut:', error)
      setLoading(false)
    }
  }

  const value = {
    user,
    session,
    loading,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}