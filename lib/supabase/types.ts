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
          reaction_tip_amount: string
          reaction_recv_token: string
          reaction_pay_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tg_id: number
          tg_username?: string | null
          first_name?: string | null
          default_recv_token?: string
          reaction_tip_amount?: string
          reaction_recv_token?: string
          reaction_pay_token?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tg_id?: number
          tg_username?: string | null
          first_name?: string | null
          default_recv_token?: string
          reaction_tip_amount?: string
          reaction_recv_token?: string
          reaction_pay_token?: string
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
          public_key: string | null
          encrypted_mnemonic: string | null
          mode: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          address: string
          public_key?: string | null
          encrypted_mnemonic?: string | null
          mode?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          address?: string
          public_key?: string | null
          encrypted_mnemonic?: string | null
          mode?: string
          is_active?: boolean
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
      tg_tips: {
        Row: {
          id: string
          batch_id: string | null
          sender_user_id: string
          recipient_user_id: string
          source: string
          source_chat_id: number | null
          source_message_id: number | null
          sender_wallet_id: string | null
          recipient_wallet_id: string | null
          recipient_address: string
          offer_token: string
          ask_token: string
          ask_amount: string
          ask_raw: string
          quoted_offer_amount: string | null
          offer_raw: string | null
          expected_out: string | null
          min_ask_amount: string | null
          slippage_bps: number
          status: string
          tx_hash: string | null
          error: string | null
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          batch_id?: string | null
          sender_user_id: string
          recipient_user_id: string
          source?: string
          source_chat_id?: number | null
          source_message_id?: number | null
          sender_wallet_id?: string | null
          recipient_wallet_id?: string | null
          recipient_address: string
          offer_token: string
          ask_token: string
          ask_amount: string
          ask_raw: string
          quoted_offer_amount?: string | null
          offer_raw?: string | null
          expected_out?: string | null
          min_ask_amount?: string | null
          slippage_bps?: number
          status?: string
          tx_hash?: string | null
          error?: string | null
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          batch_id?: string | null
          sender_user_id?: string
          recipient_user_id?: string
          source?: string
          source_chat_id?: number | null
          source_message_id?: number | null
          sender_wallet_id?: string | null
          recipient_wallet_id?: string | null
          recipient_address?: string
          offer_token?: string
          ask_token?: string
          ask_amount?: string
          ask_raw?: string
          quoted_offer_amount?: string | null
          offer_raw?: string | null
          expected_out?: string | null
          min_ask_amount?: string | null
          slippage_bps?: number
          status?: string
          tx_hash?: string | null
          error?: string | null
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_tips_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "tg_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tg_tips_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "tg_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tg_tips_sender_wallet_id_fkey"
            columns: ["sender_wallet_id"]
            isOneToOne: false
            referencedRelation: "tg_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tg_tips_recipient_wallet_id_fkey"
            columns: ["recipient_wallet_id"]
            isOneToOne: false
            referencedRelation: "tg_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tg_tips_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "tg_tip_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      tg_tip_batches: {
        Row: {
          id: string
          sender_user_id: string
          source: string
          offer_token: string
          ask_token: string
          ask_amount: string
          recipient_count: number
          quoted_total_offer_amount: string | null
          status: string
          error: string | null
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_user_id: string
          source?: string
          offer_token: string
          ask_token: string
          ask_amount: string
          recipient_count?: number
          quoted_total_offer_amount?: string | null
          status?: string
          error?: string | null
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_user_id?: string
          source?: string
          offer_token?: string
          ask_token?: string
          ask_amount?: string
          recipient_count?: number
          quoted_total_offer_amount?: string | null
          status?: string
          error?: string | null
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_tip_batches_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "tg_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tg_group_messages: {
        Row: {
          id: string
          chat_id: number
          message_id: number
          author_user_id: string
          author_tg_id: number
          author_username: string | null
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: number
          message_id: number
          author_user_id: string
          author_tg_id: number
          author_username?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: number
          message_id?: number
          author_user_id?: string
          author_tg_id?: number
          author_username?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_group_messages_author_user_id_fkey"
            columns: ["author_user_id"]
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
