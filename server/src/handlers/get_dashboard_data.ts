
import { db } from '../db';
import { walletsTable, tokensTable, tokenHoldingsTable } from '../db/schema';
import { type DashboardData } from '../schema';
import { eq } from 'drizzle-orm';

export async function getDashboardData(): Promise<DashboardData> {
  try {
    // Get the active wallet
    const activeWallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.is_active, true))
      .execute();

    const activeWallet = activeWallets.length > 0 ? activeWallets[0] : null;

    // If no active wallet, return empty dashboard
    if (!activeWallet) {
      return {
        active_wallet: null,
        total_holdings_usd: 0,
        token_holdings: []
      };
    }

    // Get token holdings with token data for the active wallet
    const holdingsWithTokens = await db.select()
      .from(tokenHoldingsTable)
      .innerJoin(tokensTable, eq(tokenHoldingsTable.token_id, tokensTable.id))
      .where(eq(tokenHoldingsTable.wallet_id, activeWallet.id))
      .execute();

    // Calculate total holdings USD value and format holdings
    let totalHoldingsUsd = 0;
    const tokenHoldings = holdingsWithTokens.map(result => {
      const holding = result.token_holdings;
      const token = result.tokens;

      // Convert numeric fields
      const quantity = parseFloat(holding.quantity);
      const purchasePriceSol = parseFloat(holding.purchase_price_sol);
      const purchasePriceUsd = holding.purchase_price_usd ? parseFloat(holding.purchase_price_usd) : null;
      const currentTokenPriceUsd = token.price_usd ? parseFloat(token.price_usd) : null;

      // Calculate current value in USD
      let currentValueUsd = 0;
      if (currentTokenPriceUsd) {
        currentValueUsd = quantity * currentTokenPriceUsd;
        totalHoldingsUsd += currentValueUsd;
      }

      // Calculate PnL percentage
      let pnlPercentage = 0;
      if (purchasePriceUsd && purchasePriceUsd > 0 && currentValueUsd > 0) {
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

    return {
      active_wallet: {
        id: activeWallet.id,
        name: activeWallet.name,
        address: activeWallet.address,
        private_key: activeWallet.private_key,
        sol_balance: parseFloat(activeWallet.sol_balance),
        is_active: activeWallet.is_active,
        created_at: activeWallet.created_at
      },
      total_holdings_usd: totalHoldingsUsd,
      token_holdings: tokenHoldings
    };
  } catch (error) {
    console.error('Failed to get dashboard data:', error);
    throw error;
  }
}
