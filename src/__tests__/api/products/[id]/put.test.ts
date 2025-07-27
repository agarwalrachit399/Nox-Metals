import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PUT } from '@/app/api/products/[id]/route'

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
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

describe('PUT /api/products/[id]', () => {
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

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockResolvedValue({
        success: false,
        error: 'Authentication required',
        status: 401,
        originalError: null
      })
      
      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

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
      
      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

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
      
      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Service unavailable', 503)
    })

    it('should proceed when user is admin', async () => {
      // Arrange
      mockExistingProduct()
      mockSuccessfulUpdate()

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(validateAdminAccess).toHaveBeenCalledWith()
      expect(response.status).toBe(200)
    })
  })

  describe('Product ID Validation', () => {
    beforeEach(() => {
      mockExistingProduct()
      mockSuccessfulUpdate()
    })

    it('should return 400 for non-numeric product ID', async () => {
      // Arrange
      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('abc')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for empty product ID', async () => {
      // Arrange
      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should return 400 for negative product ID', async () => {
      // Arrange
      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('-1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Invalid product ID', 400)
    })

    it('should accept valid positive integer product ID', async () => {
      // Arrange
      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('123')

      // Act
      const response = await PUT(request, { params })

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

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('999')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Product not found', 404)
    })

    it('should return 500 when product fetch fails with other error', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'CONNECTION_ERROR', message: 'Database error' }
      })

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch product', 500)
    })

    it('should proceed when product exists', async () => {
      // Arrange
      mockExistingProduct()
      mockSuccessfulUpdate()

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('Field Validation', () => {
    beforeEach(() => {
      mockExistingProduct()
    })

    describe('Name Validation', () => {
      it('should return 400 when name is empty string', async () => {
        // Arrange
        const request = createMockRequest({ name: '' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Name cannot be empty', 400)
      })

      it('should return 400 when name is only whitespace', async () => {
        // Arrange
        const request = createMockRequest({ name: '   ' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Name cannot be empty', 400)
      })

      it('should accept valid name', async () => {
        // Arrange
        mockSuccessfulUpdate()
        const request = createMockRequest({ name: 'Valid Product Name' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(response.status).toBe(200)
      })
    })

    describe('Price Validation', () => {
      it('should return 400 when price is zero', async () => {
        // Arrange
        const request = createMockRequest({ price: 0 })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Price must be a positive number', 400)
      })

      it('should return 400 when price is negative', async () => {
        // Arrange
        const request = createMockRequest({ price: -10.99 })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Price must be a positive number', 400)
      })

      it('should return 400 when price is not a number', async () => {
        // Arrange
        const request = createMockRequest({ price: 'invalid' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Price must be a positive number', 400)
      })

      it('should accept valid positive price', async () => {
        // Arrange
        mockSuccessfulUpdate()
        const request = createMockRequest({ price: 29.99 })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(response.status).toBe(200)
      })

      it('should accept price as string that converts to positive number', async () => {
        // Arrange
        mockSuccessfulUpdate()
        const request = createMockRequest({ price: '15.50' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(response.status).toBe(200)
      })
    })

    describe('Description Validation', () => {
      it('should return 400 when description is empty string', async () => {
        // Arrange
        const request = createMockRequest({ description: '' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Description cannot be empty', 400)
      })

      it('should return 400 when description is only whitespace', async () => {
        // Arrange
        const request = createMockRequest({ description: '   ' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Description cannot be empty', 400)
      })

      it('should accept valid description', async () => {
        // Arrange
        mockSuccessfulUpdate()
        const request = createMockRequest({ description: 'Valid description' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(response.status).toBe(200)
      })
    })

    describe('Category Validation', () => {
      it('should return 400 when category is empty string', async () => {
        // Arrange
        const request = createMockRequest({ category: '' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Category cannot be empty', 400)
      })

      it('should return 400 when category is only whitespace', async () => {
        // Arrange
        const request = createMockRequest({ category: '   ' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(createErrorResponse).toHaveBeenCalledWith('Category cannot be empty', 400)
      })
        it('should return 400 when category does not exist', async () => {
            // Arrange
            mockSupabaseClient.single.mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116' } // No rows returned
            })
    
            const request = createMockRequest({ category: 'NonExistentCategory' })
            const params = createMockParams('1')
    
            // Act
            const response = await PUT(request, { params })
    
            // Assert
            expect(createErrorResponse).toHaveBeenCalledWith('Invalid category. Please select a valid category.', 400)
        })

      it('should accept valid existing category', async () => {
        // Arrange
        mockSupabaseClient.single.mockResolvedValueOnce(mockExistingProductResponse())
        mockSupabaseClient.single.mockResolvedValueOnce({
          data: { name: 'Electronics' },
          error: null
        })
        mockSuccessfulUpdate()

        const request = createMockRequest({ category: 'Electronics' })
        const params = createMockParams('1')

        // Act
        const response = await PUT(request, { params })

        // Assert
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Successful Updates', () => {
    beforeEach(() => {
      mockExistingProduct()
    })

    it('should update single field (name only)', async () => {
      // Arrange
      const updatedProduct = {
        id: 1,
        name: 'Updated Product Name',
        price: 10.99,
        description: 'Original description',
        category: 'Electronics',
        image: null,
        is_deleted: false
      }

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedProduct,
        error: null
      })

      const request = createMockRequest({ name: 'Updated Product Name' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'Updated Product Name'
      })
      expect(response.status).toBe(200)
      expect(responseData).toEqual(updatedProduct)
    })

    it('should update multiple fields', async () => {
      // Arrange
      const updatedProduct = {
        id: 1,
        name: 'Updated Product',
        price: 25.99,
        description: 'Updated description',
        category: 'Home',
        image: 'https://example.com/new-image.jpg',
        is_deleted: false
      }

      mockValidCategory()
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedProduct,
        error: null
      })

      const request = createMockRequest({
        name: 'Updated Product',
        price: 25.99,
        description: 'Updated description',
        category: 'Home',
        image: 'https://example.com/new-image.jpg'
      })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'Updated Product',
        price: 25.99,
        description: 'Updated description',
        category: 'Home',
        image: 'https://example.com/new-image.jpg'
      })
      expect(response.status).toBe(200)
      expect(responseData).toEqual(updatedProduct)
    })

    it('should update is_deleted field', async () => {
      // Arrange
      const updatedProduct = {
        id: 1,
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics',
        image: null,
        is_deleted: true
      }

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedProduct,
        error: null
      })

      const request = createMockRequest({ is_deleted: true })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        is_deleted: true
      })
      expect(response.status).toBe(200)
    })

    it('should handle image set to null', async () => {
      // Arrange
      mockSuccessfulUpdate()

      const request = createMockRequest({ image: null })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        image: null
      })
    })

    it('should handle empty image string converted to null', async () => {
      // Arrange
      mockSuccessfulUpdate()

      const request = createMockRequest({ image: '' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        image: null
      })
    })

    it('should trim whitespace from text fields', async () => {
      // Arrange
      mockValidCategory()
      mockSuccessfulUpdate()

      const request = createMockRequest({
        name: '  Trimmed Name  ',
        description: '  Trimmed Description  ',
        category: '  Electronics  ',
        image: '  https://example.com/image.jpg  '
      })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'Trimmed Name',
        description: 'Trimmed Description',
        category: 'Electronics',
        image: 'https://example.com/image.jpg'
      })
    })

    it('should return unchanged product when no fields to update', async () => {
      // Arrange
      const existingProduct = mockExistingProductResponse().data

      const request = createMockRequest({})
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.update).not.toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(responseData).toEqual(existingProduct)
    })
  })

  describe('Update Error Handling', () => {
    beforeEach(() => {
      mockExistingProduct()
    })

    it('should handle Supabase update errors', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed', code: 'UPDATE_ERROR' }
      })

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to update product', 500)
    })

    it('should handle database constraint violations', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Constraint violation', code: '23505' }
      })

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to update product', 500)
    })
  })

  describe('General Error Handling', () => {
    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to update product', 500)
    })

    it('should handle validateAdminAccess failure', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockRejectedValue(new Error('Auth validation failed'))

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to update product', 500)
    })

    it('should handle JSON parsing error', async () => {
      // Arrange
      const request = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to update product', 500)
    })

    it('should handle params parsing failure', async () => {
      // Arrange
      const request = createMockRequest({ name: 'Updated Product' })
      const params = Promise.reject(new Error('Params parsing failed'))

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to update product', 500)
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockExistingProduct()
    })

    it('should handle very large price values', async () => {
      // Arrange
      mockSuccessfulUpdate()

      const request = createMockRequest({ price: 999999.99 })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        price: 999999.99
      })
    })

    it('should handle very small price values', async () => {
      // Arrange
      mockSuccessfulUpdate()

      const request = createMockRequest({ price: 0.01 })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        price: 0.01
      })
    })

    it('should handle long text fields', async () => {
      // Arrange
      const longName = 'A'.repeat(255)
      const longDescription = 'B'.repeat(1000)
      mockSuccessfulUpdate()

      const request = createMockRequest({
        name: longName,
        description: longDescription
      })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: longName,
        description: longDescription
      })
    })

    it('should handle special characters in fields', async () => {
      // Arrange
      mockValidCategory()
      mockSuccessfulUpdate()

      const request = createMockRequest({
        name: 'Product with "quotes" & symbols!',
        description: 'Description with émojis 🎉 and spéciàl characters',
        category: 'Electronics & Gadgets'
      })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'Product with "quotes" & symbols!',
        description: 'Description with émojis 🎉 and spéciàl characters',
        category: 'Electronics & Gadgets'
      })
    })

    it('should handle undefined fields in request body', async () => {
      // Arrange
      mockSuccessfulUpdate()

      const request = createMockRequest({
        name: 'Updated Name',
        price: undefined,
        description: undefined,
        category: undefined,
        image: undefined
      })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'Updated Name'
      })
    })

    it('should handle extra fields in request body', async () => {
      // Arrange
      mockSuccessfulUpdate()

      const request = createMockRequest({
        name: 'Updated Name',
        extraField: 'should be ignored',
        anotherField: 123
      })
      const params = createMockParams('1')

      // Act
      const response = await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'Updated Name'
      })
    })
  })

  describe('Database Query Construction', () => {
    it('should call database with correct query structure for product fetch', async () => {
      // Arrange
      mockExistingProduct()
      mockSuccessfulUpdate()

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      await PUT(request, { params })

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 1)
      expect(mockSupabaseClient.single).toHaveBeenCalled()
    })

    it('should call database with correct query structure for update', async () => {
      // Arrange
      mockExistingProduct()
      mockSuccessfulUpdate()

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      await PUT(request, { params })

      // Assert
      // Verify update call structure
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        name: 'Updated Product'
      })
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 1)
      expect(mockSupabaseClient.select).toHaveBeenCalled()
      expect(mockSupabaseClient.single).toHaveBeenCalled()
    })

    it('should use authenticated Supabase client', async () => {
      // Arrange
      mockExistingProduct()
      mockSuccessfulUpdate()

      const request = createMockRequest({ name: 'Updated Product' })
      const params = createMockParams('1')

      // Act
      await PUT(request, { params })

      // Assert
      expect(createServerSupabaseClient).toHaveBeenCalledTimes(1)
      expect(createServerSupabaseClient).toHaveBeenCalledWith()
    })
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
    // Mock the first call (product existence check)
    mockSupabaseClient.single.mockResolvedValueOnce(mockExistingProductResponse())
  }

  function mockValidCategory() {
    // Mock category validation call
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { name: 'Electronics' },
      error: null
    })
  }

  function mockSuccessfulUpdate() {
    // Mock the final update call
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 1,
        name: 'Updated Product',
        price: 10.99,
        description: 'Updated description',
        category: 'Electronics',
        image: null,
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T12:00:00Z'
      },
      error: null
    })
  }
})

// Helper functions that don't need mockSupabaseClient
function createMockRequest(body: any): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Map([['content-type', 'application/json']])
  } as any
}

function createMockParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id })
}