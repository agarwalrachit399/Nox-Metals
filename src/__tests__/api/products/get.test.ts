import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/products/route'

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

// Mock Supabase client - range is the final method that returns a Promise
const createMockSupabaseClient = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn(),
})

describe('GET /api/products', () => {
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a fresh mock client for each test
    mockSupabaseClient = createMockSupabaseClient()
    
    // Default successful auth validation
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

    it('should return 403 when user access is denied', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockResolvedValue({
        success: false,
        error: 'Access denied',
        status: 403,
        originalError: null
      })
      
      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Access denied', 403)
    })
  })

  describe('Successful Product Fetching', () => {
    it('should return products with default parameters', async () => {
      // Arrange
      const mockProducts = [
        {
          id: 1,
          name: 'Product 1',
          price: 10.99,
          description: 'Description 1',
          category: 'Electronics',
          image: 'image1.jpg',
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Product 2',
          price: 20.99,
          description: 'Description 2',
          category: 'Clothing',
          image: 'image2.jpg',
          is_deleted: false,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockSupabaseClient.range.mockResolvedValue({
        data: mockProducts,
        error: null,
        count: 2
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_deleted', false)
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 9) // page 1, limit 10

      expect(responseData).toEqual({
        products: mockProducts,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1
        }
      })
    })

    it('should handle includeDeleted parameter', async () => {
      // Arrange
      const mockProducts = [
        { id: 1, name: 'Product 1', is_deleted: true },
        { id: 2, name: 'Product 2', is_deleted: false }
      ]

      mockSupabaseClient.range.mockResolvedValue({
        data: mockProducts,
        error: null,
        count: 2
      })

      const request = createMockRequest('?includeDeleted=true')

      // Act
      const response = await GET(request)

      // Assert
      // Should NOT call eq with is_deleted filter when includeDeleted=true
      expect(mockSupabaseClient.eq).not.toHaveBeenCalledWith('is_deleted', false)
    })

    it('should handle search parameter', async () => {
      // Arrange
      const searchTerm = 'laptop'
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest(`?search=${searchTerm}`)

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.or).toHaveBeenCalledWith(
        `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
      )
    })

    it('should handle category filter', async () => {
      // Arrange
      const category = 'Electronics'
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest(`?category=${category}`)

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('category', category)
    })

    it('should handle pagination parameters', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 50
      })

      const request = createMockRequest('?page=3&limit=5')

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(10, 14) // (page-1)*limit, startIndex+limit-1
      expect(responseData.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 50,
        totalPages: 10
      })
    })

    it('should handle different sorting options', async () => {
      // Arrange
      const testCases = [
        { sortBy: 'name-asc', expectedCall: ['name', { ascending: true }] },
        { sortBy: 'name-desc', expectedCall: ['name', { ascending: false }] },
        { sortBy: 'price-asc', expectedCall: ['price', { ascending: true }] },
        { sortBy: 'price-desc', expectedCall: ['price', { ascending: false }] },
        { sortBy: 'created_at-desc', expectedCall: ['created_at', { ascending: false }] }
      ]

      for (const testCase of testCases) {
        // Reset mock and create fresh client
        mockSupabaseClient = createMockSupabaseClient()
        vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabaseClient as any)
        
        mockSupabaseClient.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0
        })

        const request = createMockRequest(`?sortBy=${testCase.sortBy}`)

        // Act
        await GET(request)

        // Assert
        expect(mockSupabaseClient.order).toHaveBeenCalledWith(...testCase.expectedCall)
      }
    })

    it('should handle complex query with multiple parameters', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?search=laptop&category=Electronics&sortBy=price-asc&page=2&limit=5&includeDeleted=false')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_deleted', false)
      expect(mockSupabaseClient.or).toHaveBeenCalledWith('name.ilike.%laptop%,description.ilike.%laptop%')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('category', 'Electronics')
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('price', { ascending: true })
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(5, 9)
    })
  })

  describe('Error Handling', () => {
    it('should handle Supabase errors', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch products', 500)
    })

    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch products', 500)
    })

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch products', 500)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty query parameters gracefully', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?search=&category=&sortBy=')

      // Act
      const response = await GET(request)

      // Assert
      // Should not apply empty filters
      expect(mockSupabaseClient.or).not.toHaveBeenCalled()
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_deleted', false) // Only default filter
    })

    it('should handle invalid pagination parameters', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?page=invalid&limit=abc')

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      // Should default to page 1, limit 10
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 9)
      expect(responseData.pagination.page).toBe(1)
      expect(responseData.pagination.limit).toBe(10)
    })

    it('should handle category="all" as no filter', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?category=all')

      // Act
      const response = await GET(request)

      // Assert
      // Should only have is_deleted filter, not category filter
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_deleted', false)
      expect(mockSupabaseClient.eq).not.toHaveBeenCalledWith('category', 'all')
    })

    it('should return empty array when no products found', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(responseData.products).toEqual([])
      expect(responseData.pagination.total).toBe(0)
      expect(responseData.pagination.totalPages).toBe(0)
    })
  })
})

// Helper function to create mock NextRequest
function createMockRequest(searchParams = ''): NextRequest {
  const url = `http://localhost:3000/api/products${searchParams}`
  return {
    nextUrl: {
      searchParams: new URLSearchParams(searchParams.replace('?', ''))
    },
    headers: new Map([['cookie', 'test-cookie=value']])
  } as any
}