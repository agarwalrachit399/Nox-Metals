import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/products/[id]/route'

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
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

describe('GET /api/products/[id]', () => {
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
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(validateAuthenticatedUser).toHaveBeenCalledWith()
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
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Service unavailable', 503)
    })

    it('should allow regular users to access products', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockResolvedValue({
        success: true,
        user: { id: 'user-123', email: 'user@example.com' },
        role: 'User'
      })
      
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Test Product',
          price: 10.99,
          description: 'Test description',
          category: 'Electronics',
          image: null,
          is_deleted: false
        },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(validateAuthenticatedUser).toHaveBeenCalledWith()
      expect(response.status).toBe(200)
    })

    it('should allow admin users to access products', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockResolvedValue({
        success: true,
        user: { id: 'admin-123', email: 'admin@example.com' },
        role: 'Admin'
      })
      
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Test Product',
          price: 10.99,
          description: 'Test description',
          category: 'Electronics',
          image: null,
          is_deleted: false
        },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('Product ID Validation', () => {
    it('should return 400 for non-numeric product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('abc')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for empty product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for floating point product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('1.5')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for negative product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('-1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for zero product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('0')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should accept valid positive integer product ID', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 123,
          name: 'Test Product',
          price: 10.99,
          description: 'Test description',
          category: 'Electronics',
          image: null,
          is_deleted: false
        },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('123')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 123)
      expect(response.status).toBe(200)
    })

    it('should handle very large product ID numbers', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 2147483647,
          name: 'Test Product',
          price: 10.99,
          description: 'Test description',
          category: 'Electronics',
          image: null,
          is_deleted: false
        },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('2147483647')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 2147483647)
      expect(response.status).toBe(200)
    })
  })

  describe('Successful Product Retrieval', () => {
    it('should return product successfully with all fields', async () => {
      // Arrange
      const expectedProduct = {
        id: 1,
        name: 'Test Product',
        price: 25.99,
        description: 'A comprehensive test product',
        category: 'Electronics',
        image: 'https://example.com/image.jpg',
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 1)
      expect(mockSupabaseClient.single).toHaveBeenCalled()
      
      expect(response.status).toBe(200)
      expect(responseData).toEqual(expectedProduct)
    })

    it('should return product with null image', async () => {
      // Arrange
      const expectedProduct = {
        id: 2,
        name: 'Product without Image',
        price: 15.00,
        description: 'Product with no image',
        category: 'Home',
        image: null,
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('2')

      // Act
      const response = await GET(request, { params })
      const responseData = await response.json()

      // Assert
      expect(responseData).toEqual(expectedProduct)
      expect(responseData.image).toBeNull()
    })

    it('should return deleted product (soft deleted)', async () => {
      // Arrange
      const expectedProduct = {
        id: 3,
        name: 'Deleted Product',
        price: 20.00,
        description: 'This product is soft deleted',
        category: 'Accessories',
        image: null,
        is_deleted: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('3')

      // Act
      const response = await GET(request, { params })
      const responseData = await response.json()

      // Assert
      expect(responseData).toEqual(expectedProduct)
      expect(responseData.is_deleted).toBe(true)
    })

    it('should handle products with special characters in fields', async () => {
      // Arrange
      const expectedProduct = {
        id: 4,
        name: 'Product with "Quotes" & Symbols!',
        price: 12.50,
        description: 'Description with émojis 🎉 and spéciàl characters',
        category: 'Books & Media',
        image: 'https://example.com/spëcial-ïmage.jpg',
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('4')

      // Act
      const response = await GET(request, { params })
      const responseData = await response.json()

      // Assert
      expect(responseData).toEqual(expectedProduct)
    })

    it('should handle products with very long text fields', async () => {
      // Arrange
      const longName = 'A'.repeat(255)
      const longDescription = 'B'.repeat(1000)
      const expectedProduct = {
        id: 5,
        name: longName,
        price: 99.99,
        description: longDescription,
        category: 'Test Category',
        image: null,
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('5')

      // Act
      const response = await GET(request, { params })
      const responseData = await response.json()

      // Assert
      expect(responseData.name).toBe(longName)
      expect(responseData.description).toBe(longDescription)
    })
  })

  describe('Product Not Found', () => {
    it('should return 404 when product does not exist', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      })

      const request = createMockRequest()
      const params = createMockParams('999')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 999)
      expect(createErrorResponse).toHaveBeenCalledWith('Product not found', 404)
    })

    it('should return 404 for non-existent product with valid ID format', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' }
      })

      const request = createMockRequest()
      const params = createMockParams('12345')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Product not found', 404)
    })
  })

  describe('Database Error Handling', () => {
    it('should handle general Supabase database errors', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: 'CONNECTION_ERROR',
          message: 'Database connection failed'
        }
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle query timeout errors', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: 'QUERY_TIMEOUT',
          message: 'Query execution timeout'
        }
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle permission errors from database', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Insufficient permissions'
        }
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle unknown database errors', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Something went wrong'
        }
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })
  })

  describe('General Error Handling', () => {
    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle validateAuthenticatedUser failure', async () => {
      // Arrange
      vi.mocked(validateAuthenticatedUser).mockRejectedValue(new Error('Auth validation failed'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle params parsing failure', async () => {
      // Arrange
      const request = createMockRequest()
      const params = Promise.reject(new Error('Params parsing failed'))

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.single.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle network interruption during query', async () => {
      // Arrange
      mockSupabaseClient.single.mockRejectedValue(new Error('Network interrupted'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null product data gracefully', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })

      // Assert
      // When data is null but no error, it should treat as not found
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should handle product ID with leading zeros', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 123,
          name: 'Test Product',
          price: 10.99,
          description: 'Test description',
          category: 'Electronics',
          image: null,
          is_deleted: false
        },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('000123')

      // Act
      const response = await GET(request, { params })

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 123)
      expect(response.status).toBe(200)
    })

    it('should handle product ID with whitespace', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams(' 123 ')

      // Act
      const response = await GET(request, { params })

      // Assert
      // parseInt will handle whitespace and convert to 123
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 123)
    })

    it('should handle mixed alphanumeric ID (partial numeric)', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('123abc')

      // Act
      const response = await GET(request, { params })

      // Assert
      // parseInt will convert '123abc' to 123
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 123)
    })

    it('should handle scientific notation in ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('1e2')

      // Act
      const response = await GET(request, { params })

      // Assert
      // parseInt('1e2') returns 1, not 100
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 1)
    })
  })

  describe('Response Format', () => {
    it('should return product as JSON with correct content type', async () => {
      // Arrange
      const expectedProduct = {
        id: 1,
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics',
        image: null,
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await GET(request, { params })
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toEqual(expectedProduct)
      expect(typeof responseData).toBe('object')
      expect(responseData).toHaveProperty('id')
      expect(responseData).toHaveProperty('name')
      expect(responseData).toHaveProperty('price')
      expect(responseData).toHaveProperty('description')
      expect(responseData).toHaveProperty('category')
      expect(responseData).toHaveProperty('image')
      expect(responseData).toHaveProperty('is_deleted')
    })

    it('should preserve data types in response', async () => {
      // Arrange
      const expectedProduct = {
        id: 42,
        name: 'Type Test Product',
        price: 123.45,
        description: 'Testing data types',
        category: 'Test',
        image: 'https://example.com/image.jpg',
        is_deleted: false,
        created_at: '2024-01-01T12:34:56Z',
        updated_at: '2024-01-02T12:34:56Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('42')

      // Act
      const response = await GET(request, { params })
      const responseData = await response.json()

      // Assert
      expect(typeof responseData.id).toBe('number')
      expect(typeof responseData.name).toBe('string')
      expect(typeof responseData.price).toBe('number')
      expect(typeof responseData.description).toBe('string')
      expect(typeof responseData.category).toBe('string')
      expect(typeof responseData.image).toBe('string')
      expect(typeof responseData.is_deleted).toBe('boolean')
      expect(typeof responseData.created_at).toBe('string')
      expect(typeof responseData.updated_at).toBe('string')
    })
  })

  describe('Database Query Construction', () => {
    it('should call database with correct query structure', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 1, name: 'Test' },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      await GET(request, { params })

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 1)
      expect(mockSupabaseClient.single).toHaveBeenCalled()
      
      // Verify the chain order
      expect(mockSupabaseClient.from).toHaveBeenCalledBefore(mockSupabaseClient.select as any)
      expect(mockSupabaseClient.select).toHaveBeenCalledBefore(mockSupabaseClient.eq as any)
      expect(mockSupabaseClient.eq).toHaveBeenCalledBefore(mockSupabaseClient.single as any)
    })

    it('should use authenticated Supabase client', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 1, name: 'Test' },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      await GET(request, { params })

      // Assert
      expect(createServerSupabaseClient).toHaveBeenCalledTimes(1)
      expect(createServerSupabaseClient).toHaveBeenCalledWith()
    })
  })
})

// Helper function to create mock NextRequest
function createMockRequest(): NextRequest {
  return {
    headers: new Map([['cookie', 'test-cookie=value']])
  } as any
}

// Helper function to create mock params
function createMockParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id })
}