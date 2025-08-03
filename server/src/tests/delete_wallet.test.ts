
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, tokenHoldingsTable, transactionsTable, limitOrdersTable, settingsTable } from '../db/schema';
import { deleteWallet } from '../handlers/delete_wallet';
import { eq } from 'drizzle-orm';

describe('deleteWallet', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a wallet successfully', async () => {
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

    const walletId = walletResult[0].id;

    const result = await deleteWallet(walletId);

    expect(result.success).toBe(true);

    // Verify wallet is deleted
    const wallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, walletId))
      .execute();

    expect(wallets).toHaveLength(0);
  });

  it('should return false when wallet does not exist', async () => {
    const result = await deleteWallet(999);

    expect(result.success).toBe(false);
  });

  it('should delete associated data when deleting wallet', async () => {
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

    const walletId = walletResult[0].id;

    // Create test token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-address',
        name: 'Test Token',
        symbol: 'TT',
        decimals: 9,
        price_usd: '1.50'
      })
      .returning()
      .execute();

    const tokenId = tokenResult[0].id;

    // Create associated data
    await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: walletId,
        token_id: tokenId,
        quantity: '100.0',
        purchase_price_sol: '2.5',
        purchase_price_usd: '5.0'
      })
      .execute();

    await db.insert(transactionsTable)
      .values({
        wallet_id: walletId,
        token_id: tokenId,
        type: 'buy',
        amount_sol: '5.0',
        token_quantity: '100.0',
        price_per_token_sol: '0.05',
        status: 'completed'
      })
      .execute();

    await db.insert(limitOrdersTable)
      .values({
        wallet_id: walletId,
        token_id: tokenId,
        target_price_usd: '2.0',
        amount_sol: '10.0',
        auto_execute: true,
        is_active: true
      })
      .execute();

    await db.insert(settingsTable)
      .values({
        wallet_id: walletId,
        slippage_percentage: '1.0',
        mev_protection: true,
        alert_mode: 'popup'
      })
      .execute();

    const result = await deleteWallet(walletId);

    expect(result.success).toBe(true);

    // Verify all associated data is deleted
    const holdings = await db.select()
      .from(tokenHoldingsTable)
      .where(eq(tokenHoldingsTable.wallet_id, walletId))
      .execute();

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.wallet_id, walletId))
      .execute();

    const limitOrders = await db.select()
      .from(limitOrdersTable)
      .where(eq(limitOrdersTable.wallet_id, walletId))
      .execute();

    const settings = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.wallet_id, walletId))
      .execute();

    expect(holdings).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(limitOrders).toHaveLength(0);
    expect(settings).toHaveLength(0);
  });

  it('should set another wallet as active when deleting active wallet', async () => {
    // Create first wallet (active)
    const activeWalletResult = await db.insert(walletsTable)
      .values({
        name: 'Active Wallet',
        address: 'active-address-123',
        private_key: 'active-private-key',
        sol_balance: '10.5',
        is_active: true
      })
      .returning()
      .execute();

    const activeWalletId = activeWalletResult[0].id;

    // Create second wallet (inactive)
    const inactiveWalletResult = await db.insert(walletsTable)
      .values({
        name: 'Inactive Wallet',
        address: 'inactive-address-456',
        private_key: 'inactive-private-key',
        sol_balance: '5.0',
        is_active: false
      })
      .returning()
      .execute();

    const inactiveWalletId = inactiveWalletResult[0].id;

    const result = await deleteWallet(activeWalletId);

    expect(result.success).toBe(true);

    // Verify the previously inactive wallet is now active
    const remainingWallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, inactiveWalletId))
      .execute();

    expect(remainingWallet).toHaveLength(1);
    expect(remainingWallet[0].is_active).toBe(true);
  });

  it('should not affect other wallets when deleting inactive wallet', async () => {
    // Create first wallet (active)
    const activeWalletResult = await db.insert(walletsTable)
      .values({
        name: 'Active Wallet',
        address: 'active-address-123',
        private_key: 'active-private-key',
        sol_balance: '10.5',
        is_active: true
      })
      .returning()
      .execute();

    const activeWalletId = activeWalletResult[0].id;

    // Create second wallet (inactive)
    const inactiveWalletResult = await db.insert(walletsTable)
      .values({
        name: 'Inactive Wallet',
        address: 'inactive-address-456',
        private_key: 'inactive-private-key',
        sol_balance: '5.0',
        is_active: false
      })
      .returning()
      .execute();

    const inactiveWalletId = inactiveWalletResult[0].id;

    const result = await deleteWallet(inactiveWalletId);

    expect(result.success).toBe(true);

    // Verify the active wallet remains active
    const activeWallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, activeWalletId))
      .execute();

    expect(activeWallet).toHaveLength(1);
    expect(activeWallet[0].is_active).toBe(true);
  });
});
