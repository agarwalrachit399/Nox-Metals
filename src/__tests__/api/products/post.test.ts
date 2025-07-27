import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/products/route'

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
  insert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

describe('POST /api/products', () => {
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
      
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(validateAdminAccess).toHaveBeenCalledWith(request)
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
      
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Admin access required', 403)
    })

    it('should proceed with product creation when user is admin', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'Electronics' },
        error: null
      })
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 1,
          name: 'Test Product',
          price: 10.99,
          description: 'Test description',
          category: 'Electronics',
          image: null,
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(validateAdminAccess).toHaveBeenCalledWith(request)
      expect(response.status).toBe(201)
    })
  })

  describe('Input Validation', () => {
    beforeEach(() => {
      // Mock successful category validation for validation tests
      mockSupabaseClient.single.mockResolvedValue({
        data: { name: 'Electronics' },
        error: null
      })
    })

    it('should return 400 when name is missing', async () => {
      // Arrange
      const request = createMockRequest({
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when name is empty string', async () => {
      // Arrange
      const request = createMockRequest({
        name: '',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when name is only whitespace', async () => {
      // Arrange
      const request = createMockRequest({
        name: '   ',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when price is missing', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when price is zero', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 0,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Price must be a positive number', 400)
    })

    it('should return 400 when price is negative', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: -5.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Price must be a positive number', 400)
    })

    it('should return 400 when price is not a number', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 'invalid',
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Price must be a positive number', 400)
    })

    it('should return 400 when description is missing', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when description is empty string', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: '',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when description is only whitespace', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: '   ',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when category is missing', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when category is empty string', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: ''
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when category is only whitespace', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: '   '
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })

    it('should return 400 when multiple fields are missing', async () => {
      // Arrange
      const request = createMockRequest({})

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Missing required fields: name, price, description, category', 
        400
      )
    })
  })

  describe('Category Validation', () => {
    it('should return 400 when category does not exist', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      })

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'NonexistentCategory'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('categories')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('name')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('name', 'NonexistentCategory')
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Invalid category. Please select a valid category.', 
        400
      )
    })

    it('should proceed when category exists', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'Electronics' },
        error: null
      })
      
      mockSupabaseClient.single.mockResolvedValueOnce({
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

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('name', 'Electronics')
      expect(response.status).toBe(201)
    })

    it('should handle database error during category validation', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' }
      })

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Invalid category. Please select a valid category.', 
        400
      )
    })
  })

  describe('Successful Product Creation', () => {
    beforeEach(() => {
      // Mock successful category validation
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'Electronics' },
        error: null
      })
    })

    it('should create product successfully with all required fields', async () => {
      // Arrange
      const expectedProduct = {
        id: 1,
        name: 'Test Product',
        price: 10.99,
        description: 'Test description for the product',
        category: 'Electronics',
        image: null,
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description for the product',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description for the product',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
      expect(mockSupabaseClient.select).toHaveBeenCalled()
      expect(mockSupabaseClient.single).toHaveBeenCalled()
      
      expect(response.status).toBe(201)
      expect(responseData).toEqual(expectedProduct)
    })

    it('should create product successfully with image URL', async () => {
      // Arrange
      const expectedProduct = {
        id: 2,
        name: 'Product with Image',
        price: 25.50,
        description: 'Product with image description',
        category: 'Electronics',
        image: 'https://example.com/image.jpg',
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest({
        name: 'Product with Image',
        price: 25.50,
        description: 'Product with image description',
        category: 'Electronics',
        image: 'https://example.com/image.jpg'
      })

      // Act
      const response = await POST(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Product with Image',
        price: 25.50,
        description: 'Product with image description',
        category: 'Electronics',
        image: 'https://example.com/image.jpg',
        is_deleted: false
      })
      
      expect(response.status).toBe(201)
      expect(responseData).toEqual(expectedProduct)
    })

    it('should handle empty image URL by setting to null', async () => {
      // Arrange
      const expectedProduct = {
        id: 3,
        name: 'Product without Image',
        price: 15.00,
        description: 'Product without image description',
        category: 'Electronics',
        image: null,
        is_deleted: false
      }

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: expectedProduct,
        error: null
      })

      const request = createMockRequest({
        name: 'Product without Image',
        price: 15.00,
        description: 'Product without image description',
        category: 'Electronics',
        image: ''
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Product without Image',
        price: 15.00,
        description: 'Product without image description',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })

    it('should trim whitespace from text fields', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 4, name: 'Trimmed Product' },
        error: null
      })

      const request = createMockRequest({
        name: '  Trimmed Product  ',
        price: 20.00,
        description: '  Description with spaces  ',
        category: '  Electronics  ',
        image: '  https://example.com/image.jpg  '
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Trimmed Product',
        price: 20.00,
        description: 'Description with spaces',
        category: 'Electronics',
        image: 'https://example.com/image.jpg',
        is_deleted: false
      })
    })

    it('should handle decimal prices correctly', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 5, price: 99.99 },
        error: null
      })

      const request = createMockRequest({
        name: 'Decimal Price Product',
        price: 99.99,
        description: 'Product with decimal price',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Decimal Price Product',
        price: 99.99,
        description: 'Product with decimal price',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      // Mock successful category validation for error tests
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'Electronics' },
        error: null
      })
    })

    it('should handle Supabase insert error', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed', code: 'INSERT_ERROR' }
      })

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create product', 500)
    })

    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create product', 500)
    })

    it('should handle validateAdminAccess failure', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockRejectedValue(new Error('Auth validation failed'))

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create product', 500)
    })

    it('should handle JSON parsing error', async () => {
      // Arrange
      const request = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create product', 500)
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Mock successful category validation
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'Electronics' },
        error: null
      })
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 1, name: 'Test Product' },
        error: null
      })
    })

    it('should handle very large price values', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Expensive Product',
        price: 999999.99,
        description: 'Very expensive product',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Expensive Product',
        price: 999999.99,
        description: 'Very expensive product',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })

    it('should handle very small price values', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Cheap Product',
        price: 0.01,
        description: 'Very cheap product',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Cheap Product',
        price: 0.01,
        description: 'Very cheap product',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })

    it('should handle long text fields', async () => {
      // Arrange
      const longName = 'A'.repeat(255)
      const longDescription = 'B'.repeat(1000)
      
      const request = createMockRequest({
        name: longName,
        price: 10.99,
        description: longDescription,
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: longName,
        price: 10.99,
        description: longDescription,
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })

    it('should handle special characters in text fields', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Product with "quotes" & symbols!',
        price: 15.99,
        description: 'Description with émojis 🎉 and spéciàl characters',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Product with "quotes" & symbols!',
        price: 15.99,
        description: 'Description with émojis 🎉 and spéciàl characters',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })

    it('should handle price as string that can be converted to number', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'String Price Product',
        price: '25.99',
        description: 'Product with string price',
        category: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'String Price Product',
        price: 25.99,
        description: 'Product with string price',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })

    it('should handle case-sensitive category names', async () => {
      // Arrange - Reset mocks for this specific test
      vi.clearAllMocks()
      vi.mocked(validateAdminAccess).mockResolvedValue({
        success: true,
        user: { id: 'admin-123', email: 'admin@example.com' },
        role: 'Admin'
      })
      vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabaseClient as any)
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'electronics' }, // lowercase in db
        error: null
      })
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 1, category: 'electronics' },
        error: null
      })

      const request = createMockRequest({
        name: 'Case Test Product',
        price: 10.99,
        description: 'Testing case sensitivity',
        category: 'electronics' // lowercase
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('name', 'electronics')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Case Test Product',
        price: 10.99,
        description: 'Testing case sensitivity',
        category: 'electronics',
        image: null,
        is_deleted: false
      })
    })
  })

  describe('Request Body Edge Cases', () => {
    it('should handle null values in optional fields', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'Electronics' },
        error: null
      })
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 1, name: 'Test Product' },
        error: null
      })

      const request = createMockRequest({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics',
        image: null
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })

    it('should handle undefined image field', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: 'Electronics' },
        error: null
      })
      
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 1, name: 'Test Product' },
        error: null
      })

      const requestBody = {
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics'
        // image field intentionally omitted
      }

      const request = createMockRequest(requestBody)

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Product',
        price: 10.99,
        description: 'Test description',
        category: 'Electronics',
        image: null,
        is_deleted: false
      })
    })
  })
})

// Helper function to create mock NextRequest with JSON body
function createMockRequest(body: any): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Map([['content-type', 'application/json']])
  } as any
}