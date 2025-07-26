// app/api/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAuthenticatedUser, validateAdminAccess, createErrorResponse, createServerSupabaseClient } from '@/lib/auth-utils'

// GET /api/categories - Get all categories (accessible to all authenticated users)
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: /api/categories called')
    
    // Use cached validation
    const authResult = await validateAuthenticatedUser(request)
    console.log('🔑 Categories auth validation:', authResult)
    
    if (!authResult.success) {
      console.log('❌ Categories auth failed:', authResult.error)
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()
    console.log('🔌 Created authenticated categories client')

    console.log('🚀 Executing authenticated categories query...')
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    console.log('📂 Categories query results:', {
      categoriesCount: categories?.length || 0,
      hasError: !!error,
      error: error?.message,
      categories: categories?.slice(0, 3) // Log first 3 for debugging
    })

    if (error) {
      console.error('❌ Categories Supabase error:', error)
      return createErrorResponse('Failed to fetch categories', 500)
    }

    console.log('✅ Categories API success, returning:', categories?.length || 0, 'categories')
    return NextResponse.json(categories || [])
  } catch (error) {
    console.error('💥 Error in categories API:', error)
    return createErrorResponse('Failed to fetch categories', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 API: POST /api/categories called')
    
    // Use cached admin validation
    const authResult = await validateAdminAccess(request)
    console.log('🔑 Admin validation result:', authResult)
    
    if (!authResult.success) {
      console.log('❌ Admin validation failed:', authResult.error)
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()
    console.log('🔌 Created authenticated client for category creation')

    const body = await request.json()
    console.log('📋 Category creation data:', { name: body.name, hasDescription: !!body.description })
    
    // Validate required fields
    if (!body.name?.trim()) {
      console.log('❌ Missing category name')
      return createErrorResponse('Category name is required', 400)
    }

    const categoryData = {
      name: body.name.trim(),
      description: body.description?.trim() || null
    }

    console.log('🚀 Creating category with authenticated client...')
    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase error creating category:', error)
      if (error.code === '23505') { // Unique constraint violation
        return createErrorResponse('Category with this name already exists', 409)
      }
      return createErrorResponse('Failed to create category', 500)
    }

    console.log('✅ Category created successfully:', newCategory.id)
    return NextResponse.json(newCategory, { status: 201 })
  } catch (error) {
    console.error('💥 Error in categories POST:', error)
    return createErrorResponse('Failed to create category', 500)
  }
}