
import { db } from '../db';
import { transactionsTable, tokensTable } from '../db/schema';
import { type Transaction, type Token } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getTransactions(walletId: number): Promise<Array<Transaction & { token: Token }>> {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .innerJoin(tokensTable, eq(transactionsTable.token_id, tokensTable.id))
      .where(eq(transactionsTable.wallet_id, walletId))
      .orderBy(desc(transactionsTable.created_at))
      .execute();

    return results.map(result => {
      const transaction = result.transactions;
      const token = result.tokens;

      return {
        id: transaction.id,
        wallet_id: transaction.wallet_id,
        token_id: transaction.token_id,
        type: transaction.type,
        amount_sol: parseFloat(transaction.amount_sol),
        token_quantity: parseFloat(transaction.token_quantity),
        price_per_token_sol: parseFloat(transaction.price_per_token_sol),
        take_profit_percentage: transaction.take_profit_percentage ? parseFloat(transaction.take_profit_percentage) : null,
        stop_loss_percentage: transaction.stop_loss_percentage ? parseFloat(transaction.stop_loss_percentage) : null,
        transaction_hash: transaction.transaction_hash,
        status: transaction.status,
        created_at: transaction.created_at,
        token: {
          id: token.id,
          contract_address: token.contract_address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          price_usd: token.price_usd ? parseFloat(token.price_usd) : null,
          created_at: token.created_at
        }
      };
    });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    throw error;
  }
}
