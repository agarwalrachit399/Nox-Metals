import { vi } from 'vitest'

// Mock implementations for auth utilities
export const mockValidateAuthenticatedUser = vi.fn()
export const mockValidateAdminAccess = vi.fn()
export const mockCreateServerSupabaseClient = vi.fn()
export const mockCreateErrorResponse = vi.fn()
export const mockCreateSuccessResponse = vi.fn()

// Default success responses
export const createSuccessfulAuthResponse = () => ({
  success: true,
  user: { 
    id: 'user-123', 
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated'
  },
  role: 'User' as const
})

export const createSuccessfulAdminResponse = () => ({
  success: true,
  user: { 
    id: 'admin-123', 
    email: 'admin@example.com',
    aud: 'authenticated',
    role: 'authenticated'
  },
  role: 'Admin' as const
})

export const createFailedAuthResponse = (error = 'Authentication required', status = 401, originalError: string | null = null) => ({
  success: false,
  error,
  status,
  originalError
})

// Mock Supabase client builder
export const createMockSupabaseClient = () => {
  const mockClient = {
    from: vi.fn(() => mockClient),
    select: vi.fn(() => mockClient),
    insert: vi.fn(() => mockClient),
    update: vi.fn(() => mockClient),
    delete: vi.fn(() => mockClient),
    eq: vi.fn(() => mockClient),
    or: vi.fn(() => mockClient),
    order: vi.fn(() => mockClient),
    range: vi.fn(),
    single: vi.fn(),
    // Add common chain endings that return promises
    then: vi.fn(),
  }
  
  return mockClient
}

// Helper to create Supabase response
export const createSupabaseResponse = (data: any = null, error: any = null, count: number | null = null) => ({
  data,
  error,
  count
})

// Reset all mocks
export const resetAuthMocks = () => {
  mockValidateAuthenticatedUser.mockReset()
  mockValidateAdminAccess.mockReset()
  mockCreateServerSupabaseClient.mockReset()
  mockCreateErrorResponse.mockReset()
  mockCreateSuccessResponse.mockReset()
}