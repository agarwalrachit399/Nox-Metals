// app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ProductUpdate } from '@/lib/database.types'

// GET /api/products/[id] - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch product' },
        { status: 500 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // No rows returned
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      console.error('Supabase error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch product' },
        { status: 500 }
      )
    }

    // Validate fields if provided
    if (body.name !== undefined && (!body.name || body.name.trim() === '')) {
      return NextResponse.json(
        { error: 'Name cannot be empty' },
        { status: 400 }
      )
    }

    if (body.price !== undefined) {
      const price = parseFloat(body.price)
      if (isNaN(price) || price <= 0) {
        return NextResponse.json(
          { error: 'Price must be a positive number' },
          { status: 400 }
        )
      }
    }

    if (body.description !== undefined && (!body.description || body.description.trim() === '')) {
      return NextResponse.json(
        { error: 'Description cannot be empty' },
        { status: 400 }
      )
    }

    if (body.category !== undefined && (!body.category || body.category.trim() === '')) {
      return NextResponse.json(
        { error: 'Category cannot be empty' },
        { status: 400 }
      )
    }

    // Validate category exists if it's being updated
    if (body.category !== undefined) {
      const { data: categoryExists } = await supabase
        .from('categories')
        .select('name')
        .eq('name', body.category.trim())
        .single()

      if (!categoryExists) {
        return NextResponse.json(
          { error: 'Invalid category. Please select a valid category.' },
          { status: 400 }
        )
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
      return NextResponse.json(existingProduct)
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single()

    if (updateError) {
      console.error('Supabase error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update product' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Soft delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const { searchParams } = request.nextUrl
    const hardDelete = searchParams.get('hard') === 'true'

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // No rows returned
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      console.error('Supabase error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch product' },
        { status: 500 }
      )
    }

    if (hardDelete) {
      // Hard delete - remove from database
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (deleteError) {
        console.error('Supabase error:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete product' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        message: 'Product permanently deleted',
        product: existingProduct
      })
    } else {
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
        console.error('Supabase error:', updateError)
        return NextResponse.json(
          { error: 'Failed to delete product' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        message: 'Product soft deleted',
        product: updatedProduct
      })
    }
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}