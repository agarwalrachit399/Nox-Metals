// app/api/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  validateAuthenticatedUser,
  validateAdminAccess,
  createErrorResponse,
  createServerSupabaseClient,
} from "@/lib/auth-utils";

// GET /api/categories - Get all categories (accessible to all authenticated users)
export async function GET(request: NextRequest) {
  try {
    // Use cached validation
    const authResult = await validateAuthenticatedUser(request);

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error ?? "Authentication error",
        authResult.status ?? 401,
      );
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient();

    const { data: categories, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("❌ Categories Supabase error:", error);
      return createErrorResponse("Failed to fetch categories", 500);
    }

    return NextResponse.json(categories || []);
  } catch (error) {
    console.error("💥 Error in categories API:", error);
    return createErrorResponse("Failed to fetch categories", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use cached admin validation
    const authResult = await validateAdminAccess(request);

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error ?? "Authentication error",
        authResult.status ?? 401,
      );
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient();

    const body = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return createErrorResponse("Category name is required", 400);
    }

    const categoryData = {
      name: body.name.trim(),
      description: body.description?.trim() || null,
    };

    const { data: newCategory, error } = await supabase
      .from("categories")
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase error creating category:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        return createErrorResponse(
          "Category with this name already exists",
          409,
        );
      }
      return createErrorResponse("Failed to create category", 500);
    }

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("💥 Error in categories POST:", error);
    return createErrorResponse("Failed to create category", 500);
  }
}
