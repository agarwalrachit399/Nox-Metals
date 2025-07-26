// app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ProductUpdate } from '@/lib/database.types'
import { createServerSupabaseClient, validateAuthenticatedUser, validateAdminAccess, createErrorResponse } from '@/lib/auth-utils'

// GET /api/products/[id] - Get single product (accessible to all authenticated users)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 API: GET /api/products/[id] called')
    
    // Validate user is authenticated
    const authResult = await validateAuthenticatedUser()
    console.log('🔑 Auth validation result:', authResult)
    
    if (!authResult.success) {
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()

    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return createErrorResponse('Invalid product ID', 400)
    }

    console.log('🔍 Fetching product:', productId)
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
    if (error) {
      console.error('❌ Error fetching product:', error)
      if (error.code === 'PGRST116') { // No rows returned
        return createErrorResponse('Product not found', 404)
      }
      return createErrorResponse('Failed to fetch product', 500)
    }

    console.log('✅ Product fetched successfully:', product.id)
    return NextResponse.json(product)
  } catch (error) {
    console.error('💥 Error in product GET:', error)
    return createErrorResponse('Failed to fetch product', 500)
  }
}

// PUT /api/products/[id] - Update product (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 API: PUT /api/products/[id] called')
    
    // Validate admin access
    const authResult = await validateAdminAccess()
    console.log('🔑 Admin validation result:', authResult)
    
    if (!authResult.success) {
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()
    console.log('🔌 Created authenticated client for product update')

    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return createErrorResponse('Invalid product ID', 400)
    }

    const body = await request.json()
    console.log('📋 Product update data:', {
      productId,
      fieldsToUpdate: Object.keys(body)
    })

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // No rows returned
        return createErrorResponse('Product not found', 404)
      }
      console.error('❌ Error fetching existing product:', fetchError)
      return createErrorResponse('Failed to fetch product', 500)
    }

    // Validate fields if provided
    if (body.name !== undefined && (!body.name || body.name.trim() === '')) {
      return createErrorResponse('Name cannot be empty', 400)
    }

    if (body.price !== undefined) {
      const price = parseFloat(body.price)
      if (isNaN(price) || price <= 0) {
        return createErrorResponse('Price must be a positive number', 400)
      }
    }

    if (body.description !== undefined && (!body.description || body.description.trim() === '')) {
      return createErrorResponse('Description cannot be empty', 400)
    }

    if (body.category !== undefined && (!body.category || body.category.trim() === '')) {
      return createErrorResponse('Category cannot be empty', 400)
    }

    // Validate category exists if it's being updated
    if (body.category !== undefined) {
      const { data: categoryExists } = await supabase
        .from('categories')
        .select('name')
        .eq('name', body.category.trim())
        .single()

      if (!categoryExists) {
        return createErrorResponse('Invalid category. Please select a valid category.', 400)
      }
    }

    // Build update data
    const updateData: ProductUpdate = {}
    
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.price !== undefined) updateData.price = parseFloat(body.price)
    if (body.description !== undefined) updateData.description = body.description.trim()
    if (body.category !== undefined) updateData.category = body.category.trim()
    if (body.image !== undefined) updateData.image = body.image?.trim() || null
    if (body.is_deleted !== undefined) updateData.is_deleted = body.is_deleted

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      console.log('📝 No changes to update')
      return NextResponse.json(existingProduct)
    }

    console.log('🚀 Updating product with authenticated client...')
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating product:', updateError)
      return createErrorResponse('Failed to update product', 500)
    }

    console.log('✅ Product updated successfully:', updatedProduct.id)
    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('💥 Error in product PUT:', error)
    return createErrorResponse('Failed to update product', 500)
  }
}

// DELETE /api/products/[id] - Delete product (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 API: DELETE /api/products/[id] called')
    
    // Validate admin access
    const authResult = await validateAdminAccess()
    console.log('🔑 Admin validation result:', authResult)
    
    if (!authResult.success) {
      return createErrorResponse(authResult.error ?? 'Authentication error', authResult.status ?? 401)  
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient()
    console.log('🔌 Created authenticated client for product deletion')

    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return createErrorResponse('Invalid product ID', 400)
    }

    const { searchParams } = request.nextUrl
    const hardDelete = searchParams.get('hard') === 'true'
    console.log('🗑️ Delete type:', hardDelete ? 'hard' : 'soft')

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // No rows returned
        return createErrorResponse('Product not found', 404)
      }
      console.error('❌ Error fetching product for deletion:', fetchError)
      return createErrorResponse('Failed to fetch product', 500)
    }

    if (hardDelete) {
      console.log('🚀 Performing hard delete...')
      // Hard delete - remove from database
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (deleteError) {
        console.error('❌ Error hard deleting product:', deleteError)
        return createErrorResponse('Failed to delete product', 500)
      }

      console.log('✅ Product hard deleted successfully:', productId)
      return NextResponse.json({ 
        message: 'Product permanently deleted',
        product: existingProduct
      })
    } else {
      console.log('🚀 Performing soft delete...')
      // Soft delete - mark as deleted
      const { data: updatedProduct, error: updateError } = await supabase
        .from('products')
        .update({ 
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Error soft deleting product:', updateError)
        return createErrorResponse('Failed to delete product', 500)
      }
      
      console.log('✅ Product soft deleted successfully:', productId)
      return NextResponse.json({
        message: 'Product soft deleted',
        product: updatedProduct
      })
    }
  } catch (error) {
    console.error('💥 Error in product DELETE:', error)
    return createErrorResponse('Failed to delete product', 500)
  }
}