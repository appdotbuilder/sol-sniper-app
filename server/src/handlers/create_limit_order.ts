
import { db } from '../db';
import { limitOrdersTable, tokensTable } from '../db/schema';
import { type CreateLimitOrderInput, type LimitOrder } from '../schema';
import { eq } from 'drizzle-orm';

export async function createLimitOrder(input: CreateLimitOrderInput): Promise<LimitOrder> {
  try {
    // First, check if token exists or create it
    let token = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.contract_address, input.contract_address))
      .execute();

    let tokenId: number;
    
    if (token.length === 0) {
      // Create token with minimal data
      const newToken = await db.insert(tokensTable)
        .values({
          contract_address: input.contract_address,
          name: null,
          symbol: null,
          decimals: 9, // Default for Solana tokens
          price_usd: null
        })
        .returning()
        .execute();
      
      tokenId = newToken[0].id;
    } else {
      tokenId = token[0].id;
    }

    // Create limit order
    const result = await db.insert(limitOrdersTable)
      .values({
        wallet_id: input.wallet_id,
        token_id: tokenId,
        target_price_usd: input.target_price_usd.toString(),
        amount_sol: input.amount_sol.toString(),
        auto_execute: input.auto_execute,
        is_active: true
      })
      .returning()
      .execute();

    const limitOrder = result[0];
    
    return {
      ...limitOrder,
      target_price_usd: parseFloat(limitOrder.target_price_usd),
      amount_sol: parseFloat(limitOrder.amount_sol)
    };
  } catch (error) {
    console.error('Limit order creation failed:', error);
    throw error;
  }
}
