// lib/dummy-data.ts

// Re-export types from database.types for backward compatibility
export type { Product, ProductInsert, ProductUpdate, Category, AuditLog } from './database.types'

// Legacy type for backward compatibility (now uses is_deleted instead of isDeleted)
export interface LegacyProduct {
  id: number
  name: string
  price: number
  description: string
  category: string
  image: string | null
  isDeleted: boolean
  createdAt?: string
  updatedAt?: string
}

// Transform function to convert between Supabase format and legacy format
export function transformProductFromDB(dbProduct: any): LegacyProduct {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    price: dbProduct.price,
    description: dbProduct.description,
    category: dbProduct.category,
    image: dbProduct.image,
    isDeleted: dbProduct.is_deleted,
    createdAt: dbProduct.created_at,
    updatedAt: dbProduct.updated_at
  }
}

export function transformProductToDB(legacyProduct: Partial<LegacyProduct>): any {
  const dbProduct: any = { ...legacyProduct }
  
  if ('isDeleted' in dbProduct) {
    dbProduct.is_deleted = dbProduct.isDeleted
    delete dbProduct.isDeleted
  }
  
  if ('createdAt' in dbProduct) {
    dbProduct.created_at = dbProduct.createdAt
    delete dbProduct.createdAt
  }
  
  if ('updatedAt' in dbProduct) {
    dbProduct.updated_at = dbProduct.updatedAt
    delete dbProduct.updatedAt
  }
  
  return dbProduct
}