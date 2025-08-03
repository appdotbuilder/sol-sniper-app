
import { db } from '../db';
import { walletsTable, tokenHoldingsTable, transactionsTable, limitOrdersTable, settingsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteWallet(walletId: number): Promise<{ success: boolean }> {
  try {
    // Delete associated data first (foreign key constraints)
    await db.delete(settingsTable)
      .where(eq(settingsTable.wallet_id, walletId))
      .execute();

    await db.delete(limitOrdersTable)
      .where(eq(limitOrdersTable.wallet_id, walletId))
      .execute();

    await db.delete(transactionsTable)
      .where(eq(transactionsTable.wallet_id, walletId))
      .execute();

    await db.delete(tokenHoldingsTable)
      .where(eq(tokenHoldingsTable.wallet_id, walletId))
      .execute();

    // Get the wallet before deletion to check if it was active
    const wallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, walletId))
      .execute();

    if (wallet.length === 0) {
      return { success: false };
    }

    const wasActive = wallet[0].is_active;

    // Delete the wallet
    await db.delete(walletsTable)
      .where(eq(walletsTable.id, walletId))
      .execute();

    // If the deleted wallet was active, set another wallet as active
    if (wasActive) {
      const remainingWallets = await db.select()
        .from(walletsTable)
        .limit(1)
        .execute();

      if (remainingWallets.length > 0) {
        await db.update(walletsTable)
          .set({ is_active: true })
          .where(eq(walletsTable.id, remainingWallets[0].id))
          .execute();
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Wallet deletion failed:', error);
    throw error;
  }
}
