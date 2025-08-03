
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { type Wallet } from '../schema';
import { eq } from 'drizzle-orm';

export async function setActiveWallet(walletId: number): Promise<Wallet> {
  try {
    // First, set all wallets to inactive
    await db.update(walletsTable)
      .set({ is_active: false })
      .execute();

    // Then, set the specified wallet as active
    const result = await db.update(walletsTable)
      .set({ is_active: true })
      .where(eq(walletsTable.id, walletId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Wallet with id ${walletId} not found`);
    }

    const wallet = result[0];
    return {
      ...wallet,
      sol_balance: parseFloat(wallet.sol_balance) // Convert numeric to number
    };
  } catch (error) {
    console.error('Set active wallet failed:', error);
    throw error;
  }
}
