import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/categories/route'

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
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

describe('POST /api/categories', () => {
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
        name: 'Test Category'
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
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

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
      
      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Service unavailable', 503)
    })

    it('should proceed with category creation when user is admin', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Test Category',
          description: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(validateAdminAccess).toHaveBeenCalledWith(request)
      expect(response.status).toBe(201)
    })
  })

  describe('Input Validation', () => {
    it('should return 400 when name is missing', async () => {
      // Arrange
      const request = createMockRequest({
        description: 'Test description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Category name is required', 400)
    })

    it('should return 400 when name is null', async () => {
      // Arrange
      const request = createMockRequest({
        name: null,
        description: 'Test description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Category name is required', 400)
    })

    it('should return 400 when name is undefined', async () => {
      // Arrange
      const request = createMockRequest({
        name: undefined,
        description: 'Test description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Category name is required', 400)
    })

    it('should return 400 when name is empty string', async () => {
      // Arrange
      const request = createMockRequest({
        name: '',
        description: 'Test description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Category name is required', 400)
    })

    it('should return 400 when name is only whitespace', async () => {
      // Arrange
      const request = createMockRequest({
        name: '   ',
        description: 'Test description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Category name is required', 400)
    })

    it('should return 400 when name is only tabs and newlines', async () => {
      // Arrange
      const request = createMockRequest({
        name: '\t\n\r ',
        description: 'Test description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Category name is required', 400)
    })

    it('should accept valid name without description', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Valid Category',
          description: null
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Valid Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should accept valid name with description', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Valid Category',
          description: 'Valid description'
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Valid Category',
        description: 'Valid description'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })
  })

  describe('Successful Category Creation', () => {
    it('should create category successfully with name only', async () => {
      // Arrange
      const expectedCategory = {
        id: 1,
        name: 'Electronics',
        description: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedCategory,
        error: null
      })

      const request = createMockRequest({
        name: 'Electronics'
      })

      // Act
      const response = await POST(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('categories')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Electronics',
        description: null
      })
      expect(mockSupabaseClient.select).toHaveBeenCalled()
      expect(mockSupabaseClient.single).toHaveBeenCalled()
      
      expect(response.status).toBe(201)
      expect(responseData).toEqual(expectedCategory)
    })

    it('should create category successfully with name and description', async () => {
      // Arrange
      const expectedCategory = {
        id: 2,
        name: 'Home & Garden',
        description: 'Items for home and garden use',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabaseClient.single.mockResolvedValue({
        data: expectedCategory,
        error: null
      })

      const request = createMockRequest({
        name: 'Home & Garden',
        description: 'Items for home and garden use'
      })

      // Act
      const response = await POST(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Home & Garden',
        description: 'Items for home and garden use'
      })
      
      expect(response.status).toBe(201)
      expect(responseData).toEqual(expectedCategory)
    })

    it('should trim whitespace from name and description', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 3,
          name: 'Trimmed Category',
          description: 'Trimmed description'
        },
        error: null
      })

      const request = createMockRequest({
        name: '  Trimmed Category  ',
        description: '  Trimmed description  '
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Trimmed Category',
        description: 'Trimmed description'
      })
      expect(response.status).toBe(201)
    })

    it('should handle empty description by setting to null', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 4,
          name: 'No Description Category',
          description: null
        },
        error: null
      })

      const request = createMockRequest({
        name: 'No Description Category',
        description: ''
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'No Description Category',
        description: null
      })
    })

    it('should handle whitespace-only description by setting to null', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 5,
          name: 'Whitespace Description Category',
          description: null
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Whitespace Description Category',
        description: '   '
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Whitespace Description Category',
        description: null
      })
    })

    it('should handle undefined description by setting to null', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 6,
          name: 'Undefined Description Category',
          description: null
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Undefined Description Category',
        description: undefined
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Undefined Description Category',
        description: null
      })
    })
  })

  describe('Duplicate Category Handling', () => {
    it('should return 409 when category name already exists', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505', // Unique constraint violation
          message: 'duplicate key value violates unique constraint "categories_name_key"'
        }
      })

      const request = createMockRequest({
        name: 'Electronics',
        description: 'Electronic devices'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Category with this name already exists',
        409
      )
    })

    it('should handle case-sensitive duplicate detection', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint'
        }
      })

      const request = createMockRequest({
        name: 'ELECTRONICS'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Category with this name already exists',
        409
      )
    })

    it('should handle duplicate detection with different error message format', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'Key (name)=(Electronics) already exists.'
        }
      })

      const request = createMockRequest({
        name: 'Electronics'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith(
        'Category with this name already exists',
        409
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle general Supabase insert error', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: 'INSERT_ERROR',
          message: 'Insert operation failed'
        }
      })

      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create category', 500)
    })

    it('should handle database connection errors', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: {
          code: 'CONNECTION_ERROR',
          message: 'Could not connect to database'
        }
      })

      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create category', 500)
    })

    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create category', 500)
    })

    it('should handle validateAdminAccess failure', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockRejectedValue(new Error('Auth validation failed'))

      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create category', 500)
    })

    it('should handle JSON parsing error', async () => {
      // Arrange
      const request = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create category', 500)
    })

    it('should handle network timeout during insert', async () => {
      // Arrange
      mockSupabaseClient.single.mockRejectedValue(new Error('Network timeout'))

      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to create category', 500)
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Mock successful creation for edge case tests
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Test Category',
          description: null
        },
        error: null
      })
    })

    it('should handle very long category names', async () => {
      // Arrange
      const longName = 'A'.repeat(255)
      const request = createMockRequest({
        name: longName
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: longName,
        description: null
      })
      expect(response.status).toBe(201)
    })

    it('should handle very long descriptions', async () => {
      // Arrange
      const longDescription = 'B'.repeat(1000)
      const request = createMockRequest({
        name: 'Test Category',
        description: longDescription
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Category',
        description: longDescription
      })
    })

    it('should handle special characters in category name', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Électronics & Gadgets!',
        description: 'Catégory with spéciàl chars'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Électronics & Gadgets!',
        description: 'Catégory with spéciàl chars'
      })
    })

    it('should handle emojis in category name and description', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Home & Garden 🏠🌿',
        description: 'Category with emojis 🎉🛍️'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Home & Garden 🏠🌿',
        description: 'Category with emojis 🎉🛍️'
      })
    })

    it('should handle quotes and special symbols', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Books & "Literature"',
        description: 'Contains quotes "and" symbols & more!'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Books & "Literature"',
        description: 'Contains quotes "and" symbols & more!'
      })
    })

    it('should handle numbers in category names', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Electronics 2024',
        description: 'New electronics for year 2024'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Electronics 2024',
        description: 'New electronics for year 2024'
      })
    })

    it('should handle mixed case inputs', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'MiXeD CaSe CaTeGoRy',
        description: 'DeScRiPtIoN wItH mIxEd CaSe'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'MiXeD CaSe CaTeGoRy',
        description: 'DeScRiPtIoN wItH mIxEd CaSe'
      })
    })

    it('should handle single character names', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'A',
        description: 'Single character name'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'A',
        description: 'Single character name'
      })
    })

    it('should handle newlines and tabs in description', async () => {
      // Arrange
      const request = createMockRequest({
        name: 'Multiline Category',
        description: 'Line 1\nLine 2\tTabbed\rCarriage return'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Multiline Category',
        description: 'Line 1\nLine 2\tTabbed\rCarriage return'
      })
    })
  })

  describe('Request Body Edge Cases', () => {
    it('should handle extra fields in request body', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Test Category',
          description: null
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Test Category',
        description: 'Test description',
        extraField: 'should be ignored',
        anotherField: 123
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Category',
        description: 'Test description'
      })
      expect(response.status).toBe(201)
    })

    it('should handle null description field', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 1,
          name: 'Test Category',
          description: null
        },
        error: null
      })

      const request = createMockRequest({
        name: 'Test Category',
        description: null
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Category',
        description: null
      })
    })

    it('should handle completely empty request body', async () => {
      // Arrange
      const request = createMockRequest({})

      // Act
      const response = await POST(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Category name is required', 400)
    })
  })

  describe('Database Query Construction', () => {
    it('should call database with correct query structure', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 1, name: 'Test' },
        error: null
      })

      const request = createMockRequest({
        name: 'Test Category',
        description: 'Test description'
      })

      // Act
      await POST(request)

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('categories')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        name: 'Test Category',
        description: 'Test description'
      })
      expect(mockSupabaseClient.select).toHaveBeenCalled()
      expect(mockSupabaseClient.single).toHaveBeenCalled()
      
      // Verify the chain order
      expect(mockSupabaseClient.from).toHaveBeenCalledBefore(mockSupabaseClient.insert as any)
      expect(mockSupabaseClient.insert).toHaveBeenCalledBefore(mockSupabaseClient.select as any)
      expect(mockSupabaseClient.select).toHaveBeenCalledBefore(mockSupabaseClient.single as any)
    })

    it('should use authenticated Supabase client', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 1, name: 'Test' },
        error: null
      })

      const request = createMockRequest({
        name: 'Test Category'
      })

      // Act
      await POST(request)

      // Assert
      expect(createServerSupabaseClient).toHaveBeenCalledTimes(1)
      expect(createServerSupabaseClient).toHaveBeenCalledWith()
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