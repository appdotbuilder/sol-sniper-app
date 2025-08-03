
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { getWallets } from '../handlers/get_wallets';

describe('getWallets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no wallets exist', async () => {
    const result = await getWallets();
    expect(result).toEqual([]);
  });

  it('should return all wallets with correct field types', async () => {
    // Create test wallets
    await db.insert(walletsTable).values([
      {
        name: 'Main Wallet',
        address: 'wallet1_address_123',
        private_key: 'private_key_1',
        sol_balance: '5.5',
        is_active: true
      },
      {
        name: 'Secondary Wallet',
        address: 'wallet2_address_456',
        private_key: 'private_key_2',
        sol_balance: '10.25',
        is_active: false
      }
    ]).execute();

    const result = await getWallets();

    expect(result).toHaveLength(2);

    // Check first wallet
    expect(result[0].name).toEqual('Main Wallet');
    expect(result[0].address).toEqual('wallet1_address_123');
    expect(result[0].private_key).toEqual('private_key_1');
    expect(result[0].sol_balance).toEqual(5.5);
    expect(typeof result[0].sol_balance).toBe('number');
    expect(result[0].is_active).toBe(true);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Check second wallet
    expect(result[1].name).toEqual('Secondary Wallet');
    expect(result[1].address).toEqual('wallet2_address_456');
    expect(result[1].private_key).toEqual('private_key_2');
    expect(result[1].sol_balance).toEqual(10.25);
    expect(typeof result[1].sol_balance).toBe('number');
    expect(result[1].is_active).toBe(false);
    expect(result[1].id).toBeDefined();
    expect(result[1].created_at).toBeInstanceOf(Date);
  });

  it('should handle zero balance correctly', async () => {
    await db.insert(walletsTable).values({
      name: 'Empty Wallet',
      address: 'empty_wallet_address',
      private_key: 'empty_private_key',
      sol_balance: '0',
      is_active: true
    }).execute();

    const result = await getWallets();

    expect(result).toHaveLength(1);
    expect(result[0].sol_balance).toEqual(0);
    expect(typeof result[0].sol_balance).toBe('number');
  });

  it('should handle high precision balances correctly', async () => {
    await db.insert(walletsTable).values({
      name: 'Precision Wallet',
      address: 'precision_wallet_address',
      private_key: 'precision_private_key',
      sol_balance: '0.123456789',
      is_active: true
    }).execute();

    const result = await getWallets();

    expect(result).toHaveLength(1);
    expect(result[0].sol_balance).toEqual(0.123456789);
    expect(typeof result[0].sol_balance).toBe('number');
  });
});
