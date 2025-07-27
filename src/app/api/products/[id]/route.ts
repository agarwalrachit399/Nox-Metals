// app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ProductUpdate } from "@/lib/database.types";
import {
  createServerSupabaseClient,
  validateAuthenticatedUser,
  validateAdminAccess,
  createErrorResponse,
} from "@/lib/auth-utils";

// GET /api/products/[id] - Get single product (accessible to all authenticated users)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Validate user is authenticated
    const authResult = await validateAuthenticatedUser();

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error ?? "Authentication error",
        authResult.status ?? 401,
      );
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient();

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId) || productId <= 0 || !Number.isInteger(Number(id))) {
      return createErrorResponse("Invalid product ID", 400);
    }

    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) {
      console.error("❌ Error fetching product:", error);
      if (error.code === "PGRST116") {
        // No rows returned
        return createErrorResponse("Product not found", 404);
      }
      return createErrorResponse("Failed to fetch product", 500);
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("💥 Error in product GET:", error);
    return createErrorResponse("Failed to fetch product", 500);
  }
}

// PUT /api/products/[id] - Update product (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Validate admin access
    const authResult = await validateAdminAccess();

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error ?? "Authentication error",
        authResult.status ?? 401,
      );
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient();

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId) || productId <= 0 || !Number.isInteger(Number(id))) {
      return createErrorResponse("Invalid product ID", 400);
    }

    const body = await request.json();

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        // No rows returned
        return createErrorResponse("Product not found", 404);
      }
      console.error("❌ Error fetching existing product:", fetchError);
      return createErrorResponse("Failed to fetch product", 500);
    }

    // Validate fields if provided
    if (body.name !== undefined && (!body.name || body.name.trim() === "")) {
      return createErrorResponse("Name cannot be empty", 400);
    }

    if (body.price !== undefined) {
      const price = parseFloat(body.price);
      if (isNaN(price) || price <= 0) {
        return createErrorResponse("Price must be a positive number", 400);
      }
    }

    if (
      body.description !== undefined &&
      (!body.description || body.description.trim() === "")
    ) {
      return createErrorResponse("Description cannot be empty", 400);
    }

    if (
      body.category !== undefined &&
      (!body.category || body.category.trim() === "")
    ) {
      return createErrorResponse("Category cannot be empty", 400);
    }

    // Validate category exists if it's being updated
    if (body.category !== undefined) {
      const { data: categoryExists, error: categoryError } = await supabase
        .from("categories")
        .select("name")
        .eq("name", body.category.trim())
        .single();
      if (categoryError?.code === "PGRST116") {
        return createErrorResponse(
          "Invalid category. Please select a valid category.",
          400,
        );
      }

      if (categoryError || !categoryExists) {
        return createErrorResponse(
          "Invalid category. Please select a valid category.",
          400,
        );
      }
    }

    // Build update data
    const updateData: ProductUpdate = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.description !== undefined)
      updateData.description = body.description.trim();
    if (body.category !== undefined) updateData.category = body.category.trim();
    if (body.image !== undefined) updateData.image = body.image?.trim() || null;
    if (body.is_deleted !== undefined) updateData.is_deleted = body.is_deleted;

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existingProduct);
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating product:", updateError);
      return createErrorResponse("Failed to update product", 500);
    }

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("💥 Error in product PUT:", error);
    return createErrorResponse("Failed to update product", 500);
  }
}

// DELETE /api/products/[id] - Delete product (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Validate admin access
    const authResult = await validateAdminAccess();
    if (!authResult.success) {
      return createErrorResponse(
        authResult.error ?? "Authentication error",
        authResult.status ?? 401,
      );
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient();

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId) || productId <= 0 || !Number.isInteger(Number(id))) {
      return createErrorResponse("Invalid product ID", 400);
    }

    // Check if product exists
    const { error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        // No rows returned
        return createErrorResponse("Product not found", 404);
      }
      console.error("❌ Error fetching product for deletion:", fetchError);
      return createErrorResponse("Failed to fetch product", 500);
    }

    // Soft delete - mark as deleted
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error soft deleting product:", updateError);
      return createErrorResponse("Failed to delete product", 500);
    }

    return NextResponse.json({
      message: "Product deleted successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("💥 Error in product DELETE:", error);
    return createErrorResponse("Failed to delete product", 500);
  }
}
