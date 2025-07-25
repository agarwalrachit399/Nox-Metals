// app/api/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateAuthenticatedUser, validateAdminAccess, createErrorResponse } from '@/lib/auth-utils'

// GET /api/categories - Get all categories (accessible to all authenticated users)
export async function GET(request: NextRequest) {
  try {
    // Validate user is authenticated
    const authResult = await validateAuthenticatedUser()
    if (!authResult.success) {
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return createErrorResponse('Failed to fetch categories', 500)
    }

    return NextResponse.json(categories || [])
  } catch (error) {
    console.error('Error fetching categories:', error)
    return createErrorResponse('Failed to fetch categories', 500)
  }
}

// POST /api/categories - Create new category (Admin only)
export async function POST(request: NextRequest) {
  try {
    // Validate admin access
    const authResult = await validateAdminAccess()
    if (!authResult.success) {
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.name?.trim()) {
      return createErrorResponse('Category name is required', 400)
    }

    const categoryData = {
      name: body.name.trim(),
      description: body.description?.trim() || null
    }

    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return createErrorResponse('Category with this name already exists', 409)
      }
      console.error('Supabase error:', error)
      return createErrorResponse('Failed to create category', 500)
    }

    return NextResponse.json(newCategory, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return createErrorResponse('Failed to create category', 500)
  }
}