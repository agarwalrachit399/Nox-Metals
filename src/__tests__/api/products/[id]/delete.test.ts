import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/products/[id]/route'

// Mock auth utilities
vi.mock('@/lib/auth-utils', () => ({
  validateAdminAccess: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createErrorResponse: vi.fn((message, status) => 
    new Response(JSON.stringify({ error: message }), { status })
  ),
}))

// Import mocked functions
import { validateAdminAccess, createServerSupabaseClient, createErrorResponse } from '@/lib/auth-utils'

// Mock Supabase client
const createMockSupabaseClient = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

describe('DELETE /api/products/[id]', () => {
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a fresh mock client for each test
    mockSupabaseClient = createMockSupabaseClient()
    
    // Default successful admin validation
    vi.mocked(validateAdminAccess).mockResolvedValue({
      success: true,
      user: { id: 'admin-123', email: 'admin@example.com' },
      role: 'Admin'
    })
    
    // Default Supabase client mock
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabaseClient as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // Helper functions
  function mockExistingProductResponse() {
    return {
      data: {
        id: 1,
        name: 'Existing Product',
        price: 10.99,
        description: 'Existing description',
        category: 'Electronics',
        image: null,
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      error: null
    }
  }

  function mockExistingProduct() {
    // Mock the product existence check
    mockSupabaseClient.single.mockResolvedValueOnce(mockExistingProductResponse())
  }

  function mockSoftDeleteSuccess() {
    // Mock successful soft delete
    const updatedProduct = {
      ...mockExistingProductResponse().data,
      is_deleted: true,
      updated_at: '2024-01-01T12:00:00Z'
    }
    
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: updatedProduct,
      error: null
    })
  }

  function mockHardDeleteSuccess() {
    // Mock successful hard delete
    mockSupabaseClient.delete.mockResolvedValue({
      error: null
    })
  }

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockResolvedValue({
        success: false,
        error: 'Authentication required',
        status: 401,
        originalError: null
      })
      
      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(validateAdminAccess).toHaveBeenCalledWith()
      expect(createErrorResponse).toHaveBeenCalledWith('Authentication required', 401)
    })

    it('should return 403 when user is not admin', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockResolvedValue({
        success: false,
        error: 'Admin access required',
        status: 403,
        originalError: null
      })
      
      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Admin access required', 403)
    })

    it('should return 503 when authentication service is unavailable', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockResolvedValue({
        success: false,
        error: 'Service unavailable',
        status: 503,
        originalError: 'network error'
      })
      
      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Service unavailable', 503)
    })

    it('should proceed when user is admin', async () => {
      // Arrange
      mockExistingProduct()
      mockSoftDeleteSuccess()

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(validateAdminAccess).toHaveBeenCalledWith()
      expect(response.status).toBe(200)
    })
  })

  describe('Product ID Validation', () => {
    beforeEach(() => {
      mockExistingProduct()
      mockSoftDeleteSuccess()
    })

    it('should return 400 for non-numeric product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('abc')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for empty product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for negative product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('-1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for zero product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('0')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should accept valid positive integer product ID', async () => {
      // Arrange
      const request = createMockRequest()
      const params = createMockParams('123')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('Product Existence Check', () => {
    it('should return 404 when product does not exist', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      })

      const request = createMockRequest()
      const params = createMockParams('999')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Product not found', 404)
    })

    it('should return 500 when product fetch fails with other error', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'CONNECTION_ERROR', message: 'Database error' }
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should proceed when product exists', async () => {
      // Arrange
      mockExistingProduct()
      mockSoftDeleteSuccess()

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('Soft Delete (Default)', () => {
    beforeEach(() => {
      mockExistingProduct()
    })

    it('should perform soft delete by default', async () => {
      // Arrange
      const updatedProduct = {
        ...mockExistingProductResponse().data,
        is_deleted: true,
        updated_at: '2024-01-01T12:00:00Z'
      }
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        is_deleted: true,
        updated_at: expect.any(String)
      })
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 1)
      expect(mockSupabaseClient.delete).not.toHaveBeenCalled()
      
      expect(response.status).toBe(200)
      expect(responseData.message).toBe('Product deleted successfully')
      expect(responseData.product).toEqual(updatedProduct)
    })

    it('should perform soft delete when hard=false', async () => {
      // Arrange
      mockSoftDeleteSuccess()

      const request = createMockRequest('?hard=false')
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalled()
      expect(mockSupabaseClient.delete).not.toHaveBeenCalled()
    })

    it('should perform soft delete when hard parameter is invalid', async () => {
      // Arrange
      mockSoftDeleteSuccess()

      const request = createMockRequest('?hard=invalid')
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalled()
      expect(mockSupabaseClient.delete).not.toHaveBeenCalled()
    })

    it('should handle soft delete database error', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed', code: 'UPDATE_ERROR' }
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to delete product', 500)
    })

    it('should include updated timestamp in soft delete', async () => {
      // Arrange
      const beforeTime = new Date().toISOString()
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          ...mockExistingProductResponse().data,
          is_deleted: true,
          updated_at: new Date().toISOString()
        },
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      await DELETE(request, { params })

      // Assert
      const updateCall = mockSupabaseClient.update.mock.calls[0][0]
      expect(updateCall.is_deleted).toBe(true)
      expect(updateCall.updated_at).toBeDefined()
      expect(new Date(updateCall.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime())
    })
  })


  describe('General Error Handling', () => {
    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to delete product', 500)
    })

    it('should handle validateAdminAccess failure', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockRejectedValue(new Error('Auth validation failed'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to delete product', 500)
    })

    it('should handle params parsing failure', async () => {
      // Arrange
      const request = createMockRequest()
      const params = Promise.reject(new Error('Params parsing failed'))

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to delete product', 500)
    })

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.single.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to delete product', 500)
    })

    it('should handle network interruption during deletion', async () => {
      // Arrange
      mockExistingProduct()
      mockSupabaseClient.single.mockRejectedValue(new Error('Network interrupted'))

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to delete product', 500)
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockExistingProduct()
    })

    it('should handle product ID with leading zeros', async () => {
      // Arrange
      mockSoftDeleteSuccess()

      const request = createMockRequest()
      const params = createMockParams('000123')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 123)
      expect(response.status).toBe(200)
    })

    it('should handle very large product ID numbers', async () => {
      // Arrange
      mockSoftDeleteSuccess()

      const request = createMockRequest()
      const params = createMockParams('2147483647')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 2147483647)
      expect(response.status).toBe(200)
    })

    it('should handle mixed query parameters', async () => {
      // Arrange
      mockSoftDeleteSuccess()

      const request = createMockRequest('?hard=false&otherParam=value')
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalled()
      expect(mockSupabaseClient.delete).not.toHaveBeenCalled()
    })

    it('should handle empty query string gracefully', async () => {
      // Arrange
      mockSoftDeleteSuccess()

      const request = createMockRequest('?')
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalled()
    })

    it('should handle case sensitivity in hard parameter', async () => {
      // Arrange
      mockSoftDeleteSuccess()

      const request = createMockRequest('?hard=TRUE')
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      // Only exact 'true' should trigger hard delete
      expect(mockSupabaseClient.update).toHaveBeenCalled()
      expect(mockSupabaseClient.delete).not.toHaveBeenCalled()
    })
  })

  describe('Response Format', () => {
    beforeEach(() => {
      mockExistingProduct()
    })

    it('should return correct response format for soft delete', async () => {
      // Arrange
      const updatedProduct = {
        ...mockExistingProductResponse().data,
        is_deleted: true,
        updated_at: '2024-01-01T12:00:00Z'
      }
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedProduct,
        error: null
      })

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      const response = await DELETE(request, { params })
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toHaveProperty('message')
      expect(responseData).toHaveProperty('product')
      expect(responseData.message).toBe('Product deleted successfully')
      expect(responseData.product).toEqual(updatedProduct)
    })

    it('should preserve all product fields in response', async () => {
      // Arrange
      const productWithAllFields = {
        id: 42,
        name: 'Complete Product',
        price: 123.45,
        description: 'Full description',
        category: 'Test Category',
        image: 'https://example.com/image.jpg',
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: productWithAllFields,
        error: null
      })
      
      mockHardDeleteSuccess()

      const request = createMockRequest('?hard=true')
      const params = createMockParams('42')

      // Act
      const response = await DELETE(request, { params })
      const responseData = await response.json()

      // Assert
      expect(responseData.product).toEqual(productWithAllFields)
    })
  })

  describe('Database Query Construction', () => {
    it('should call database with correct query structure for soft delete', async () => {
      // Arrange
      mockExistingProduct()
      mockSoftDeleteSuccess()

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      await DELETE(request, { params })

      // Assert
      // Verify existence check
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 1)
      expect(mockSupabaseClient.single).toHaveBeenCalled()
      
      // Verify update call
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        is_deleted: true,
        updated_at: expect.any(String)
      })
    })

    it('should use authenticated Supabase client', async () => {
      // Arrange
      mockExistingProduct()
      mockSoftDeleteSuccess()

      const request = createMockRequest()
      const params = createMockParams('1')

      // Act
      await DELETE(request, { params })

      // Assert
      expect(createServerSupabaseClient).toHaveBeenCalledTimes(1)
      expect(createServerSupabaseClient).toHaveBeenCalledWith()
    })
  })
})

// Helper functions that don't need mockSupabaseClient
function createMockRequest(searchParams = ''): NextRequest {
  const url = `http://localhost:3000/api/products/1${searchParams}`
  return {
    nextUrl: {
      searchParams: new URLSearchParams(searchParams.replace('?', ''))
    },
    headers: new Map([['cookie', 'test-cookie=value']])
  } as any
}

function createMockParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id })
}