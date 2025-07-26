// app/layout.tsx - Updated with error display
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/components/auth-provider'
import AuthErrorDisplay from '@/components/auth-error-display'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Product Management App',
  description: 'A modern product management application with authentication',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <AuthErrorDisplay />
        </AuthProvider>
      </body>
    </html>
  )
}