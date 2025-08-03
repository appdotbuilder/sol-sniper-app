
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { type Wallet } from '../schema';

export async function getWallets(): Promise<Wallet[]> {
  try {
    const results = await db.select()
      .from(walletsTable)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(wallet => ({
      ...wallet,
      sol_balance: parseFloat(wallet.sol_balance) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch wallets:', error);
    throw error;
  }
}
