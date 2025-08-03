
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, tokenHoldingsTable, transactionsTable } from '../db/schema';
import { type BuyTokenInput } from '../schema';
import { buyToken } from '../handlers/buy_token';
import { eq, and } from 'drizzle-orm';

// Test data setup
const testWallet = {
  name: 'Test Wallet',
  address: 'GvJjBBkF5d3nHsVJJwJr9qr9wQ9D1234567890',
  private_key: 'test_private_key_123',
  sol_balance: '10.0'
};

const testInput: BuyTokenInput = {
  wallet_id: 1,
  contract_address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  amount_sol: 1.0,
  take_profit_percentage: 50.0,
  stop_loss_percentage: 20.0
};

describe('buyToken', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should buy token successfully with new token', async () => {
    // Create test wallet
    await db.insert(walletsTable)
      .values(testWallet)
      .execute();

    const result = await buyToken(testInput);

    // Verify transaction details
    expect(result.wallet_id).toEqual(1);
    expect(result.type).toEqual('buy');
    expect(result.amount_sol).toEqual(1.0);
    expect(result.token_quantity).toBeGreaterThan(0);
    expect(result.price_per_token_sol).toBeGreaterThan(0);
    expect(result.take_profit_percentage).toEqual(50.0);
    expect(result.stop_loss_percentage).toEqual(20.0);
    expect(result.status).toEqual('completed');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create new token if not exists', async () => {
    await db.insert(walletsTable)
      .values(testWallet)
      .execute();

    await buyToken(testInput);

    // Verify token was created with real data fetching
    const tokens = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.contract_address, testInput.contract_address))
      .execute();

    expect(tokens).toHaveLength(1);
    expect(tokens[0].contract_address).toEqual(testInput.contract_address);
    expect(tokens[0].decimals).toBeGreaterThan(0);
    
    // Token might have fetched metadata
    if (tokens[0].name) {
      expect(typeof tokens[0].name).toEqual('string');
    }
    if (tokens[0].symbol) {
      expect(typeof tokens[0].symbol).toEqual('string');
    }
  });

  it('should create token holding for new purchase', async () => {
    await db.insert(walletsTable)
      .values(testWallet)
      .execute();

    await buyToken(testInput);

    // Verify token holding was created
    const holdings = await db.select()
      .from(tokenHoldingsTable)
      .where(eq(tokenHoldingsTable.wallet_id, 1))
      .execute();

    expect(holdings).toHaveLength(1);
    expect(parseFloat(holdings[0].quantity)).toBeGreaterThan(0);
    expect(parseFloat(holdings[0].purchase_price_sol)).toBeGreaterThan(0);
    
    // Should have USD price if token data was fetched successfully
    if (holdings[0].purchase_price_usd) {
      expect(parseFloat(holdings[0].purchase_price_usd)).toBeGreaterThan(0);
    }
  });

  it('should update existing token holding', async () => {
    await db.insert(walletsTable)
      .values(testWallet)
      .execute();

    // Create existing token
    const token = await db.insert(tokensTable)
      .values({
        contract_address: testInput.contract_address,
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9,
        price_usd: null
      })
      .returning()
      .execute();

    // Create existing holding
    await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: 1,
        token_id: token[0].id,
        quantity: '500',
        purchase_price_sol: '0.002',
        purchase_price_usd: null
      })
      .execute();

    await buyToken(testInput);

    // Verify holding was updated with weighted average
    const holdings = await db.select()
      .from(tokenHoldingsTable)
      .where(and(
        eq(tokenHoldingsTable.wallet_id, 1),
        eq(tokenHoldingsTable.token_id, token[0].id)
      ))
      .execute();

    expect(holdings).toHaveLength(1);
    expect(parseFloat(holdings[0].quantity)).toEqual(1500); // 500 + 1000
    // Weighted average: (500 * 0.002 + 1000 * 0.001) / 1500 = 0.001333...
    expect(parseFloat(holdings[0].purchase_price_sol)).toBeCloseTo(0.001333, 6);
  });

  it('should update wallet SOL balance', async () => {
    await db.insert(walletsTable)
      .values(testWallet)
      .execute();

    await buyToken(testInput);

    // Verify wallet balance was decreased
    const wallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, 1))
      .execute();

    expect(parseFloat(wallets[0].sol_balance)).toEqual(9.0); // 10.0 - 1.0
  });

  it('should throw error for non-existent wallet', async () => {
    await expect(buyToken(testInput)).rejects.toThrow(/wallet not found/i);
  });

  it('should throw error for insufficient balance', async () => {
    // Create wallet with insufficient balance
    await db.insert(walletsTable)
      .values({
        ...testWallet,
        sol_balance: '0.5'
      })
      .execute();

    const insufficientInput = { ...testInput, amount_sol: 1.0 };
    await expect(buyToken(insufficientInput)).rejects.toThrow(/insufficient sol balance/i);
  });

  it('should handle optional take profit and stop loss', async () => {
    await db.insert(walletsTable)
      .values(testWallet)
      .execute();

    const inputWithoutLimits: BuyTokenInput = {
      wallet_id: 1,
      contract_address: testInput.contract_address,
      amount_sol: 1.0,
      take_profit_percentage: null,
      stop_loss_percentage: null
    };

    const result = await buyToken(inputWithoutLimits);

    expect(result.take_profit_percentage).toBeNull();
    expect(result.stop_loss_percentage).toBeNull();
  });

  it('should save transaction to database', async () => {
    await db.insert(walletsTable)
      .values(testWallet)
      .execute();

    const result = await buyToken(testInput);

    // Verify transaction was saved
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toEqual('buy');
    expect(parseFloat(transactions[0].amount_sol)).toEqual(1.0);
    expect(transactions[0].status).toEqual('completed');
  });
});
