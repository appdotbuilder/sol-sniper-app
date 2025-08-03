
import { db } from '../db';
import { tokenHoldingsTable, tokensTable } from '../db/schema';
import { type TokenHolding, type Token } from '../schema';
import { eq } from 'drizzle-orm';

export async function getTokenHoldings(walletId: number): Promise<Array<TokenHolding & { token: Token; current_value_usd: number; pnl_percentage: number }>> {
  try {
    // Query token holdings with token data joined
    const results = await db.select()
      .from(tokenHoldingsTable)
      .innerJoin(tokensTable, eq(tokenHoldingsTable.token_id, tokensTable.id))
      .where(eq(tokenHoldingsTable.wallet_id, walletId))
      .execute();

    // Transform and enrich the results
    return results.map(result => {
      const holding = result.token_holdings;
      const token = result.tokens;

      // Convert numeric fields
      const quantity = parseFloat(holding.quantity);
      const purchasePriceSol = parseFloat(holding.purchase_price_sol);
      const purchasePriceUsd = holding.purchase_price_usd ? parseFloat(holding.purchase_price_usd) : null;
      const currentTokenPriceUsd = token.price_usd ? parseFloat(token.price_usd) : null;

      // Calculate current value in USD
      let currentValueUsd = 0;
      if (currentTokenPriceUsd !== null) {
        currentValueUsd = quantity * currentTokenPriceUsd;
      }

      // Calculate PnL percentage
      let pnlPercentage = 0;
      if (purchasePriceUsd !== null && purchasePriceUsd > 0 && currentValueUsd > 0) {
        pnlPercentage = ((currentValueUsd - purchasePriceUsd) / purchasePriceUsd) * 100;
      }

      return {
        id: holding.id,
        wallet_id: holding.wallet_id,
        token_id: holding.token_id,
        quantity,
        purchase_price_sol: purchasePriceSol,
        purchase_price_usd: purchasePriceUsd,
        created_at: holding.created_at,
        updated_at: holding.updated_at,
        token: {
          id: token.id,
          contract_address: token.contract_address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          price_usd: currentTokenPriceUsd,
          created_at: token.created_at
        },
        current_value_usd: currentValueUsd,
        pnl_percentage: pnlPercentage
      };
    });
  } catch (error) {
    console.error('Failed to get token holdings:', error);
    throw error;
  }
}
