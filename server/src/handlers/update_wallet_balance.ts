
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function updateWalletBalance(walletId: number): Promise<{ sol_balance: number }> {
  try {
    // For now, simulate fetching balance from Solana blockchain
    // In a real implementation, this would query the actual Solana RPC
    const simulatedBalance = Math.random() * 10; // Random balance between 0-10 SOL

    // Update wallet balance in database
    const result = await db.update(walletsTable)
      .set({
        sol_balance: simulatedBalance.toString() // Convert number to string for numeric column
      })
      .where(eq(walletsTable.id, walletId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Wallet with id ${walletId} not found`);
    }

    // Convert numeric field back to number before returning
    const updatedWallet = result[0];
    return {
      sol_balance: parseFloat(updatedWallet.sol_balance)
    };
  } catch (error) {
    console.error('Wallet balance update failed:', error);
    throw error;
  }
}
