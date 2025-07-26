// src/lib/auth-errors.ts
export enum AuthErrorType {
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  REFRESH_FAILED = 'REFRESH_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_SESSION = 'INVALID_SESSION',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export interface AuthError {
  type: AuthErrorType
  message: string
  timestamp: number
  retryable: boolean
  userMessage: string
}

export class AuthErrorHandler {
  private static errors: AuthError[] = []
  private static listeners: ((error: AuthError) => void)[] = []
  
  static createError(
    type: AuthErrorType, 
    message: string, 
    retryable: boolean = false
  ): AuthError {
    const error: AuthError = {
      type,
      message,
      timestamp: Date.now(),
      retryable,
      userMessage: this.getUserMessage(type)
    }
    
    this.errors.push(error)
    this.notifyListeners(error)
    
    console.error('🚨 Auth Error:', error)
    return error
  }
  
  static onError(listener: (error: AuthError) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
  
  private static notifyListeners(error: AuthError) {
    this.listeners.forEach(listener => {
      try {
        listener(error)
      } catch (e) {
        console.error('Error in auth error listener:', e)
      }
    })
  }
  
  private static getUserMessage(type: AuthErrorType): string {
    switch (type) {
      case AuthErrorType.TOKEN_EXPIRED:
        return 'Your session has expired. Please sign in again.'
      case AuthErrorType.REFRESH_FAILED:
        return 'Unable to refresh your session. Please sign in again.'
      case AuthErrorType.NETWORK_ERROR:
        return 'Connection issue. Please check your internet and try again.'
      case AuthErrorType.INVALID_SESSION:
        return 'Your session is invalid. Please sign in again.'
      case AuthErrorType.UNAUTHORIZED:
        return 'Access denied. Please sign in with proper permissions.'
      default:
        return 'Authentication error occurred. Please try again.'
    }
  }
  
  static getRecentErrors(maxAge: number = 300000): AuthError[] {
    const cutoff = Date.now() - maxAge // 5 minutes default
    return this.errors.filter(error => error.timestamp > cutoff)
  }
  
  static clearErrors() {
    this.errors = []
  }
}