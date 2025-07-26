// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { authCache } from '@/lib/auth-cache'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const isAuthPage = url.pathname === '/login' || url.pathname === '/signup'
  const isProtectedPage = url.pathname === '/' || 
                          url.pathname.startsWith('/dashboard') || 
                          url.pathname === '/audit-logs'
  
  // Skip auth check for non-protected pages
  if (!isAuthPage && !isProtectedPage) {
    console.log('⏭️ Middleware: Skipping auth check for:', url.pathname)
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check cache first
  const cookiesString = request.headers.get('cookie') || ''
  const cached = authCache.get(cookiesString)
  
  let user = null
  
  if (cached) {
    console.log('⚡ Middleware: Using cached auth state')
    user = cached.user
  } else {
    console.log('🔍 Middleware: Cache miss - checking auth')
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            response = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user: authUser }, error } = await supabase.auth.getUser()
    user = error ? null : authUser
    
    // Cache the result
    authCache.set(cookiesString, user)
  }

  // Handle redirects based on auth state
  if (!user) {
    // User is not authenticated
    if (isProtectedPage) {
      console.log('➡️ Middleware: Redirecting unauthenticated user to login')
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  } else {
    // User is authenticated  
    if (isAuthPage) {
      console.log('➡️ Middleware: Redirecting authenticated user to home')
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}