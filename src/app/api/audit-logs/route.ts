// src/app/api/audit-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, validateAdminAccess, createErrorResponse } from '@/lib/auth-utils'

// GET /api/audit-logs - Get audit logs (Admin only)
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: /api/audit-logs called')
    
    // Validate admin access
    const authResult = await validateAdminAccess()
    console.log('🔑 Admin validation result:', authResult)
    
    if (!authResult.success) {
      console.log('❌ Admin validation failed:', authResult.error)
      return createErrorResponse(authResult.error ?? 'Admin access required', authResult.status ?? 403)
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()
    console.log('🔌 Created authenticated client for audit logs')

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action') // Filter by action
    const tableName = searchParams.get('table') // Filter by table
    const startDate = searchParams.get('startDate') // Filter by date range
    const endDate = searchParams.get('endDate')

    console.log('📋 Audit logs query params:', {
      page,
      limit,
      action,
      tableName,
      startDate,
      endDate
    })

    // Start building the query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })

    // Filter by action
    if (action && action !== 'all') {
      query = query.eq('action', action)
      console.log('🎯 Added action filter:', action)
    }

    // Filter by table name
    if (tableName && tableName !== 'all') {
      query = query.eq('table_name', tableName)
      console.log('🏷️ Added table filter:', tableName)
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('timestamp', startDate)
      console.log('📅 Added start date filter:', startDate)
    }
    
    if (endDate) {
      query = query.lte('timestamp', endDate)
      console.log('📅 Added end date filter:', endDate)
    }

    // Order by timestamp (newest first)
    query = query.order('timestamp', { ascending: false })

    // Apply pagination
    const startIndex = (page - 1) * limit
    query = query.range(startIndex, startIndex + limit - 1)
    console.log('📄 Added pagination:', { startIndex, endIndex: startIndex + limit - 1 })

    console.log('🚀 Executing audit logs query...')
    const { data: auditLogs, error, count } = await query

    console.log('📊 Audit logs query results:', {
      logsCount: auditLogs?.length || 0,
      totalCount: count,
      hasError: !!error,
      error: error?.message
    })

    if (error) {
      console.error('❌ Supabase error fetching audit logs:', error)
      return createErrorResponse('Failed to fetch audit logs', 500)
    }

    console.log('✅ Audit logs API success, returning:', {
      logsLength: auditLogs?.length || 0,
      totalCount: count,
      page,
      limit
    })

    return NextResponse.json({
      auditLogs: auditLogs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('💥 Error in audit logs API:', error)
    return createErrorResponse('Failed to fetch audit logs', 500)
  }
}