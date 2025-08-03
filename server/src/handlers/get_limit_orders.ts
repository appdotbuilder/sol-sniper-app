
import { db } from '../db';
import { limitOrdersTable, tokensTable } from '../db/schema';
import { type LimitOrder, type Token } from '../schema';
import { eq } from 'drizzle-orm';

export async function getLimitOrders(walletId: number): Promise<Array<LimitOrder & { token: Token }>> {
  try {
    // Query limit orders with token data using join
    const results = await db.select()
      .from(limitOrdersTable)
      .innerJoin(tokensTable, eq(limitOrdersTable.token_id, tokensTable.id))
      .where(eq(limitOrdersTable.wallet_id, walletId))
      .execute();

    // Transform joined results and handle numeric conversions
    return results.map(result => ({
      // Limit order data with numeric conversions
      id: result.limit_orders.id,
      wallet_id: result.limit_orders.wallet_id,
      token_id: result.limit_orders.token_id,
      target_price_usd: parseFloat(result.limit_orders.target_price_usd),
      amount_sol: parseFloat(result.limit_orders.amount_sol),
      auto_execute: result.limit_orders.auto_execute,
      is_active: result.limit_orders.is_active,
      created_at: result.limit_orders.created_at,
      executed_at: result.limit_orders.executed_at,
      // Token data with numeric conversions
      token: {
        id: result.tokens.id,
        contract_address: result.tokens.contract_address,
        name: result.tokens.name,
        symbol: result.tokens.symbol,
        decimals: result.tokens.decimals,
        price_usd: result.tokens.price_usd ? parseFloat(result.tokens.price_usd) : null,
        created_at: result.tokens.created_at
      }
    }));
  } catch (error) {
    console.error('Get limit orders failed:', error);
    throw error;
  }
}
