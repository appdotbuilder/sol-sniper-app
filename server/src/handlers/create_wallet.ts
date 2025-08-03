
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { type CreateWalletInput, type Wallet } from '../schema';
import { eq } from 'drizzle-orm';

export async function createWallet(input: CreateWalletInput): Promise<Wallet> {
  try {
    // Check if this will be the first wallet (to set as active)
    const existingWallets = await db.select()
      .from(walletsTable)
      .execute();
    
    const isFirstWallet = existingWallets.length === 0;

    // Insert wallet record
    const result = await db.insert(walletsTable)
      .values({
        name: input.name,
        address: input.address,
        private_key: input.private_key,
        sol_balance: '0', // Convert number to string for numeric column
        is_active: isFirstWallet // Set as active if first wallet
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const wallet = result[0];
    return {
      ...wallet,
      sol_balance: parseFloat(wallet.sol_balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Wallet creation failed:', error);
    throw error;
  }
}
