// src/lib/api-client.ts
import { useAuth } from '@/components/auth-provider'
import { AuthErrorHandler, AuthErrorType } from './auth-errors'
import { useEffect } from 'react'

interface ApiOptions extends RequestInit {
  retryOnAuth?: boolean
  maxRetries?: number
}

class ApiClient {
  private baseUrl: string
  private defaultOptions: RequestInit
  
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
    this.defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }
  
  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const {
      retryOnAuth = true,
      maxRetries = 1,
      ...fetchOptions
    } = options
    
    const url = `${this.baseUrl}${endpoint}`
    const config = {
      ...this.defaultOptions,
      ...fetchOptions,
      headers: {
        ...this.defaultOptions.headers,
        ...fetchOptions.headers
      }
    }
    
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🌐 API Request (attempt ${attempt + 1}/${maxRetries + 1}):`, {
          url,
          method: config.method || 'GET'
        })
        
        const response = await fetch(url, config)
        
        // Handle different response statuses
        if (response.ok) {
          const data = await response.json()
          console.log('✅ API Request successful')
          return data
        }
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
          console.log('🔐 API Request failed: 401 Unauthorized')
          
          const errorData = await response.json().catch(() => ({}))
          const isRetryable = response.headers.get('X-Auth-Retry') === 'true'
          
          AuthErrorHandler.createError(
            AuthErrorType.UNAUTHORIZED,
            `API call failed: ${errorData.error || 'Unauthorized'}`,
            isRetryable
          )
          
          // If retryable and we have retries left, attempt refresh
          if (retryOnAuth && isRetryable && attempt < maxRetries) {
            console.log('🔄 Attempting to refresh auth and retry...')
            
            try {
              // Try to refresh session through auth provider
              // This will trigger the AuthProvider's refresh logic
              const refreshEvent = new CustomEvent('auth:refresh-needed')
              window.dispatchEvent(refreshEvent)
              
              // Wait a moment for refresh to complete
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              // Retry the request
              continue
            } catch (refreshError) {
              console.error('❌ Auth refresh failed:', refreshError)
            }
          }
          
          throw new Error(`Unauthorized: ${errorData.error || 'Authentication required'}`)
        }
        
        // Handle other error statuses
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        
        if (response.status >= 500) {
          AuthErrorHandler.createError(
            AuthErrorType.NETWORK_ERROR,
            `Server error: ${errorMessage}`,
            true // Server errors are retryable
          )
        }
        
        throw new Error(errorMessage)
        
      } catch (error) {
        console.error(`❌ API Request failed (attempt ${attempt + 1}):`, error)
        lastError = error as Error
        
        // If it's not a retryable error or we're on the last attempt, throw
        if (!retryOnAuth || attempt === maxRetries) {
          break
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        console.log(`⏳ Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // All retries exhausted
    throw lastError || new Error('API request failed')
  }
  
  // Convenience methods
  async get<T>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }
  
  async post<T>(endpoint: string, data?: any, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  async put<T>(endpoint: string, data?: any, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  async delete<T>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Hook for automatic refresh handling
export const useApiErrorRecovery = () => {
  useEffect(() => {
    const handleRefreshNeeded = async () => {
      // This would trigger AuthProvider's refreshSession
      const { refreshSession } = useAuth()
      await refreshSession()
    }
    
    window.addEventListener('auth:refresh-needed', handleRefreshNeeded)
    
    return () => {
      window.removeEventListener('auth:refresh-needed', handleRefreshNeeded)
    }
  }, [])
}