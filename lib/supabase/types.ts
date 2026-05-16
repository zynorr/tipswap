export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type PublicSchema = Database["public"]

export type Tables<
  TableName extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof PublicSchema["Tables"],
> = PublicSchema["Tables"][TableName]["Update"]

export type Database = {
  public: {
    Tables: {
      waitlist: {
        Row: {
          id: string
          email: string
          telegram_handle: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          telegram_handle?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          telegram_handle?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tg_users: {
        Row: {
          id: string
          tg_id: number
          tg_username: string | null
          first_name: string | null
          default_recv_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tg_id: number
          tg_username?: string | null
          first_name?: string | null
          default_recv_token?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tg_id?: number
          tg_username?: string | null
          first_name?: string | null
          default_recv_token?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tg_wallets: {
        Row: {
          id: string
          user_id: string
          address: string
          public_key: string
          encrypted_mnemonic: string
          mode: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          address: string
          public_key: string
          encrypted_mnemonic: string
          mode?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          address?: string
          public_key?: string
          encrypted_mnemonic?: string
          mode?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tg_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tg_swaps: {
        Row: {
          id: string
          user_id: string
          offer_token: string
          ask_token: string
          offer_amount: string
          expected_out: string | null
          slippage_bps: number
          tx_hash: string | null
          status: string
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          offer_token: string
          ask_token: string
          offer_amount: string
          expected_out?: string | null
          slippage_bps?: number
          tx_hash?: string | null
          status?: string
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          offer_token?: string
          ask_token?: string
          offer_amount?: string
          expected_out?: string | null
          slippage_bps?: number
          tx_hash?: string | null
          status?: string
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_swaps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tg_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      touch_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
