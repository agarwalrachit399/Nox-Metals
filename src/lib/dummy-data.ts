// lib/dummy-data.ts

import { Product, ProductInsert } from "./database.types";

// Re-export types from database.types for backward compatibility
export type {
  Product,
  ProductInsert,
  ProductUpdate,
  Category,
  AuditLog,
} from "./database.types";

// Legacy type for backward compatibility (now uses is_deleted instead of isDeleted)
export interface LegacyProduct {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string | null;
  isDeleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Transform function to convert between Supabase format and legacy format
export function transformProductFromDB(dbProduct: Product): LegacyProduct {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    price: dbProduct.price,
    description: dbProduct.description,
    category: dbProduct.category,
    image: dbProduct.image,
    isDeleted: dbProduct.is_deleted,
    createdAt: dbProduct.created_at,
    updatedAt: dbProduct.updated_at,
  };
}

export function transformProductToDB(
  legacyProduct: Partial<LegacyProduct>,
): Partial<ProductInsert> {
  const { isDeleted, createdAt, updatedAt, ...rest } = legacyProduct;

  const dbProduct: Partial<ProductInsert> = {
    ...rest,
    ...(isDeleted !== undefined && { is_deleted: isDeleted }),
    ...(createdAt !== undefined && { created_at: createdAt }),
    ...(updatedAt !== undefined && { updated_at: updatedAt }),
  };

  return dbProduct;
}
