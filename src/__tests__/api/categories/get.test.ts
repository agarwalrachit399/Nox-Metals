import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/categories/route'

// Mock auth utilities
vi.mock('@/lib/auth-utils', () => ({
  validateAuthenticatedUser: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createErrorResponse: vi.fn((message, status) => 
    new Response(JSON.stringify({ error: message }), { status })
  ),
}))

// Import mocked functions
import { validateAuthenticatedUser, createServerSupabaseClient, createErrorResponse } from '@/lib/auth-utils'

// Mock Supabase client
const createMockSupabaseClient = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn(),
})

describe('GET /api/categories', () => {
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a fresh mock client for each test
    mockSupabaseClient = createMockSupabaseClient()
    
    // Default successful auth validation (any authenticated user)
    vi.mocked(validateAuthenticatedUser).mockResolvedValue({
      success: true,
      user: { id: 'user-123', email: 'test@example.com' },
      role: 'User'
    })
    
    // Default Supabase client mock
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabaseClient as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockResolvedValue({
        success: false,
        error: 'Authentication required',
        status: 401,
        originalError: null
      })
      
      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(validateAuthenticatedUser).toHaveBeenCalledWith(request)
      expect(createErrorResponse).toHaveBeenCalledWith('Authentication required', 401)
    })

    it('should return 503 when authentication service is unavailable', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockResolvedValue({
        success: false,
        error: 'Service unavailable',
        status: 503,
        originalError: 'network error'
      })
      
      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Service unavailable', 503)
    })

    it('should allow regular users to access categories', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockResolvedValue({
        success: true,
        user: { id: 'user-123', email: 'user@example.com' },
        role: 'User'
      })
      
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(validateAuthenticatedUser).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
    })

    it('should allow admin users to access categories', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockResolvedValue({
        success: true,
        user: { id: 'admin-123', email: 'admin@example.com' },
        role: 'Admin'
      })
      
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('Successful Category Fetching', () => {
    it('should return categories ordered by name ascending', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: 'Accessories',
          description: 'Various accessories',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Electronics',
          description: 'Electronic devices',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 3,
          name: 'Home',
          description: 'Home items',
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('categories')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('name', { ascending: true })

      expect(response.status).toBe(200)
      expect(responseData).toEqual(mockCategories)
    })

    it('should return empty array when no categories exist', async () => {
      // Arrange
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toEqual([])
    })

    it('should handle categories with null descriptions', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: 'Category 1',
          description: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Category 2',
          description: 'Has description',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toEqual(mockCategories)
    })

    it('should handle large number of categories', async () => {
      // Arrange
      const mockCategories = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Category ${String(i + 1).padStart(3, '0')}`,
        description: `Description for category ${i + 1}`,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }))

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toHaveLength(100)
      expect(responseData[0].name).toBe('Category 001')
      expect(responseData[99].name).toBe('Category 100')
    })

    it('should handle categories with special characters in names', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: 'Électronics & Gadgets',
          description: 'Electronics with spéciàl chars',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Home & Garden 🏠',
          description: 'Category with emoji',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 3,
          name: 'Books/Media',
          description: 'Books & Media items',
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toEqual(mockCategories)
    })
  })

  describe('Error Handling', () => {
    it('should handle Supabase database errors', async () => {
      // Arrange
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' }
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch categories', 500)
    })

    it('should handle Supabase timeout errors', async () => {
      // Arrange
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: { message: 'Query timeout', code: 'QUERY_TIMEOUT' }
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch categories', 500)
    })

    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch categories', 500)
    })

    it('should handle validateAuthenticatedUser failure', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockRejectedValue(new Error('Auth validation failed'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch categories', 500)
    })

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.order.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch categories', 500)
    })

    it('should handle network interruption during query', async () => {
      // Arrange
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: { message: 'Network error', code: 'NETWORK_ERROR' }
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch categories', 500)
    })
  })

  describe('Edge Cases', () => {
    it('should handle categories with very long names', async () => {
      // Arrange
      const longName = 'A'.repeat(255)
      const mockCategories = [
        {
          id: 1,
          name: longName,
          description: 'Category with very long name',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData[0].name).toBe(longName)
      expect(responseData[0].name).toHaveLength(255)
    })

    it('should handle categories with very long descriptions', async () => {
      // Arrange
      const longDescription = 'B'.repeat(1000)
      const mockCategories = [
        {
          id: 1,
          name: 'Category',
          description: longDescription,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData[0].description).toBe(longDescription)
      expect(responseData[0].description).toHaveLength(1000)
    })

    it('should handle categories with empty string names', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: '',
          description: 'Category with empty name',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData[0].name).toBe('')
    })

    it('should handle categories with whitespace-only names', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: '   ',
          description: 'Category with whitespace name',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData[0].name).toBe('   ')
    })

    it('should handle categories with duplicate names', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: 'Electronics',
          description: 'First electronics category',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Electronics',
          description: 'Second electronics category',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toHaveLength(2)
      expect(responseData[0].name).toBe('Electronics')
      expect(responseData[1].name).toBe('Electronics')
    })

    it('should handle mixed case category names and verify sorting', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: 'accessories',
          description: 'lowercase',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Electronics',
          description: 'Title case',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 3,
          name: 'HOME',
          description: 'UPPERCASE',
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toEqual(mockCategories)
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('name', { ascending: true })
    })
  })

  describe('Response Format', () => {
    it('should return categories as JSON array', async () => {
      // Arrange
      const mockCategories = [
        {
          id: 1,
          name: 'Electronics',
          description: 'Electronic devices',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockSupabaseClient.order.mockResolvedValue({
        data: mockCategories,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(responseData)).toBe(true)
      expect(responseData).toHaveLength(1)
      expect(responseData[0]).toHaveProperty('id')
      expect(responseData[0]).toHaveProperty('name')
      expect(responseData[0]).toHaveProperty('description')
      expect(responseData[0]).toHaveProperty('created_at')
      expect(responseData[0]).toHaveProperty('updated_at')
    })

    it('should preserve all category fields in response', async () => {
      // Arrange
      const mockCategory = {
        id: 42,
        name: 'Test Category',
        description: 'Test Description',
        created_at: '2024-01-01T12:34:56Z',
        updated_at: '2024-01-02T12:34:56Z'
      }

      mockSupabaseClient.order.mockResolvedValue({
        data: [mockCategory],
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(responseData[0]).toEqual(mockCategory)
      expect(responseData[0].id).toBe(42)
      expect(responseData[0].name).toBe('Test Category')
      expect(responseData[0].description).toBe('Test Description')
      expect(responseData[0].created_at).toBe('2024-01-01T12:34:56Z')
      expect(responseData[0].updated_at).toBe('2024-01-02T12:34:56Z')
    })

    it('should handle null response from Supabase gracefully', async () => {
      // Arrange
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toEqual([])
    })
  })

  describe('Database Query Construction', () => {
    it('should call database with correct query structure', async () => {
      // Arrange
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      })

      const request = createMockRequest()

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('categories')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('name', { ascending: true })
      
      // Verify the chain order
      expect(mockSupabaseClient.from).toHaveBeenCalledBefore(mockSupabaseClient.select as any)
      expect(mockSupabaseClient.select).toHaveBeenCalledBefore(mockSupabaseClient.order as any)
    })

    it('should use authenticated Supabase client', async () => {
      // Arrange
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      })

      const request = createMockRequest()

      // Act
      await GET(request)

      // Assert
      expect(createServerSupabaseClient).toHaveBeenCalledTimes(1)
      expect(createServerSupabaseClient).toHaveBeenCalledWith()
    })
  })
})

// Helper function to create mock NextRequest
function createMockRequest(searchParams = ''): NextRequest {
  const url = `http://localhost:3000/api/categories${searchParams}`
  return {
    nextUrl: {
      searchParams: new URLSearchParams(searchParams.replace('?', ''))
    },
    headers: new Map([['cookie', 'test-cookie=value']])
  } as any
}