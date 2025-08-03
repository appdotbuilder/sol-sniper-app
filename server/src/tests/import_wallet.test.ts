
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { type ImportWalletInput } from '../schema';
import { importWallet } from '../handlers/import_wallet';
import { eq } from 'drizzle-orm';

// Valid test private key (base58 format - excludes 0, O, I, l)
const validPrivateKey = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';

const testInput: ImportWalletInput = {
  name: 'Test Imported Wallet',
  private_key: validPrivateKey
};

describe('importWallet', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should import a wallet with valid private key', async () => {
    const result = await importWallet(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Imported Wallet');
    expect(result.private_key).toEqual(validPrivateKey);
    expect(result.address).toBeDefined();
    expect(result.address.length).toEqual(44); // Solana address length
    expect(result.sol_balance).toEqual(0);
    expect(result.is_active).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save wallet to database', async () => {
    const result = await importWallet(testInput);

    // Query using proper drizzle syntax
    const wallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, result.id))
      .execute();

    expect(wallets).toHaveLength(1);
    expect(wallets[0].name).toEqual('Test Imported Wallet');
    expect(wallets[0].private_key).toEqual(validPrivateKey);
    expect(wallets[0].address).toEqual(result.address);
    expect(parseFloat(wallets[0].sol_balance)).toEqual(0);
    expect(wallets[0].is_active).toEqual(false);
    expect(wallets[0].created_at).toBeInstanceOf(Date);
  });

  it('should generate consistent address from same private key', async () => {
    const result1 = await importWallet({
      name: 'Wallet 1',
      private_key: validPrivateKey
    });

    // Reset database and import again with same private key
    await resetDB();
    await createDB();

    const result2 = await importWallet({
      name: 'Wallet 2',
      private_key: validPrivateKey
    });

    // Should generate the same address for the same private key
    expect(result1.address).toEqual(result2.address);
  });

  it('should reject invalid private key format with special characters', async () => {
    const invalidInput: ImportWalletInput = {
      name: 'Invalid Wallet',
      private_key: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz@#$%123456789'
    };

    await expect(importWallet(invalidInput)).rejects.toThrow(/Invalid private key format/i);
  });

  it('should reject empty private key', async () => {
    const emptyKeyInput: ImportWalletInput = {
      name: 'Empty Key Wallet',
      private_key: ''
    };

    await expect(importWallet(emptyKeyInput)).rejects.toThrow(/Invalid private key format/i);
  });

  it('should reject short private key', async () => {
    const shortKeyInput: ImportWalletInput = {
      name: 'Short Key Wallet',
      private_key: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdef' // Exactly 31 characters, need at least 32
    };

    await expect(importWallet(shortKeyInput)).rejects.toThrow(/Invalid private key format/i);
  });

  it('should reject private key with forbidden base58 characters', async () => {
    const forbiddenCharsInput: ImportWalletInput = {
      name: 'Forbidden Chars Wallet',
      private_key: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz1234567890' // Contains 0 (forbidden)
    };

    await expect(importWallet(forbiddenCharsInput)).rejects.toThrow(/Invalid private key format/i);
  });

  it('should handle duplicate address constraint', async () => {
    // Import wallet first time
    await importWallet(testInput);

    // Try to import the same wallet again (same private key = same address)
    await expect(importWallet(testInput)).rejects.toThrow();
  });

  it('should generate different addresses for different private keys', async () => {
    // Two significantly different private keys using only valid base58 characters
    const privateKey1 = '1111111111111111111111111111111ABCDEFGHJKLMNPQRSTUVWXYZabc';
    const privateKey2 = '9999999999999999999999999999999ZYXWVUTSRQPNMKJHGFEDCBAzyx';

    const result1 = await importWallet({
      name: 'Wallet 1',
      private_key: privateKey1
    });

    const result2 = await importWallet({
      name: 'Wallet 2',
      private_key: privateKey2
    });

    // Different private keys should generate different addresses
    expect(result1.address).not.toEqual(result2.address);
    expect(result1.address.length).toEqual(44);
    expect(result2.address.length).toEqual(44);
    
    // Verify addresses contain only valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    expect(base58Regex.test(result1.address)).toBe(true);
    expect(base58Regex.test(result2.address)).toBe(true);
  });
});
