
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, limitOrdersTable } from '../db/schema';
import { getLimitOrders } from '../handlers/get_limit_orders';

describe('getLimitOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no limit orders exist', async () => {
    // Create a wallet without limit orders
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '100.0'
      })
      .returning()
      .execute();

    const result = await getLimitOrders(walletResult[0].id);

    expect(result).toEqual([]);
  });

  it('should return limit orders with token data', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '100.0'
      })
      .returning()
      .execute();

    // Create test token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'token-contract-123',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9,
        price_usd: '1.50'
      })
      .returning()
      .execute();

    // Create test limit order
    const limitOrderResult = await db.insert(limitOrdersTable)
      .values({
        wallet_id: walletResult[0].id,
        token_id: tokenResult[0].id,
        target_price_usd: '2.00',
        amount_sol: '10.0',
        auto_execute: true,
        is_active: true
      })
      .returning()
      .execute();

    const result = await getLimitOrders(walletResult[0].id);

    expect(result).toHaveLength(1);
    
    const order = result[0];
    expect(order.id).toEqual(limitOrderResult[0].id);
    expect(order.wallet_id).toEqual(walletResult[0].id);
    expect(order.token_id).toEqual(tokenResult[0].id);
    expect(order.target_price_usd).toEqual(2.00);
    expect(typeof order.target_price_usd).toBe('number');
    expect(order.amount_sol).toEqual(10.0);
    expect(typeof order.amount_sol).toBe('number');
    expect(order.auto_execute).toBe(true);
    expect(order.is_active).toBe(true);
    expect(order.created_at).toBeInstanceOf(Date);
    expect(order.executed_at).toBeNull();

    // Check token data
    expect(order.token.id).toEqual(tokenResult[0].id);
    expect(order.token.contract_address).toEqual('token-contract-123');
    expect(order.token.name).toEqual('Test Token');
    expect(order.token.symbol).toEqual('TEST');
    expect(order.token.decimals).toEqual(9);
    expect(order.token.price_usd).toEqual(1.50);
    expect(typeof order.token.price_usd).toBe('number');
    expect(order.token.created_at).toBeInstanceOf(Date);
  });

  it('should return multiple limit orders for same wallet', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '100.0'
      })
      .returning()
      .execute();

    // Create multiple test tokens
    const token1Result = await db.insert(tokensTable)
      .values({
        contract_address: 'token-contract-1',
        name: 'Token 1',
        symbol: 'TK1',
        decimals: 9,
        price_usd: '1.00'
      })
      .returning()
      .execute();

    const token2Result = await db.insert(tokensTable)
      .values({
        contract_address: 'token-contract-2',
        name: 'Token 2',
        symbol: 'TK2',
        decimals: 6,
        price_usd: '5.25'
      })
      .returning()
      .execute();

    // Create multiple limit orders
    await db.insert(limitOrdersTable)
      .values([
        {
          wallet_id: walletResult[0].id,
          token_id: token1Result[0].id,
          target_price_usd: '1.50',
          amount_sol: '5.0',
          auto_execute: false,
          is_active: true
        },
        {
          wallet_id: walletResult[0].id,
          token_id: token2Result[0].id,
          target_price_usd: '6.00',
          amount_sol: '15.0',
          auto_execute: true,
          is_active: false
        }
      ])
      .execute();

    const result = await getLimitOrders(walletResult[0].id);

    expect(result).toHaveLength(2);
    
    // Check first order
    const order1 = result.find(o => o.token.symbol === 'TK1');
    expect(order1).toBeDefined();
    expect(order1!.target_price_usd).toEqual(1.50);
    expect(order1!.amount_sol).toEqual(5.0);
    expect(order1!.auto_execute).toBe(false);
    expect(order1!.is_active).toBe(true);

    // Check second order
    const order2 = result.find(o => o.token.symbol === 'TK2');
    expect(order2).toBeDefined();
    expect(order2!.target_price_usd).toEqual(6.00);
    expect(order2!.amount_sol).toEqual(15.0);
    expect(order2!.auto_execute).toBe(true);
    expect(order2!.is_active).toBe(false);
  });

  it('should handle token with null price_usd', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key',
        sol_balance: '100.0'
      })
      .returning()
      .execute();

    // Create token with null price
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'token-contract-123',
        name: 'New Token',
        symbol: 'NEW',
        decimals: 9,
        price_usd: null
      })
      .returning()
      .execute();

    // Create limit order
    await db.insert(limitOrdersTable)
      .values({
        wallet_id: walletResult[0].id,
        token_id: tokenResult[0].id,
        target_price_usd: '1.00',
        amount_sol: '10.0',
        auto_execute: true,
        is_active: true
      })
      .execute();

    const result = await getLimitOrders(walletResult[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].token.price_usd).toBeNull();
  });

  it('should only return orders for specified wallet', async () => {
    // Create two wallets
    const wallet1Result = await db.insert(walletsTable)
      .values({
        name: 'Wallet 1',
        address: 'address-1',
        private_key: 'key-1',
        sol_balance: '100.0'
      })
      .returning()
      .execute();

    const wallet2Result = await db.insert(walletsTable)
      .values({
        name: 'Wallet 2',
        address: 'address-2',
        private_key: 'key-2',
        sol_balance: '200.0'
      })
      .returning()
      .execute();

    // Create token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'token-contract-123',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9,
        price_usd: '1.00'
      })
      .returning()
      .execute();

    // Create limit orders for both wallets
    await db.insert(limitOrdersTable)
      .values([
        {
          wallet_id: wallet1Result[0].id,
          token_id: tokenResult[0].id,
          target_price_usd: '1.50',
          amount_sol: '5.0',
          auto_execute: true,
          is_active: true
        },
        {
          wallet_id: wallet2Result[0].id,
          token_id: tokenResult[0].id,
          target_price_usd: '2.00',
          amount_sol: '10.0',
          auto_execute: false,
          is_active: true
        }
      ])
      .execute();

    // Get orders for wallet 1 only
    const result = await getLimitOrders(wallet1Result[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].wallet_id).toEqual(wallet1Result[0].id);
    expect(result[0].target_price_usd).toEqual(1.50);
  });
});
