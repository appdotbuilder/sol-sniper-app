
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, limitOrdersTable } from '../db/schema';
import { cancelLimitOrder } from '../handlers/cancel_limit_order';
import { eq } from 'drizzle-orm';

describe('cancelLimitOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should cancel an active limit order', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test_address_123',
        private_key: 'test_private_key'
      })
      .returning()
      .execute();

    // Create test token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test_token_address',
        decimals: 9
      })
      .returning()
      .execute();

    // Create test limit order
    const orderResult = await db.insert(limitOrdersTable)
      .values({
        wallet_id: walletResult[0].id,
        token_id: tokenResult[0].id,
        target_price_usd: '0.50',
        amount_sol: '1.0',
        auto_execute: true,
        is_active: true
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Cancel the limit order
    const result = await cancelLimitOrder(orderId);

    // Verify cancellation was successful
    expect(result.success).toBe(true);

    // Verify the order is now inactive in the database
    const orders = await db.select()
      .from(limitOrdersTable)
      .where(eq(limitOrdersTable.id, orderId))
      .execute();

    expect(orders).toHaveLength(1);
    expect(orders[0].is_active).toBe(false);
  });

  it('should return false for non-existent order', async () => {
    const nonExistentOrderId = 999999;

    const result = await cancelLimitOrder(nonExistentOrderId);

    expect(result.success).toBe(false);
  });

  it('should successfully cancel already inactive order', async () => {
    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test_address_123',
        private_key: 'test_private_key'
      })
      .returning()
      .execute();

    // Create test token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test_token_address',
        decimals: 9
      })
      .returning()
      .execute();

    // Create test limit order that's already inactive
    const orderResult = await db.insert(limitOrdersTable)
      .values({
        wallet_id: walletResult[0].id,
        token_id: tokenResult[0].id,
        target_price_usd: '0.50',
        amount_sol: '1.0',
        auto_execute: false,
        is_active: false
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Cancel the already inactive limit order
    const result = await cancelLimitOrder(orderId);

    // Should still return success as the update operation finds the row
    expect(result.success).toBe(true);

    // Verify the order remains inactive
    const orders = await db.select()
      .from(limitOrdersTable)
      .where(eq(limitOrdersTable.id, orderId))
      .execute();

    expect(orders).toHaveLength(1);
    expect(orders[0].is_active).toBe(false);
  });
});
