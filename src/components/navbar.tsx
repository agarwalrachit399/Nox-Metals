// components/navbar.tsx - Updated with audit logs link
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogOut, User, Loader2, Shield, Eye, History, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const { user, signOut, loading: authLoading, role, isAdmin } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const pathname = usePathname()

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
      setIsSigningOut(false)
    }
  }

  const getUserInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }

  const getRoleIcon = () => {
    return isAdmin ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />
  }

  const getRoleBadgeVariant = () => {
    return isAdmin ? 'default' : 'secondary'
  }

  // Show loading state while auth is being determined
  if (authLoading) {
    return (
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Product Manager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          </div>
        </div>
      </nav>
    )
  }

  // Don't render navbar if no user
  if (!user) {
    return null
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand & Navigation */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-xl font-bold hover:text-primary transition-colors">
              Product Manager
            </Link>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-4">
              <Link 
                href="/" 
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Home className="h-4 w-4" />
                Products
              </Link>
              
              {/* Admin-only Audit Logs link */}
              {isAdmin && (
                <Link 
                  href="/audit-logs" 
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/audit-logs' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <History className="h-4 w-4" />
                  Audit Logs
                </Link>
              )}
            </div>

            {/* Role Badge */}
            {role && (
              <Badge variant={getRoleBadgeVariant()} className="flex items-center gap-1">
                {getRoleIcon()}
                {role}
              </Badge>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-10 w-10 rounded-full"
                  disabled={isSigningOut}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" alt={user?.email || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.email ? getUserInitials(user.email) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-2">
                    <p className="text-sm font-medium leading-none">
                      {user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                    {/* Role display in dropdown */}
                    {role && (
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant={getRoleBadgeVariant()} className="flex items-center gap-1 text-xs">
                          {getRoleIcon()}
                          {role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {isAdmin ? 'Full Access' : 'View Only'}
                        </span>
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Navigation items for mobile */}
                <div className="md:hidden">
                  <DropdownMenuItem asChild>
                    <Link href="/" className="cursor-pointer">
                      <Home className="mr-2 h-4 w-4" />
                      <span>Products</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/audit-logs" className="cursor-pointer">
                        <History className="mr-2 h-4 w-4" />
                        <span>Audit Logs</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </div>
                
                <DropdownMenuItem className="cursor-pointer" disabled>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-4 w-4" />
                  )}
                  <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}