
import { db } from '../db';
import { walletsTable, tokensTable, tokenHoldingsTable, transactionsTable } from '../db/schema';
import { type BuyTokenInput, type Transaction } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function buyToken(input: BuyTokenInput): Promise<Transaction> {
  try {
    // Validate wallet exists and has sufficient SOL balance
    const wallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, input.wallet_id))
      .execute();

    if (wallet.length === 0) {
      throw new Error('Wallet not found');
    }

    const walletBalance = parseFloat(wallet[0].sol_balance);
    if (walletBalance < input.amount_sol) {
      throw new Error('Insufficient SOL balance');
    }

    // Find or create token
    let token = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.contract_address, input.contract_address))
      .execute();

    let tokenId: number;
    if (token.length === 0) {
      // Create new token record
      const newToken = await db.insert(tokensTable)
        .values({
          contract_address: input.contract_address,
          name: null,
          symbol: null,
          decimals: 9, // Default Solana token decimals
          price_usd: null
        })
        .returning()
        .execute();
      tokenId = newToken[0].id;
    } else {
      tokenId = token[0].id;
    }

    // For demo purposes, simulate token purchase
    // In real implementation, this would interact with Solana DEX
    const mockTokenQuantity = input.amount_sol * 1000; // Mock exchange rate
    const pricePerTokenSol = input.amount_sol / mockTokenQuantity;

    // Create transaction record
    const transaction = await db.insert(transactionsTable)
      .values({
        wallet_id: input.wallet_id,
        token_id: tokenId,
        type: 'buy',
        amount_sol: input.amount_sol.toString(),
        token_quantity: mockTokenQuantity.toString(),
        price_per_token_sol: pricePerTokenSol.toString(),
        take_profit_percentage: input.take_profit_percentage?.toString() || null,
        stop_loss_percentage: input.stop_loss_percentage?.toString() || null,
        transaction_hash: null,
        status: 'completed'
      })
      .returning()
      .execute();

    // Update or create token holding
    const existingHolding = await db.select()
      .from(tokenHoldingsTable)
      .where(and(
        eq(tokenHoldingsTable.wallet_id, input.wallet_id),
        eq(tokenHoldingsTable.token_id, tokenId)
      ))
      .execute();

    if (existingHolding.length > 0) {
      // Update existing holding
      const currentQuantity = parseFloat(existingHolding[0].quantity);
      const currentPurchasePrice = parseFloat(existingHolding[0].purchase_price_sol);
      
      // Calculate weighted average purchase price
      const totalCurrentValue = currentQuantity * currentPurchasePrice;
      const newPurchaseValue = mockTokenQuantity * pricePerTokenSol;
      const totalQuantity = currentQuantity + mockTokenQuantity;
      const avgPurchasePrice = (totalCurrentValue + newPurchaseValue) / totalQuantity;

      await db.update(tokenHoldingsTable)
        .set({
          quantity: totalQuantity.toString(),
          purchase_price_sol: avgPurchasePrice.toString(),
          updated_at: new Date()
        })
        .where(eq(tokenHoldingsTable.id, existingHolding[0].id))
        .execute();
    } else {
      // Create new holding
      await db.insert(tokenHoldingsTable)
        .values({
          wallet_id: input.wallet_id,
          token_id: tokenId,
          quantity: mockTokenQuantity.toString(),
          purchase_price_sol: pricePerTokenSol.toString(),
          purchase_price_usd: null
        })
        .execute();
    }

    // Update wallet SOL balance
    const newBalance = walletBalance - input.amount_sol;
    await db.update(walletsTable)
      .set({
        sol_balance: newBalance.toString()
      })
      .where(eq(walletsTable.id, input.wallet_id))
      .execute();

    // Convert numeric fields back to numbers
    const result = transaction[0];
    return {
      ...result,
      amount_sol: parseFloat(result.amount_sol),
      token_quantity: parseFloat(result.token_quantity),
      price_per_token_sol: parseFloat(result.price_per_token_sol),
      take_profit_percentage: result.take_profit_percentage ? parseFloat(result.take_profit_percentage) : null,
      stop_loss_percentage: result.stop_loss_percentage ? parseFloat(result.stop_loss_percentage) : null
    };
  } catch (error) {
    console.error('Token purchase failed:', error);
    throw error;
  }
}
