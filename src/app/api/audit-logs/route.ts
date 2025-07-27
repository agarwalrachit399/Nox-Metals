// src/app/api/audit-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  validateAdminAccess,
  createErrorResponse,
} from "@/lib/auth-utils";

// GET /api/audit-logs - Get audit logs (Admin only)
export async function GET(request: NextRequest) {
  try {
    // Use cached admin validation
    const authResult = await validateAdminAccess(request);

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error ?? "Admin access required",
        authResult.status ?? 403,
      );
    }

    // Create authenticated Supabase client
    const supabase = await createServerSupabaseClient();

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limitParam = parseInt(searchParams.get("limit") || "20");
    const limit = limitParam > 0 && limitParam <= 100 ? limitParam : 20;
    const action = searchParams.get("action"); // Filter by action
    const tableName = searchParams.get("table"); // Filter by table
    const startDate = searchParams.get("startDate"); // Filter by date range
    const endDate = searchParams.get("endDate");

    // Start building the query
    let query = supabase.from("audit_logs").select("*", { count: "exact" });

    // Filter by action
    if (action && action !== "all") {
      query = query.eq("action", action);
    }

    // Filter by table name
    if (tableName && tableName !== "all") {
      query = query.eq("table_name", tableName);
    }

    // Filter by date range
    if (startDate) {
      query = query.gte("timestamp", startDate);
    }

    if (endDate) {
      query = query.lte("timestamp", endDate);
    }

    // Order by timestamp (newest first)
    query = query.order("timestamp", { ascending: false });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    query = query.range(startIndex, startIndex + limit - 1);
    const { data: auditLogs, error, count } = await query;

    if (error) {
      console.error("❌ Supabase error fetching audit logs:", error);
      return createErrorResponse("Failed to fetch audit logs", 500);
    }

    return NextResponse.json({
      auditLogs: auditLogs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("💥 Error in audit logs API:", error);
    return createErrorResponse("Failed to fetch audit logs", 500);
  }
}
