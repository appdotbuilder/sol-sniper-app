
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { updateWalletBalance } from '../handlers/update_wallet_balance';
import { eq } from 'drizzle-orm';

describe('updateWalletBalance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update wallet balance', async () => {
    // Create test wallet
    const testWallet = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '5.0', // Initial balance
        is_active: true
      })
      .returning()
      .execute();

    const walletId = testWallet[0].id;

    // Update balance
    const result = await updateWalletBalance(walletId);

    // Verify return value
    expect(typeof result.sol_balance).toBe('number');
    expect(result.sol_balance).toBeGreaterThanOrEqual(0);
    expect(result.sol_balance).toBeLessThanOrEqual(10);
  });

  it('should save updated balance to database', async () => {
    // Create test wallet
    const testWallet = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-456',
        private_key: 'test-private-key',
        sol_balance: '2.5', // Initial balance
        is_active: true
      })
      .returning()
      .execute();

    const walletId = testWallet[0].id;

    // Update balance
    const result = await updateWalletBalance(walletId);

    // Query database to verify update
    const updatedWallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, walletId))
      .execute();

    expect(updatedWallet).toHaveLength(1);
    expect(parseFloat(updatedWallet[0].sol_balance)).toEqual(result.sol_balance);
    expect(parseFloat(updatedWallet[0].sol_balance)).not.toEqual(2.5); // Should be different from initial
  });

  it('should throw error for non-existent wallet', async () => {
    const nonExistentWalletId = 999;

    expect(updateWalletBalance(nonExistentWalletId)).rejects.toThrow(/not found/i);
  });

  it('should handle multiple balance updates correctly', async () => {
    // Create test wallet
    const testWallet = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-789',
        private_key: 'test-private-key',
        sol_balance: '1.0',
        is_active: false
      })
      .returning()
      .execute();

    const walletId = testWallet[0].id;

    // Update balance multiple times
    const firstUpdate = await updateWalletBalance(walletId);
    const secondUpdate = await updateWalletBalance(walletId);

    // Both updates should succeed
    expect(typeof firstUpdate.sol_balance).toBe('number');
    expect(typeof secondUpdate.sol_balance).toBe('number');

    // Verify final state in database
    const finalWallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, walletId))
      .execute();

    expect(parseFloat(finalWallet[0].sol_balance)).toEqual(secondUpdate.sol_balance);
  });
});
