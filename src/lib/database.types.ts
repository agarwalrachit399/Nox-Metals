// lib/database.types.ts
export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: number
          name: string
          price: number
          description: string
          category: string
          image: string | null
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          price: number
          description: string
          category: string
          image?: string | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          price?: number
          description?: string
          category?: string
          image?: string | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: number
          action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
          table_name: string
          record_id: number
          user_email: string | null
          changes: any | null
          timestamp: string
        }
        Insert: {
          id?: number
          action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
          table_name: string
          record_id: number
          user_email?: string | null
          changes?: any | null
          timestamp?: string
        }
        Update: {
          id?: number
          action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
          table_name?: string
          record_id?: number
          user_email?: string | null
          changes?: any | null
          timestamp?: string
        }
      }
      categories: {
        Row: {
          id: number
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']

export type Category = Database['public']['Tables']['categories']['Row']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']