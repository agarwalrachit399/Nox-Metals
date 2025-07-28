"use client";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormErrorAlert } from "@/components/ui/error-alert";
import { Category, Product } from "@/lib/database.types";
import {
  useFormValidation,
  validationRules,
  combineValidators,
} from "@/hooks/use-form-validation";

interface ProductFormProps {
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "create" | "edit";
}

interface FormData {
  name: string;
  price: string;
  description: string;
  category: string;
  image: string;
  [key: string]: string;
}

export default function ProductForm({
  product,
  isOpen,
  onClose,
  onSuccess,
  mode,
}: ProductFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    price: "",
    description: "",
    category: "",
    image: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");

  const { errors, validate, clearError, clearAllErrors } =
    useFormValidation<FormData>({
      name: combineValidators(
        validationRules.required("Product name"),
        validationRules.minLength(2, "Product name"),
      ),
      price: combineValidators(
        validationRules.required("Price"),
        validationRules.positiveNumber("Price"),
      ),
      description: combineValidators(
        validationRules.required("Description"),
        validationRules.minLength(10, "Description"),
      ),
      category: validationRules.required("Category"),
      image: validationRules.url,
    });

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const categoriesData = await response.json();
          setCategories(categoriesData.map((cat: Category) => cat.name));
        } else {
          console.error("Failed to fetch categories");
          // Fallback to default categories
          setCategories([
            "Electronics",
            "Clothing",
            "Health",
            "Furniture",
            "Home",
            "Accessories",
          ]);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        // Fallback to default categories
        setCategories([
          "Electronics",
          "Clothing",
          "Health",
          "Furniture",
          "Home",
          "Accessories",
        ]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Reset form when dialog opens/closes or product changes
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && product) {
        setFormData({
          name: product.name,
          price: product.price.toString(),
          description: product.description,
          category: product.category,
          image: product.image || "",
        });
      } else {
        setFormData({
          name: "",
          price: "",
          description: "",
          category: "",
          image: "",
        });
      }
      clearAllErrors();
      setSubmitError("");
    }
  }, [isOpen, product, mode, clearAllErrors]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError(field);
    if (submitError) setSubmitError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate(formData)) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const url =
        mode === "create" ? "/api/products" : `/api/products/${product?.id}`;

      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          price: parseFloat(formData.price),
          description: formData.description.trim(),
          category: formData.category,
          image: formData.image.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${mode} product`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(
        `Error ${mode === "create" ? "creating" : "updating"} product:`,
        error,
      );
      setSubmitError(
        error instanceof Error ? error.message : `Failed to ${mode} product`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add New Product" : "Edit Product"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Fill in the details below to add a new product to your catalog."
              : "Update the product information below."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter product name"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price ($) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => handleInputChange("price", e.target.value)}
              placeholder="0.00"
              className={errors.price ? "border-destructive" : ""}
            />
            {errors.price && (
              <p className="text-sm text-destructive">{errors.price}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => handleInputChange("category", value)}
              disabled={isLoadingCategories}
            >
              <SelectTrigger
                className={errors.category ? "border-destructive" : ""}
              >
                <SelectValue
                  placeholder={
                    isLoadingCategories
                      ? "Loading categories..."
                      : "Select a category"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter product description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="image">Image URL (Optional)</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="image"
                  type="url"
                  value={formData.image}
                  onChange={(e) => handleInputChange("image", e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className={errors.image ? "border-destructive" : ""}
                />
              </div>
              {formData.image && !errors.image && (
                <div className="w-12 h-12 border rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  <Image
                    src={formData.image}
                    alt="Preview"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove(
                        "hidden",
                      );
                    }}
                  />
                  <ImageIcon className="h-4 w-4 text-muted-foreground hidden" />
                </div>
              )}
            </div>
            {errors.image && (
              <p className="text-sm text-destructive">{errors.image}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty to use a default image
            </p>
          </div>

          {/* Submit Error */}
          {submitError && <FormErrorAlert error={submitError} />}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSubmitting
                ? mode === "create"
                  ? "Creating..."
                  : "Updating..."
                : mode === "create"
                  ? "Create Product"
                  : "Update Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
