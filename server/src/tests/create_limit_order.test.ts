
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, limitOrdersTable } from '../db/schema';
import { type CreateLimitOrderInput } from '../schema';
import { createLimitOrder } from '../handlers/create_limit_order';
import { eq } from 'drizzle-orm';

describe('createLimitOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let walletId: number;
  const contractAddress = 'So11111111111111111111111111111111111111112';

  beforeEach(async () => {
    // Create a test wallet
    const wallet = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-private-key',
        sol_balance: '100',
        is_active: true
      })
      .returning()
      .execute();
    
    walletId = wallet[0].id;
  });

  const testInput: CreateLimitOrderInput = {
    wallet_id: 0, // Will be set in tests
    contract_address: contractAddress,
    target_price_usd: 150.0,
    amount_sol: 2.5,
    auto_execute: true
  };

  it('should create a limit order with new token', async () => {
    const input = { ...testInput, wallet_id: walletId };
    const result = await createLimitOrder(input);

    expect(result.wallet_id).toEqual(walletId);
    expect(result.target_price_usd).toEqual(150.0);
    expect(result.amount_sol).toEqual(2.5);
    expect(result.auto_execute).toEqual(true);
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.token_id).toBeGreaterThan(0);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.executed_at).toBeNull();
  });

  it('should create a limit order with existing token', async () => {
    // First create a token
    const token = await db.insert(tokensTable)
      .values({
        contract_address: contractAddress,
        name: 'Wrapped SOL',
        symbol: 'WSOL',
        decimals: 9,
        price_usd: '100.50'
      })
      .returning()
      .execute();

    const input = { ...testInput, wallet_id: walletId };
    const result = await createLimitOrder(input);

    expect(result.token_id).toEqual(token[0].id);
    expect(result.target_price_usd).toEqual(150.0);
    expect(result.amount_sol).toEqual(2.5);
    expect(result.auto_execute).toEqual(true);
  });

  it('should save limit order to database', async () => {
    const input = { ...testInput, wallet_id: walletId };
    const result = await createLimitOrder(input);

    const limitOrders = await db.select()
      .from(limitOrdersTable)
      .where(eq(limitOrdersTable.id, result.id))
      .execute();

    expect(limitOrders).toHaveLength(1);
    const savedOrder = limitOrders[0];
    
    expect(savedOrder.wallet_id).toEqual(walletId);
    expect(parseFloat(savedOrder.target_price_usd)).toEqual(150.0);
    expect(parseFloat(savedOrder.amount_sol)).toEqual(2.5);
    expect(savedOrder.auto_execute).toEqual(true);
    expect(savedOrder.is_active).toEqual(true);
    expect(savedOrder.created_at).toBeInstanceOf(Date);
  });

  it('should create token when contract address does not exist', async () => {
    const input = { ...testInput, wallet_id: walletId };
    await createLimitOrder(input);

    const tokens = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.contract_address, contractAddress))
      .execute();

    expect(tokens).toHaveLength(1);
    const token = tokens[0];
    expect(token.contract_address).toEqual(contractAddress);
    expect(token.decimals).toEqual(9);
    expect(token.name).toBeNull();
    expect(token.symbol).toBeNull();
    expect(token.price_usd).toBeNull();
  });

  it('should handle auto_execute false', async () => {
    const input = { 
      ...testInput, 
      wallet_id: walletId,
      auto_execute: false 
    };
    const result = await createLimitOrder(input);

    expect(result.auto_execute).toEqual(false);
    expect(result.is_active).toEqual(true);
  });

  it('should handle numeric conversions correctly', async () => {
    const input = { 
      ...testInput, 
      wallet_id: walletId,
      target_price_usd: 123.456789,
      amount_sol: 0.123456789
    };
    const result = await createLimitOrder(input);

    expect(typeof result.target_price_usd).toBe('number');
    expect(typeof result.amount_sol).toBe('number');
    expect(result.target_price_usd).toEqual(123.456789);
    expect(result.amount_sol).toEqual(0.123456789);
  });
});
