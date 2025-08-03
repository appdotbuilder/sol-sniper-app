
import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const transactionTypeEnum = pgEnum('transaction_type', ['buy', 'sell']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'failed']);
export const alertModeEnum = pgEnum('alert_mode', ['popup', 'silent']);

// Wallets table
export const walletsTable = pgTable('wallets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull().unique(),
  private_key: text('private_key').notNull(),
  sol_balance: numeric('sol_balance', { precision: 20, scale: 9 }).notNull().default('0'),
  is_active: boolean('is_active').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Tokens table
export const tokensTable = pgTable('tokens', {
  id: serial('id').primaryKey(),
  contract_address: text('contract_address').notNull().unique(),
  name: text('name'),
  symbol: text('symbol'),
  decimals: integer('decimals').notNull(),
  price_usd: numeric('price_usd', { precision: 20, scale: 8 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Token holdings table
export const tokenHoldingsTable = pgTable('token_holdings', {
  id: serial('id').primaryKey(),
  wallet_id: integer('wallet_id').notNull(),
  token_id: integer('token_id').notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 9 }).notNull(),
  purchase_price_sol: numeric('purchase_price_sol', { precision: 20, scale: 9 }).notNull(),
  purchase_price_usd: numeric('purchase_price_usd', { precision: 20, scale: 8 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  wallet_id: integer('wallet_id').notNull(),
  token_id: integer('token_id').notNull(),
  type: transactionTypeEnum('type').notNull(),
  amount_sol: numeric('amount_sol', { precision: 20, scale: 9 }).notNull(),
  token_quantity: numeric('token_quantity', { precision: 20, scale: 9 }).notNull(),
  price_per_token_sol: numeric('price_per_token_sol', { precision: 20, scale: 9 }).notNull(),
  take_profit_percentage: numeric('take_profit_percentage', { precision: 5, scale: 2 }),
  stop_loss_percentage: numeric('stop_loss_percentage', { precision: 5, scale: 2 }),
  transaction_hash: text('transaction_hash'),
  status: transactionStatusEnum('status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Limit orders table
export const limitOrdersTable = pgTable('limit_orders', {
  id: serial('id').primaryKey(),
  wallet_id: integer('wallet_id').notNull(),
  token_id: integer('token_id').notNull(),
  target_price_usd: numeric('target_price_usd', { precision: 20, scale: 8 }).notNull(),
  amount_sol: numeric('amount_sol', { precision: 20, scale: 9 }).notNull(),
  auto_execute: boolean('auto_execute').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  executed_at: timestamp('executed_at'),
});

// Settings table
export const settingsTable = pgTable('settings', {
  id: serial('id').primaryKey(),
  wallet_id: integer('wallet_id').notNull(),
  slippage_percentage: numeric('slippage_percentage', { precision: 5, scale: 2 }).notNull().default('0.5'),
  mev_protection: boolean('mev_protection').notNull().default(true),
  alert_mode: alertModeEnum('alert_mode').notNull().default('popup'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const walletsRelations = relations(walletsTable, ({ many, one }) => ({
  tokenHoldings: many(tokenHoldingsTable),
  transactions: many(transactionsTable),
  limitOrders: many(limitOrdersTable),
  settings: one(settingsTable),
}));

export const tokensRelations = relations(tokensTable, ({ many }) => ({
  holdings: many(tokenHoldingsTable),
  transactions: many(transactionsTable),
  limitOrders: many(limitOrdersTable),
}));

export const tokenHoldingsRelations = relations(tokenHoldingsTable, ({ one }) => ({
  wallet: one(walletsTable, {
    fields: [tokenHoldingsTable.wallet_id],
    references: [walletsTable.id],
  }),
  token: one(tokensTable, {
    fields: [tokenHoldingsTable.token_id],
    references: [tokensTable.id],
  }),
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  wallet: one(walletsTable, {
    fields: [transactionsTable.wallet_id],
    references: [walletsTable.id],
  }),
  token: one(tokensTable, {
    fields: [transactionsTable.token_id],
    references: [tokensTable.id],
  }),
}));

export const limitOrdersRelations = relations(limitOrdersTable, ({ one }) => ({
  wallet: one(walletsTable, {
    fields: [limitOrdersTable.wallet_id],
    references: [walletsTable.id],
  }),
  token: one(tokensTable, {
    fields: [limitOrdersTable.token_id],
    references: [tokensTable.id],
  }),
}));

export const settingsRelations = relations(settingsTable, ({ one }) => ({
  wallet: one(walletsTable, {
    fields: [settingsTable.wallet_id],
    references: [walletsTable.id],
  }),
}));

// Export all tables for relation queries
export const tables = {
  wallets: walletsTable,
  tokens: tokensTable,
  tokenHoldings: tokenHoldingsTable,
  transactions: transactionsTable,
  limitOrders: limitOrdersTable,
  settings: settingsTable,
};
