import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/audit-logs/route'

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

// Mock Supabase client - range is the final method that returns a Promise
const createMockSupabaseClient = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn(),
})

describe('GET /api/audit-logs', () => {
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
      
      const request = createMockRequest()

      // Act
      const response = await GET(request)

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
      
      const request = createMockRequest()

      // Act
      const response = await GET(request)

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

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Service unavailable', 503)
    })

    it('should proceed when user is admin', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(validateAdminAccess).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
    })
  })

  describe('Successful Audit Log Fetching', () => {
    it('should return audit logs with default parameters', async () => {
      // Arrange
      const mockAuditLogs = [
        {
          id: 1,
          action: 'CREATE',
          table_name: 'products',
          record_id: 123,
          user_email: 'admin@example.com',
          changes: { name: 'New Product', price: 10.99 },
          timestamp: '2024-01-01T12:00:00Z'
        },
        {
          id: 2,
          action: 'UPDATE',
          table_name: 'categories',
          record_id: 456,
          user_email: 'admin@example.com',
          changes: { name: 'Updated Category' },
          timestamp: '2024-01-01T11:00:00Z'
        }
      ]

      mockSupabaseClient.range.mockResolvedValue({
        data: mockAuditLogs,
        error: null,
        count: 2
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audit_logs')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('timestamp', { ascending: false })
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 19) // page 1, limit 20

      expect(responseData).toEqual({
        auditLogs: mockAuditLogs,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1
        }
      })
    })

    it('should handle action filter', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?action=CREATE')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('action', 'CREATE')
    })

    it('should handle table name filter', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?table=products')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('table_name', 'products')
    })

    it('should handle start date filter', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?startDate=2024-01-01')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', '2024-01-01')
    })

    it('should handle end date filter', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?endDate=2024-12-31')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', '2024-12-31')
    })

    it('should handle pagination parameters', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 100
      })

      const request = createMockRequest('?page=3&limit=10')

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(20, 29) // (page-1)*limit, startIndex+limit-1
      expect(responseData.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 100,
        totalPages: 10
      })
    })

    it('should handle multiple filters combined', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?action=UPDATE&table=products&startDate=2024-01-01&endDate=2024-12-31&page=2&limit=5')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('action', 'UPDATE')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('table_name', 'products')
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', '2024-01-01')
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', '2024-12-31')
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(5, 9)
    })

    it('should ignore "all" action filter', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?action=all')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).not.toHaveBeenCalledWith('action', 'all')
    })

    it('should ignore "all" table filter', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?table=all')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).not.toHaveBeenCalledWith('table_name', 'all')
    })
  })

  describe('Different Action Types', () => {
    beforeEach(() => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })
    })

    it('should handle CREATE action filter', async () => {
      // Arrange
      const request = createMockRequest('?action=CREATE')

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('action', 'CREATE')
    })

    it('should handle UPDATE action filter', async () => {
      // Arrange
      const request = createMockRequest('?action=UPDATE')

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('action', 'UPDATE')
    })

    it('should handle DELETE action filter', async () => {
      // Arrange
      const request = createMockRequest('?action=DELETE')

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('action', 'DELETE')
    })

    it('should handle RESTORE action filter', async () => {
      // Arrange
      const request = createMockRequest('?action=RESTORE')

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('action', 'RESTORE')
    })
  })

  describe('Different Table Filters', () => {
    beforeEach(() => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })
    })

    it('should handle products table filter', async () => {
      // Arrange
      const request = createMockRequest('?table=products')

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('table_name', 'products')
    })

    it('should handle categories table filter', async () => {
      // Arrange
      const request = createMockRequest('?table=categories')

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('table_name', 'categories')
    })

    it('should handle users table filter', async () => {
      // Arrange
      const request = createMockRequest('?table=users')

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('table_name', 'users')
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
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch audit logs', 500)
    })

    it('should handle createServerSupabaseClient failure', async () => {
      // Arrange
      vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error('Client creation failed'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch audit logs', 500)
    })

    it('should handle validateAdminAccess failure', async () => {
      // Arrange
      vi.mocked(validateAdminAccess).mockRejectedValue(new Error('Auth validation failed'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch audit logs', 500)
    })

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.range.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch audit logs', 500)
    })

    it('should handle network timeout during query', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: null,
        error: { message: 'Query timeout', code: 'TIMEOUT' },
        count: null
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(createErrorResponse).toHaveBeenCalledWith('Failed to fetch audit logs', 500)
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

      const request = createMockRequest('?action=&table=&startDate=&endDate=')

      // Act
      const response = await GET(request)

      // Assert
      // Should not apply empty filters
      expect(mockSupabaseClient.eq).not.toHaveBeenCalled()
      expect(mockSupabaseClient.gte).not.toHaveBeenCalled()
      expect(mockSupabaseClient.lte).not.toHaveBeenCalled()
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
      // Should default to page 1, limit 20
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 19)
      expect(responseData.pagination.page).toBe(1)
      expect(responseData.pagination.limit).toBe(20)
    })

    it('should handle negative pagination parameters', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?page=-1&limit=-5')

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      // Should default to page 1, limit 20
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 19)
      expect(responseData.pagination.page).toBe(1)
      expect(responseData.pagination.limit).toBe(20)
    })

    it('should return empty array when no audit logs found', async () => {
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
      expect(responseData.auditLogs).toEqual([])
      expect(responseData.pagination.total).toBe(0)
      expect(responseData.pagination.totalPages).toBe(0)
    })

    it('should handle null response from Supabase gracefully', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: null,
        error: null,
        count: 0
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(responseData.auditLogs).toEqual([])
      expect(responseData.pagination.total).toBe(0)
    })

    it('should handle audit logs with null user_email', async () => {
      // Arrange
      const mockAuditLogs = [
        {
          id: 1,
          action: 'CREATE',
          table_name: 'products',
          record_id: 123,
          user_email: null,
          changes: { name: 'System Generated' },
          timestamp: '2024-01-01T12:00:00Z'
        }
      ]

      mockSupabaseClient.range.mockResolvedValue({
        data: mockAuditLogs,
        error: null,
        count: 1
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(responseData.auditLogs[0].user_email).toBeNull()
    })

    it('should handle audit logs with complex changes objects', async () => {
      // Arrange
      const mockAuditLogs = [
        {
          id: 1,
          action: 'UPDATE',
          table_name: 'products',
          record_id: 123,
          user_email: 'admin@example.com',
          changes: {
            before: { name: 'Old Name', price: 10.99 },
            after: { name: 'New Name', price: 15.99 },
            metadata: { source: 'admin_panel', timestamp: '2024-01-01T12:00:00Z' }
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      ]

      mockSupabaseClient.range.mockResolvedValue({
        data: mockAuditLogs,
        error: null,
        count: 1
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(responseData.auditLogs[0].changes).toEqual(mockAuditLogs[0].changes)
    })

    it('should handle very large pagination requests', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest('?page=1000&limit=100')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(99900, 99999) // (1000-1)*100, startIndex+100-1
    })
  })

  describe('Date Range Edge Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })
    })

    it('should handle invalid date formats gracefully', async () => {
      // Arrange
      const request = createMockRequest('?startDate=invalid-date&endDate=also-invalid')

      // Act
      const response = await GET(request)

      // Assert
      // Should still apply the filters even with invalid dates (DB will handle validation)
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', 'invalid-date')
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', 'also-invalid')
    })

    it('should handle date range where start is after end', async () => {
      // Arrange
      const request = createMockRequest('?startDate=2024-12-31&endDate=2024-01-01')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', '2024-12-31')
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', '2024-01-01')
    })

    it('should handle same start and end date', async () => {
      // Arrange
      const request = createMockRequest('?startDate=2024-01-01&endDate=2024-01-01')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', '2024-01-01')
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', '2024-01-01')
    })

    it('should handle only start date without end date', async () => {
      // Arrange
      const request = createMockRequest('?startDate=2024-01-01')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('timestamp', '2024-01-01')
      expect(mockSupabaseClient.lte).not.toHaveBeenCalled()
    })

    it('should handle only end date without start date', async () => {
      // Arrange
      const request = createMockRequest('?endDate=2024-12-31')

      // Act
      const response = await GET(request)

      // Assert
      expect(mockSupabaseClient.gte).not.toHaveBeenCalled()
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('timestamp', '2024-12-31')
    })
  })

  describe('Response Format', () => {
    it('should return audit logs with correct structure', async () => {
      // Arrange
      const mockAuditLog = {
        id: 1,
        action: 'CREATE',
        table_name: 'products',
        record_id: 123,
        user_email: 'admin@example.com',
        changes: { name: 'Test Product' },
        timestamp: '2024-01-01T12:00:00Z'
      }

      mockSupabaseClient.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
        count: 1
      })

      const request = createMockRequest()

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData).toHaveProperty('auditLogs')
      expect(responseData).toHaveProperty('pagination')
      expect(Array.isArray(responseData.auditLogs)).toBe(true)
      expect(responseData.auditLogs[0]).toEqual(mockAuditLog)
    })

    it('should return correct pagination structure', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 50
      })

      const request = createMockRequest('?page=3&limit=10')

      // Act
      const response = await GET(request)
      const responseData = await response.json()

      // Assert
      expect(responseData.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5
      })
    })
  })

  describe('Database Query Construction', () => {
    it('should call database with correct query structure for basic request', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const request = createMockRequest()

      // Act
      await GET(request)

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audit_logs')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('timestamp', { ascending: false })
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 19)
      
      // Verify the chain order
      expect(mockSupabaseClient.from).toHaveBeenCalledBefore(mockSupabaseClient.select as any)
      expect(mockSupabaseClient.select).toHaveBeenCalledBefore(mockSupabaseClient.order as any)
      expect(mockSupabaseClient.order).toHaveBeenCalledBefore(mockSupabaseClient.range as any)
    })

    it('should use authenticated Supabase client', async () => {
      // Arrange
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
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
  const url = `http://localhost:3000/api/audit-logs${searchParams}`
  return {
    nextUrl: {
      searchParams: new URLSearchParams(searchParams.replace('?', ''))
    },
    headers: new Map([['cookie', 'test-cookie=value']])
  } as any
}