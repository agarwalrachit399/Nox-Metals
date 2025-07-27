// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ProductInsert } from "@/lib/database.types";
import {
  validateAuthenticatedUser,
  validateAdminAccess,
  createErrorResponse,
  createServerSupabaseClient,
} from "@/lib/auth-utils";

// GET /api/products - Get all products (accessible to all authenticated users)
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

    const { searchParams } = request.nextUrl;
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const sortBy = searchParams.get("sortBy") || "created_at-desc";

    // Handle pagination with proper validation
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = pageParam ? Math.max(1, parseInt(pageParam) || 1) : 1;
    const limit = limitParam
      ? Math.max(1, Math.min(100, parseInt(limitParam) || 10))
      : 10;

    // Start building the query with authenticated client
    let query = supabase.from("products").select("*", { count: "exact" });

    // Filter by deleted status
    if (!includeDeleted) {
      query = query.eq("is_deleted", false);
    }

    // Filter by search term
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Filter by category
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Apply sorting
    switch (sortBy) {
      case "name-asc":
        query = query.order("name", { ascending: true });
        break;
      case "name-desc":
        query = query.order("name", { ascending: false });
        break;
      case "price-asc":
        query = query.order("price", { ascending: true });
        break;
      case "price-desc":
        query = query.order("price", { ascending: false });
        break;
      case "created_at-desc":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    query = query.range(startIndex, startIndex + limit - 1);

    const { data: products, error, count } = await query;

    if (error) {
      console.error("❌ Supabase error:", error);
      return createErrorResponse("Failed to fetch products", 500);
    }

    return NextResponse.json({
      products: products || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("💥 Error in products API:", error);
    return createErrorResponse("Failed to fetch products", 500);
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
    if (
      !body.name?.trim() ||
      body.price == null ||
      !body.description?.trim() ||
      !body.category?.trim()
    ) {
      return createErrorResponse(
        "Missing required fields: name, price, description, category",
        400,
      );
    }

    // Validate price is a positive number
    const price = parseFloat(body.price);
    if (isNaN(price) || price <= 0) {
      return createErrorResponse("Price must be a positive number", 400);
    }

    // Validate category exists
    const { data: categoryExists } = await supabase
      .from("categories")
      .select("name")
      .eq("name", body.category.trim())
      .single();

    if (!categoryExists) {
      return createErrorResponse(
        "Invalid category. Please select a valid category.",
        400,
      );
    }

    const productData: ProductInsert = {
      name: body.name.trim(),
      price: price,
      description: body.description.trim(),
      category: body.category.trim(),
      image: body.image?.trim() || null,
      is_deleted: false,
    };

    const { data: newProduct, error } = await supabase
      .from("products")
      .insert(productData)
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase error creating product:", error);
      return createErrorResponse("Failed to create product", 500);
    }

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error("💥 Error in products POST:", error);
    return createErrorResponse("Failed to create product", 500);
  }
}
