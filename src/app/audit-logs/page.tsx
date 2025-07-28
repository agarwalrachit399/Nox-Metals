// src/app/audit-logs/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AdminOnly } from "@/components/role-guard";
import AuthGuard from "@/components/auth-guard";
import Navbar from "@/components/navbar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AccessDeniedAlert, ErrorAlert } from "@/components/ui/error-alert";

interface AuditLog {
  id: number;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  table_name: string;
  record_id: number;
  user_email: string | null;
  changes: Record<string, unknown> | null;
  timestamp: string;
}

interface ApiResponse {
  auditLogs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AuditLogsPage() {
  // State for audit logs and API
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for filters
  const [currentPage, setCurrentPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const itemsPerPage = 20;

  // Fetch audit logs from API
  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const searchParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(actionFilter !== "all" && { action: actionFilter }),
        ...(tableFilter !== "all" && { table: tableFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`/api/audit-logs?${searchParams}`);

      if (!response.ok) {
        if (response.status === 403) {
          setError("Access denied. Only administrators can view audit logs.");
        } else {
          throw new Error("Failed to fetch audit logs");
        }
        return;
      }

      const data: ApiResponse = await response.json();
      setAuditLogs(data.auditLogs);
      setTotalPages(data.pagination.totalPages);
      setTotalLogs(data.pagination.total);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setError("Failed to load audit logs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, actionFilter, tableFilter, startDate, endDate]);

  // Fetch logs on component mount and when filters change
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, tableFilter, startDate, endDate]);

  // Handle pagination
  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get action badge variant
  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "CREATE":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      case "RESTORE":
        return "outline";
      default:
        return "secondary";
    }
  };

  // Format changes for display
  const formatChanges = (changes: Record<string, unknown> | null) => {
    if (!changes) return "No changes recorded";

    try {
      return JSON.stringify(changes, null, 2);
    } catch {
      return "Invalid change data";
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <AdminOnly
          fallback={
            <div className="container mx-auto px-4 py-8">
              <AccessDeniedAlert message="Access denied. Only administrators can view audit logs." />
            </div>
          }
        >
          <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-bold">Audit Logs</h1>
                  <Badge variant="default" className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    Admin Only
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchAuditLogs}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              <p className="text-muted-foreground">
                View system activity and data changes across all tables
              </p>
            </div>

            {/* Error State */}
            {error && (
              <ErrorAlert
                error={error}
                onRetry={fetchAuditLogs}
                className="mb-6"
              />
            )}

            {/* Filters */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Action Filter */}
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full lg:w-[200px]">
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        All Actions
                      </div>
                    </SelectItem>
                    <SelectItem value="CREATE">CREATE</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="RESTORE">RESTORE</SelectItem>
                  </SelectContent>
                </Select>

                {/* Table Filter */}
                <Select value={tableFilter} onValueChange={setTableFilter}>
                  <SelectTrigger className="w-full lg:w-[200px]">
                    <SelectValue placeholder="Filter by table" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        All Tables
                      </div>
                    </SelectItem>
                    <SelectItem value="products">products</SelectItem>
                    <SelectItem value="categories">categories</SelectItem>
                    <SelectItem value="users">users</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Range */}
                <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full sm:w-40"
                    placeholder="Start date"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-40"
                    placeholder="End date"
                  />
                </div>
              </div>

              {/* Results Count */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Loading..."
                    : `Showing ${totalLogs} audit log entries`}
                </span>
                {(actionFilter !== "all" ||
                  tableFilter !== "all" ||
                  startDate ||
                  endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActionFilter("all");
                      setTableFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Loading State */}
            {isLoading && <LoadingSpinner message="Loading audit logs..." />}

            {/* Audit Logs List */}
            {!isLoading && !error && (
              <div className="space-y-4 mb-8">
                {auditLogs.map((log) => (
                  <Card key={log.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {log.action}
                          </Badge>
                          <span className="font-medium">{log.table_name}</span>
                          <span className="text-muted-foreground">
                            Record ID: {log.record_id}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                      {log.user_email && (
                        <p className="text-sm text-muted-foreground">
                          User: {log.user_email}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <details className="group">
                        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium mb-2 group-open:mb-4">
                          <Eye className="h-4 w-4" />
                          View Changes
                          <span className="text-muted-foreground ml-auto">
                            Click to expand
                          </span>
                        </summary>
                        <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                          {formatChanges(log.changes)}
                        </pre>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && auditLogs.length === 0 && (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <FileText className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No audit logs found
                  </h3>
                  <p className="mb-4">
                    {actionFilter !== "all" ||
                    tableFilter !== "all" ||
                    startDate ||
                    endDate
                      ? "Try adjusting your filter criteria"
                      : "No system activity has been recorded yet"}
                  </p>
                </div>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && !error && totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = i + 1;
                    if (totalPages <= 5) {
                      return page;
                    }
                    if (currentPage <= 3) return page;
                    if (currentPage >= totalPages - 2)
                      return totalPages - 4 + i;
                    return currentPage - 2 + i;
                  }).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </AdminOnly>
      </div>
    </AuthGuard>
  );
}
