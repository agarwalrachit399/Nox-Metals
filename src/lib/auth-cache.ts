// src/lib/auth-cache.ts
interface CachedAuthState {
  user: any | null
  timestamp: number
  expiresAt: number
}

class AuthCache {
  private cache = new Map<string, CachedAuthState>()
  private readonly CACHE_TTL = 30 * 1000 // 30 seconds
  
  private generateKey(cookies: string): string {
    // Create cache key from session cookies
    const sessionCookies = cookies
      .split(';')
      .filter(cookie => cookie.trim().startsWith('sb-'))
      .join(';')
    
    return Buffer.from(sessionCookies).toString('base64').slice(0, 32)
  }
  
  get(cookies: string): CachedAuthState | null {
    const key = this.generateKey(cookies)
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    console.log('🎯 Auth cache hit for key:', key.slice(0, 8))
    return cached
  }
  
  set(cookies: string, user: any | null): void {
    const key = this.generateKey(cookies)
    const now = Date.now()
    
    this.cache.set(key, {
      user,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL
    })
    
    console.log('💾 Auth cached for key:', key.slice(0, 8))
    this.cleanup()
  }
  
  clear(cookies?: string): void {
    if (cookies) {
      const key = this.generateKey(cookies)
      this.cache.delete(key)
      console.log('🗑️ Auth cache cleared for key:', key.slice(0, 8))
    } else {
      this.cache.clear()
      console.log('🗑️ Auth cache cleared entirely')
    }
  }
  
  private cleanup(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const authCache = new AuthCache()