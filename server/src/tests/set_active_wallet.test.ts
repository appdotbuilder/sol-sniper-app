
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { setActiveWallet } from '../handlers/set_active_wallet';
import { eq } from 'drizzle-orm';

describe('setActiveWallet', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should set a wallet as active', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '10.5',
        is_active: false
      })
      .returning()
      .execute();

    const wallet = walletResult[0];

    // Set wallet as active
    const result = await setActiveWallet(wallet.id);

    // Basic field validation
    expect(result.id).toEqual(wallet.id);
    expect(result.name).toEqual('Test Wallet');
    expect(result.address).toEqual('test-address-123');
    expect(result.private_key).toEqual('test-private-key');
    expect(result.sol_balance).toEqual(10.5);
    expect(result.is_active).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should set wallet as active in database', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '10.5',
        is_active: false
      })
      .returning()
      .execute();

    const wallet = walletResult[0];

    // Set wallet as active
    await setActiveWallet(wallet.id);

    // Verify in database
    const updatedWallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, wallet.id))
      .execute();

    expect(updatedWallet).toHaveLength(1);
    expect(updatedWallet[0].is_active).toBe(true);
  });

  it('should set all other wallets to inactive', async () => {
    // Create multiple test wallets - one already active
    const wallet1Result = await db.insert(walletsTable)
      .values({
        name: 'Wallet 1',
        address: 'address-1',
        private_key: 'key-1',
        sol_balance: '5.0',
        is_active: true
      })
      .returning()
      .execute();

    const wallet2Result = await db.insert(walletsTable)
      .values({
        name: 'Wallet 2',
        address: 'address-2',
        private_key: 'key-2',
        sol_balance: '8.0',
        is_active: false
      })
      .returning()
      .execute();

    const wallet3Result = await db.insert(walletsTable)
      .values({
        name: 'Wallet 3',
        address: 'address-3',
        private_key: 'key-3',
        sol_balance: '12.0',
        is_active: true
      })
      .returning()
      .execute();

    const wallet1 = wallet1Result[0];
    const wallet2 = wallet2Result[0];
    const wallet3 = wallet3Result[0];

    // Set wallet2 as active
    await setActiveWallet(wallet2.id);

    // Check all wallets
    const allWallets = await db.select()
      .from(walletsTable)
      .execute();

    expect(allWallets).toHaveLength(3);

    // Only wallet2 should be active
    const activeWallets = allWallets.filter(w => w.is_active);
    expect(activeWallets).toHaveLength(1);
    expect(activeWallets[0].id).toEqual(wallet2.id);

    // Wallet1 and wallet3 should be inactive
    const inactiveWallets = allWallets.filter(w => !w.is_active);
    expect(inactiveWallets).toHaveLength(2);
    expect(inactiveWallets.map(w => w.id).sort()).toEqual([wallet1.id, wallet3.id].sort());
  });

  it('should throw error for non-existent wallet', async () => {
    await expect(setActiveWallet(999)).rejects.toThrow(/wallet.*not found/i);
  });

  it('should handle numeric conversion correctly', async () => {
    // Create test wallet with decimal balance
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '123.456789',
        is_active: false
      })
      .returning()
      .execute();

    const wallet = walletResult[0];

    // Set wallet as active
    const result = await setActiveWallet(wallet.id);

    // Verify numeric conversion
    expect(typeof result.sol_balance).toBe('number');
    expect(result.sol_balance).toEqual(123.456789);
  });
});
