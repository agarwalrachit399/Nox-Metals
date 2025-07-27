"use client";
import Image from "next/image";
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Search,
  SortAsc,
  SortDesc,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Eye,
  Shield,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Category,
  type LegacyProduct,
  transformProductFromDB,
} from "@/lib/dummy-data";
import ProductForm from "@/components/product-form";
import AuthGuard from "@/components/auth-guard";
import Navbar from "@/components/navbar";
import { useAuth } from "@/components/auth-provider";
import { Product as DBProduct } from "@/lib/database.types";

type Product = LegacyProduct;
type SortOption =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "createdAt-desc";

interface ApiResponse {
  products: DBProduct[]; // Raw database format
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function HomePage() {
  // State for products and API
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user role for access control
  const { isAdmin, role, loading: authLoading } = useAuth();

  // State for search/filter/sort
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // State for CRUD operations
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchingProducts = useRef(false);
  const fetchingCategories = useRef(false);
  const initialFetchDone = useRef(false);

  const itemsPerPage = 6;

  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (fetchingCategories.current || authLoading || !role) {
      return;
    }

    try {
      fetchingCategories.current = true;

      const response = await fetch("/api/categories");

      if (response.ok) {
        const categoriesData = await response.json();
        setCategories([
          "all",
          ...categoriesData.map((cat: Category) => cat.name),
        ]);
      } else if (response.status === 401 || response.status === 403) {
        setCategories([
          "all",
          "Electronics",
          "Clothing",
          "Health",
          "Furniture",
          "Home",
          "Accessories",
        ]);
      } else {
        console.error("❌ Failed to fetch categories");
        setCategories([
          "all",
          "Electronics",
          "Clothing",
          "Health",
          "Furniture",
          "Home",
          "Accessories",
        ]);
      }
    } catch (error) {
      console.error("❌ Error fetching categories:", error);
      setCategories([
        "all",
        "Electronics",
        "Clothing",
        "Health",
        "Furniture",
        "Home",
        "Accessories",
      ]);
    } finally {
      fetchingCategories.current = false;
    }
  }, [authLoading, role]);

  // Get categories for filter
  const filterCategories = useMemo(() => {
    return categories;
  }, [categories]);

  // Fetch products from API
  const fetchProducts = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (fetchingProducts.current || authLoading || !role) {
      return;
    }

    try {
      fetchingProducts.current = true;
      setIsLoading(true);
      setError(null);

      const searchParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        includeDeleted: showDeleted.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterCategory !== "all" && { category: filterCategory }),
        ...(sortBy && { sortBy }),
      });

      const response = await fetch(`/api/products?${searchParams}`);

      if (!response.ok) {
        if (response.status === 401) {
          return;
        } else if (response.status === 403) {
          setError(
            "Access denied. You do not have permission to view products.",
          );
        } else {
          throw new Error("Failed to fetch products");
        }
        return;
      }

      const data: ApiResponse = await response.json();

      const transformedProducts = data.products.map(transformProductFromDB);
      setProducts(transformedProducts);
      setTotalPages(data.pagination.totalPages);
      setTotalProducts(data.pagination.total);
    } catch (error) {
      console.error("❌ Error fetching products:", error);
      if (role) {
        setError("Failed to load products. Please try again.");
      }
    } finally {
      setIsLoading(false);
      fetchingProducts.current = false;
    }
  }, [
    authLoading,
    role,
    currentPage,
    showDeleted,
    searchTerm,
    filterCategory,
    sortBy,
    itemsPerPage,
  ]);

  useEffect(() => {
    if (authLoading || !role || initialFetchDone.current) {
      return;
    }

    initialFetchDone.current = true;

    fetchCategories();
    fetchProducts();
  }, [authLoading, role, fetchCategories, fetchProducts]);

  // Separate effect for filter/pagination changes
  useEffect(() => {
    if (!initialFetchDone.current || authLoading || !role) {
      return;
    }
    fetchProducts();
  }, [
    currentPage,
    searchTerm,
    filterCategory,
    sortBy,
    showDeleted,
    authLoading,
    fetchProducts,
    role,
  ]);

  // Reset to first page when filters change (keep existing)
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, sortBy, filterCategory, showDeleted, currentPage]);

  // Handle pagination
  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  // Handle product creation (Admin only)
  const handleCreateProduct = () => {
    if (!isAdmin) {
      setError("Only administrators can create products.");
      return;
    }
    setFormMode("create");
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  // Handle product editing (Admin only)
  const handleEditProduct = (product: Product) => {
    if (!isAdmin) {
      setError("Only administrators can edit products.");
      return;
    }
    setFormMode("edit");
    setSelectedProduct(product);
    setIsFormOpen(true);
  };

  // Handle product deletion (Admin only)
  const handleDeleteProduct = (product: Product) => {
    if (!isAdmin) {
      setError("Only administrators can delete products.");
      return;
    }
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete || !isAdmin) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError("Authentication required. Please log in again.");
        } else if (response.status === 403) {
          setError("Access denied. Only administrators can delete products.");
        } else {
          throw new Error("Failed to delete product");
        }
        return;
      }

      // Refresh products list
      await fetchProducts();
      setProductToDelete(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      setError("Failed to delete product. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle form success
  const handleFormSuccess = () => {
    fetchProducts(); // Refresh the products list
  };

  if (error) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="container mx-auto px-4 py-8">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                {error}
                <Button variant="outline" size="sm" onClick={fetchProducts}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold">Product Catalog</h1>
                {role && (
                  <Badge
                    variant={isAdmin ? "default" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    {isAdmin ? (
                      <Shield className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    {isAdmin ? "Full Access" : "View Only"}
                  </Badge>
                )}
              </div>
              {isAdmin && (
                <Button
                  onClick={handleCreateProduct}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              )}
            </div>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Manage your product catalog with full administrative access"
                : "Browse our product catalog"}
            </p>
          </div>

          {/* Search and Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Sort */}
              <Select
                value={sortBy}
                onValueChange={(value: SortOption) => setSortBy(value)}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">
                    <div className="flex items-center gap-2">
                      <SortAsc className="h-4 w-4" />
                      Name A-Z
                    </div>
                  </SelectItem>
                  <SelectItem value="name-desc">
                    <div className="flex items-center gap-2">
                      <SortDesc className="h-4 w-4" />
                      Name Z-A
                    </div>
                  </SelectItem>
                  <SelectItem value="price-asc">
                    <div className="flex items-center gap-2">
                      <SortAsc className="h-4 w-4" />
                      Price Low-High
                    </div>
                  </SelectItem>
                  <SelectItem value="price-desc">
                    <div className="flex items-center gap-2">
                      <SortDesc className="h-4 w-4" />
                      Price High-Low
                    </div>
                  </SelectItem>
                  <SelectItem value="createdAt-desc">
                    <div className="flex items-center gap-2">
                      <SortDesc className="h-4 w-4" />
                      Newest First
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {filterCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        {category === "all" ? "All Categories" : category}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show Deleted Toggle and Results Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button
                    variant={showDeleted ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowDeleted(!showDeleted)}
                  >
                    {showDeleted
                      ? "Show Active Products"
                      : "Show Deleted Products"}
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Loading..."
                    : `Showing ${totalProducts} products`}
                </span>
              </div>

              {!isLoading && (
                <Button variant="ghost" size="sm" onClick={fetchProducts}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2 text-muted-foreground">
                Loading products...
              </span>
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {products.map((product) => (
                <Card key={product.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="aspect-video w-full bg-muted rounded-md mb-3 overflow-hidden">
                      <Image
                        src={product.image ?? ""}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        width={300}
                        height={200}
                      />
                    </div>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg line-clamp-2">
                        {product.name}
                      </CardTitle>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {product.category}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {product.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.isDeleted && (
                        <Badge variant="destructive">Deleted</Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 mt-auto">
                    <div className="flex gap-2 w-full">
                      {!product.isDeleted ? (
                        <>
                          {isAdmin ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditProduct(product)}
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProduct(product)}
                                className="flex items-center gap-1 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                              <Button className="flex-1">Add to Cart</Button>
                            </>
                          ) : (
                            <Button className="w-full">View Details</Button>
                          )}
                        </>
                      ) : (
                        <Button variant="secondary" className="w-full" disabled>
                          Unavailable
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && products.length === 0 && (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <Search className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No products found
                </h3>
                <p className="mb-4">
                  {searchTerm || filterCategory !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Get started by adding your first product"}
                </p>
                {!searchTerm && filterCategory === "all" && isAdmin && (
                  <Button
                    onClick={handleCreateProduct}
                    className="flex items-center gap-2 mx-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Add Your First Product
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
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
                  // Show first, last, current, and adjacent pages
                  if (currentPage <= 3) return page;
                  if (currentPage >= totalPages - 2) return totalPages - 4 + i;
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

          {/* Product Form Dialog (Admin only) */}
          {isAdmin && (
            <ProductForm
              product={selectedProduct}
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onSuccess={handleFormSuccess}
              mode={formMode}
            />
          )}

          {/* Delete Confirmation Dialog (Admin only) */}
          {isAdmin && (
            <AlertDialog
              open={!!productToDelete}
              onOpenChange={() => setProductToDelete(null)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;
                    {productToDelete?.name}&quot;? This action will soft delete
                    the product and it can be restored later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isDeleting ? "Deleting..." : "Delete Product"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
