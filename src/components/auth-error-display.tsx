// src/components/auth-error-display.tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, LogOut, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { AuthError, AuthErrorType } from '@/lib/auth-errors'

export default function AuthErrorDisplay() {
  const { authError, clearAuthError, refreshSession, signOut } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  if (!authError) return null
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const success = await refreshSession()
      if (success) {
        clearAuthError()
      }
    } catch (error) {
      console.error('Manual refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }
  
  const handleSignOut = async () => {
    clearAuthError()
    await signOut()
  }
  
  const getErrorVariant = (type: AuthErrorType) => {
    switch (type) {
      case AuthErrorType.NETWORK_ERROR:
        return 'default'
      default:
        return 'destructive'
    }
  }
  
  const getActionButtons = (error: AuthError) => {
    switch (error.type) {
      case AuthErrorType.NETWORK_ERROR:
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isRefreshing ? 'Retrying...' : 'Retry'}
          </Button>
        )
        
      case AuthErrorType.TOKEN_EXPIRED:
      case AuthErrorType.REFRESH_FAILED:
        return (
          <div className="flex gap-2">
            {error.retryable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        )
        
      default:
        return (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        )
    }
  }
  
  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Alert variant={getErrorVariant(authError.type)} className="pr-12">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <div>{authError.userMessage}</div>
          <div className="flex items-center justify-between">
            {getActionButtons(authError)}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAuthError}
              className="absolute top-2 right-2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}