
import { z } from 'zod';

// Wallet schema
export const walletSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  private_key: z.string(),
  sol_balance: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date()
});

export type Wallet = z.infer<typeof walletSchema>;

// Token schema
export const tokenSchema = z.object({
  id: z.number(),
  contract_address: z.string(),
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  decimals: z.number().int(),
  price_usd: z.number().nullable(),
  created_at: z.coerce.date()
});

export type Token = z.infer<typeof tokenSchema>;

// Token holding schema
export const tokenHoldingSchema = z.object({
  id: z.number(),
  wallet_id: z.number(),
  token_id: z.number(),
  quantity: z.number(),
  purchase_price_sol: z.number(),
  purchase_price_usd: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type TokenHolding = z.infer<typeof tokenHoldingSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  wallet_id: z.number(),
  token_id: z.number(),
  type: z.enum(['buy', 'sell']),
  amount_sol: z.number(),
  token_quantity: z.number(),
  price_per_token_sol: z.number(),
  take_profit_percentage: z.number().nullable(),
  stop_loss_percentage: z.number().nullable(),
  transaction_hash: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'failed']),
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Limit order schema
export const limitOrderSchema = z.object({
  id: z.number(),
  wallet_id: z.number(),
  token_id: z.number(),
  target_price_usd: z.number(),
  amount_sol: z.number(),
  auto_execute: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  executed_at: z.coerce.date().nullable()
});

export type LimitOrder = z.infer<typeof limitOrderSchema>;

// Settings schema
export const settingsSchema = z.object({
  id: z.number(),
  wallet_id: z.number(),
  slippage_percentage: z.number(),
  mev_protection: z.boolean(),
  alert_mode: z.enum(['popup', 'silent']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Settings = z.infer<typeof settingsSchema>;

// Input schemas for creating/updating entities

// Wallet input schemas
export const createWalletInputSchema = z.object({
  name: z.string(),
  address: z.string(),
  private_key: z.string()
});

export type CreateWalletInput = z.infer<typeof createWalletInputSchema>;

export const importWalletInputSchema = z.object({
  name: z.string(),
  private_key: z.string()
});

export type ImportWalletInput = z.infer<typeof importWalletInputSchema>;

// Token input schemas
export const tokenDataInputSchema = z.object({
  contract_address: z.string()
});

export type TokenDataInput = z.infer<typeof tokenDataInputSchema>;

// Buy token input schema
export const buyTokenInputSchema = z.object({
  wallet_id: z.number(),
  contract_address: z.string(),
  amount_sol: z.number().positive(),
  take_profit_percentage: z.number().nullable(),
  stop_loss_percentage: z.number().nullable()
});

export type BuyTokenInput = z.infer<typeof buyTokenInputSchema>;

// Sell token input schema
export const sellTokenInputSchema = z.object({
  wallet_id: z.number(),
  token_holding_id: z.number(),
  quantity: z.number().positive()
});

export type SellTokenInput = z.infer<typeof sellTokenInputSchema>;

// Limit order input schema
export const createLimitOrderInputSchema = z.object({
  wallet_id: z.number(),
  contract_address: z.string(),
  target_price_usd: z.number().positive(),
  amount_sol: z.number().positive(),
  auto_execute: z.boolean()
});

export type CreateLimitOrderInput = z.infer<typeof createLimitOrderInputSchema>;

// Settings input schema
export const updateSettingsInputSchema = z.object({
  wallet_id: z.number(),
  slippage_percentage: z.number().min(0).max(100).optional(),
  mev_protection: z.boolean().optional(),
  alert_mode: z.enum(['popup', 'silent']).optional()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

// Dashboard data schema
export const dashboardDataSchema = z.object({
  active_wallet: walletSchema.nullable(),
  total_holdings_usd: z.number(),
  token_holdings: z.array(tokenHoldingSchema.extend({
    token: tokenSchema,
    current_value_usd: z.number(),
    pnl_percentage: z.number()
  }))
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;
