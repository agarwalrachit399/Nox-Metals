// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ProductInsert } from '@/lib/database.types'
import { validateAuthenticatedUser, validateAdminAccess, createErrorResponse, createServerSupabaseClient } from '@/lib/auth-utils'

// GET /api/products - Get all products (accessible to all authenticated users)
// Update your src/app/api/products/route.ts GET function with debug logging

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: /api/products called')
    
    // Validate user is authenticated
    const authResult = await validateAuthenticatedUser()
    console.log('🔑 Auth validation result:', authResult)
    
    if (!authResult.success) {
      console.log('❌ Auth failed:', authResult.error)
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()
    console.log('🔌 Created authenticated Supabase client')

    const { searchParams } = request.nextUrl
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const sortBy = searchParams.get('sortBy') || 'created_at-desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log('📋 Query params:', {
      includeDeleted,
      search,
      category,
      sortBy,
      page,
      limit
    })

    // Start building the query with authenticated client
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })

    console.log('🏗️ Base query created with authenticated client')

    // Filter by deleted status
    if (!includeDeleted) {
      query = query.eq('is_deleted', false)
      console.log('🚫 Added is_deleted filter: false')
    }

    // Filter by search term
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      console.log('🔍 Added search filter:', search)
    }

    // Filter by category
    if (category && category !== 'all') {
      query = query.eq('category', category)
      console.log('📂 Added category filter:', category)
    }

    // Apply sorting
    switch (sortBy) {
      case 'name-asc':
        query = query.order('name', { ascending: true })
        break
      case 'name-desc':
        query = query.order('name', { ascending: false })
        break
      case 'price-asc':
        query = query.order('price', { ascending: true })
        break
      case 'price-desc':
        query = query.order('price', { ascending: false })
        break
      case 'created_at-desc':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }
    console.log('📊 Added sorting:', sortBy)

    // Apply pagination
    const startIndex = (page - 1) * limit
    query = query.range(startIndex, startIndex + limit - 1)
    console.log('📄 Added pagination:', { startIndex, endIndex: startIndex + limit - 1 })

    console.log('🚀 Executing authenticated query...')
    const { data: products, error, count } = await query

    console.log('📦 Query results:', {
      productsCount: products?.length || 0,
      totalCount: count,
      hasError: !!error,
      error: error?.message
    })

    if (error) {
      console.error('❌ Supabase error:', error)
      return createErrorResponse('Failed to fetch products', 500)
    }

    console.log('✅ Products API success, returning:', {
      productsLength: products?.length || 0,
      totalCount: count,
      page,
      limit
    })

    return NextResponse.json({
      products: products || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('💥 Error in products API:', error)
    return createErrorResponse('Failed to fetch products', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 API: POST /api/products called')
    
    // Validate admin access
    const authResult = await validateAdminAccess()
    console.log('🔑 Admin validation result:', authResult)
    
    if (!authResult.success) {
      console.log('❌ Admin validation failed:', authResult.error)
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()
    console.log('🔌 Created authenticated client for product creation')

    const body = await request.json()
    console.log('📋 Product creation data:', {
      name: body.name,
      price: body.price,
      category: body.category,
      hasDescription: !!body.description,
      hasImage: !!body.image
    })
    
    // Validate required fields
    if (!body.name?.trim() || !body.price || !body.description?.trim() || !body.category?.trim()) {
      console.log('❌ Missing required fields')
      return createErrorResponse('Missing required fields: name, price, description, category', 400)
    }

    // Validate price is a positive number
    const price = parseFloat(body.price)
    if (isNaN(price) || price <= 0) {
      console.log('❌ Invalid price:', body.price)
      return createErrorResponse('Price must be a positive number', 400)
    }

    // Validate category exists
    console.log('🔍 Validating category exists:', body.category.trim())
    const { data: categoryExists } = await supabase
      .from('categories')
      .select('name')
      .eq('name', body.category.trim())
      .single()

    if (!categoryExists) {
      console.log('❌ Invalid category:', body.category.trim())
      return createErrorResponse('Invalid category. Please select a valid category.', 400)
    }

    const productData: ProductInsert = {
      name: body.name.trim(),
      price: price,
      description: body.description.trim(),
      category: body.category.trim(),
      image: body.image?.trim() || null,
      is_deleted: false
    }

    console.log('🚀 Creating product with authenticated client...')
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase error creating product:', error)
      return createErrorResponse('Failed to create product', 500)
    }

    console.log('✅ Product created successfully:', newProduct.id)
    return NextResponse.json(newProduct, { status: 201 })
  } catch (error) {
    console.error('💥 Error in products POST:', error)
    return createErrorResponse('Failed to create product', 500)
  }
}