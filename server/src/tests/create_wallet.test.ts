
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { type CreateWalletInput } from '../schema';
import { createWallet } from '../handlers/create_wallet';
import { eq } from 'drizzle-orm';

describe('createWallet', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a wallet', async () => {
    const testInput: CreateWalletInput = {
      name: 'Test Wallet',
      address: '11111111111111111111111111111112',
      private_key: 'test_private_key_123'
    };

    const result = await createWallet(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Wallet');
    expect(result.address).toEqual(testInput.address);
    expect(result.private_key).toEqual(testInput.private_key);
    expect(result.sol_balance).toEqual(0);
    expect(typeof result.sol_balance).toBe('number');
    expect(result.is_active).toBe(true); // First wallet should be active
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save wallet to database', async () => {
    const testInput: CreateWalletInput = {
      name: 'Test Wallet 2',
      address: '11111111111111111111111111111113',
      private_key: 'test_private_key_456'
    };

    const result = await createWallet(testInput);

    // Query using proper drizzle syntax
    const wallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, result.id))
      .execute();

    expect(wallets).toHaveLength(1);
    expect(wallets[0].name).toEqual('Test Wallet 2');
    expect(wallets[0].address).toEqual(testInput.address);
    expect(wallets[0].private_key).toEqual(testInput.private_key);
    expect(parseFloat(wallets[0].sol_balance)).toEqual(0);
    expect(wallets[0].is_active).toBe(true);
    expect(wallets[0].created_at).toBeInstanceOf(Date);
  });

  it('should set first wallet as active', async () => {
    const testInput: CreateWalletInput = {
      name: 'First Wallet',
      address: '11111111111111111111111111111114',
      private_key: 'test_private_key_789'
    };

    const result = await createWallet(testInput);

    expect(result.is_active).toBe(true);
  });

  it('should set subsequent wallets as inactive', async () => {
    const firstInput: CreateWalletInput = {
      name: 'First Wallet',
      address: '11111111111111111111111111111115',
      private_key: 'test_private_key_first'
    };

    const secondInput: CreateWalletInput = {
      name: 'Second Wallet',
      address: '11111111111111111111111111111116',
      private_key: 'test_private_key_second'
    };

    // Create first wallet
    await createWallet(firstInput);

    // Create second wallet
    const secondResult = await createWallet(secondInput);

    expect(secondResult.is_active).toBe(false);
  });

  it('should handle unique address constraint', async () => {
    const testInput: CreateWalletInput = {
      name: 'Original Wallet',
      address: '11111111111111111111111111111117',
      private_key: 'test_private_key_original'
    };

    // Create first wallet
    await createWallet(testInput);

    // Try to create wallet with same address
    const duplicateInput: CreateWalletInput = {
      name: 'Duplicate Wallet',
      address: '11111111111111111111111111111117', // Same address
      private_key: 'test_private_key_duplicate'
    };

    expect(createWallet(duplicateInput)).rejects.toThrow(/unique/i);
  });

  it('should verify numeric sol_balance conversion', async () => {
    const testInput: CreateWalletInput = {
      name: 'Balance Test Wallet',
      address: '11111111111111111111111111111118',
      private_key: 'test_private_key_balance'
    };

    const result = await createWallet(testInput);

    // Verify the returned value is a number
    expect(typeof result.sol_balance).toBe('number');
    expect(result.sol_balance).toEqual(0);

    // Verify database storage (should be string internally with precision format)
    const wallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, result.id))
      .execute();

    expect(typeof wallets[0].sol_balance).toBe('string');
    // PostgreSQL numeric with precision stores as "0.000000000" for zero values
    expect(wallets[0].sol_balance).toEqual('0.000000000');
  });
});
