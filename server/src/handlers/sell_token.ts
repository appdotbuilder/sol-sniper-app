
import { db } from '../db';
import { tokenHoldingsTable, transactionsTable, tokensTable } from '../db/schema';
import { type SellTokenInput, type Transaction } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function sellToken(input: SellTokenInput): Promise<Transaction> {
  try {
    // First, get the token holding to validate it exists and has sufficient quantity
    const holdingResult = await db.select()
      .from(tokenHoldingsTable)
      .innerJoin(tokensTable, eq(tokenHoldingsTable.token_id, tokensTable.id))
      .where(
        and(
          eq(tokenHoldingsTable.id, input.token_holding_id),
          eq(tokenHoldingsTable.wallet_id, input.wallet_id)
        )
      )
      .execute();

    if (holdingResult.length === 0) {
      throw new Error('Token holding not found');
    }

    const holding = holdingResult[0].token_holdings;
    const token = holdingResult[0].tokens;
    const currentQuantity = parseFloat(holding.quantity);

    // Validate sufficient quantity
    if (currentQuantity < input.quantity) {
      throw new Error('Insufficient token quantity');
    }

    // Calculate estimated SOL return based on purchase price
    const purchasePriceSol = parseFloat(holding.purchase_price_sol);
    const estimatedSolReturn = input.quantity * purchasePriceSol;

    // Create sell transaction record
    const transactionResult = await db.insert(transactionsTable)
      .values({
        wallet_id: input.wallet_id,
        token_id: holding.token_id,
        type: 'sell',
        amount_sol: estimatedSolReturn.toString(),
        token_quantity: input.quantity.toString(),
        price_per_token_sol: purchasePriceSol.toString(),
        take_profit_percentage: null,
        stop_loss_percentage: null,
        transaction_hash: null,
        status: 'pending'
      })
      .returning()
      .execute();

    // Update token holding quantity or remove if selling all
    const newQuantity = currentQuantity - input.quantity;
    
    if (newQuantity <= 0) {
      // Remove holding if quantity becomes zero or negative
      await db.delete(tokenHoldingsTable)
        .where(eq(tokenHoldingsTable.id, input.token_holding_id))
        .execute();
    } else {
      // Update holding with new quantity
      await db.update(tokenHoldingsTable)
        .set({
          quantity: newQuantity.toString(),
          updated_at: new Date()
        })
        .where(eq(tokenHoldingsTable.id, input.token_holding_id))
        .execute();
    }

    // Convert numeric fields and return transaction
    const transaction = transactionResult[0];
    return {
      ...transaction,
      amount_sol: parseFloat(transaction.amount_sol),
      token_quantity: parseFloat(transaction.token_quantity),
      price_per_token_sol: parseFloat(transaction.price_per_token_sol),
      take_profit_percentage: transaction.take_profit_percentage ? parseFloat(transaction.take_profit_percentage) : null,
      stop_loss_percentage: transaction.stop_loss_percentage ? parseFloat(transaction.stop_loss_percentage) : null
    };
  } catch (error) {
    console.error('Token sale failed:', error);
    throw error;
  }
}
