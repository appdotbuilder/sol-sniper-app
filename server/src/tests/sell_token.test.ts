
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, tokenHoldingsTable, transactionsTable } from '../db/schema';
import { type SellTokenInput } from '../schema';
import { sellToken } from '../handlers/sell_token';
import { eq } from 'drizzle-orm';

describe('sellToken', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a sell transaction and reduce token holding quantity', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '10.0'
      })
      .returning()
      .execute();
    const wallet = walletResult[0];

    // Create test token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-contract',
        name: 'Test Token',
        symbol: 'TTK',
        decimals: 9,
        price_usd: '0.50'
      })
      .returning()
      .execute();
    const token = tokenResult[0];

    // Create token holding
    const holdingResult = await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        quantity: '1000.0',
        purchase_price_sol: '0.001',
        purchase_price_usd: '0.10'
      })
      .returning()
      .execute();
    const holding = holdingResult[0];

    const testInput: SellTokenInput = {
      wallet_id: wallet.id,
      token_holding_id: holding.id,
      quantity: 300
    };

    const result = await sellToken(testInput);

    // Validate transaction details
    expect(result.wallet_id).toEqual(wallet.id);
    expect(result.token_id).toEqual(token.id);
    expect(result.type).toEqual('sell');
    expect(result.token_quantity).toEqual(300);
    expect(result.price_per_token_sol).toEqual(0.001);
    expect(result.amount_sol).toEqual(0.3); // 300 * 0.001
    expect(result.status).toEqual('pending');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(typeof result.amount_sol).toBe('number');
    expect(typeof result.token_quantity).toBe('number');
    expect(typeof result.price_per_token_sol).toBe('number');
  });

  it('should save transaction to database', async () => {
    // Create prerequisites
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-456',
        private_key: 'test-private-key',
        sol_balance: '5.0'
      })
      .returning()
      .execute();
    const wallet = walletResult[0];

    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-contract-2',
        name: 'Test Token 2',
        symbol: 'TTK2',
        decimals: 9
      })
      .returning()
      .execute();
    const token = tokenResult[0];

    const holdingResult = await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        quantity: '500.0',
        purchase_price_sol: '0.002'
      })
      .returning()
      .execute();
    const holding = holdingResult[0];

    const testInput: SellTokenInput = {
      wallet_id: wallet.id,
      token_holding_id: holding.id,
      quantity: 200
    };

    const result = await sellToken(testInput);

    // Query transaction from database
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    const savedTransaction = transactions[0];
    expect(savedTransaction.wallet_id).toEqual(wallet.id);
    expect(savedTransaction.token_id).toEqual(token.id);
    expect(savedTransaction.type).toEqual('sell');
    expect(parseFloat(savedTransaction.token_quantity)).toEqual(200);
    expect(parseFloat(savedTransaction.amount_sol)).toEqual(0.4); // 200 * 0.002
    expect(savedTransaction.status).toEqual('pending');
  });

  it('should update token holding quantity after partial sale', async () => {
    // Create prerequisites
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-789',
        private_key: 'test-private-key',
        sol_balance: '15.0'
      })
      .returning()
      .execute();
    const wallet = walletResult[0];

    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-contract-3',
        name: 'Test Token 3',
        symbol: 'TTK3',
        decimals: 9
      })
      .returning()
      .execute();
    const token = tokenResult[0];

    const holdingResult = await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        quantity: '800.0',
        purchase_price_sol: '0.003'
      })
      .returning()
      .execute();
    const holding = holdingResult[0];

    const testInput: SellTokenInput = {
      wallet_id: wallet.id,
      token_holding_id: holding.id,
      quantity: 300
    };

    await sellToken(testInput);

    // Check updated holding
    const updatedHoldings = await db.select()
      .from(tokenHoldingsTable)
      .where(eq(tokenHoldingsTable.id, holding.id))
      .execute();

    expect(updatedHoldings).toHaveLength(1);
    expect(parseFloat(updatedHoldings[0].quantity)).toEqual(500); // 800 - 300
    expect(updatedHoldings[0].updated_at).toBeInstanceOf(Date);
  });

  it('should remove token holding when selling all tokens', async () => {
    // Create prerequisites
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-complete',
        private_key: 'test-private-key',
        sol_balance: '20.0'
      })
      .returning()
      .execute();
    const wallet = walletResult[0];

    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-contract-complete',
        name: 'Test Token Complete',
        symbol: 'TTKC',
        decimals: 9
      })
      .returning()
      .execute();
    const token = tokenResult[0];

    const holdingResult = await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        quantity: '400.0',
        purchase_price_sol: '0.0025'
      })
      .returning()
      .execute();
    const holding = holdingResult[0];

    const testInput: SellTokenInput = {
      wallet_id: wallet.id,
      token_holding_id: holding.id,
      quantity: 400 // Sell all tokens
    };

    await sellToken(testInput);

    // Check that holding was removed
    const remainingHoldings = await db.select()
      .from(tokenHoldingsTable)
      .where(eq(tokenHoldingsTable.id, holding.id))
      .execute();

    expect(remainingHoldings).toHaveLength(0);
  });

  it('should throw error for non-existent token holding', async () => {
    const testInput: SellTokenInput = {
      wallet_id: 999,
      token_holding_id: 999,
      quantity: 100
    };

    expect(sellToken(testInput)).rejects.toThrow(/token holding not found/i);
  });

  it('should throw error for insufficient token quantity', async () => {
    // Create prerequisites
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-insufficient',
        private_key: 'test-private-key',
        sol_balance: '5.0'
      })
      .returning()
      .execute();
    const wallet = walletResult[0];

    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-contract-insufficient',
        name: 'Test Token Insufficient',
        symbol: 'TTKI',
        decimals: 9
      })
      .returning()
      .execute();
    const token = tokenResult[0];

    const holdingResult = await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        quantity: '50.0', // Only 50 tokens available
        purchase_price_sol: '0.001'
      })
      .returning()
      .execute();
    const holding = holdingResult[0];

    const testInput: SellTokenInput = {
      wallet_id: wallet.id,
      token_holding_id: holding.id,
      quantity: 100 // Trying to sell more than available
    };

    expect(sellToken(testInput)).rejects.toThrow(/insufficient token quantity/i);
  });
});
