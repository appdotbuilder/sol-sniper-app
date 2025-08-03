
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, tokenHoldingsTable } from '../db/schema';
import { getDashboardData } from '../handlers/get_dashboard_data';

describe('getDashboardData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty dashboard when no active wallet exists', async () => {
    // Create inactive wallet
    await db.insert(walletsTable)
      .values({
        name: 'Inactive Wallet',
        address: 'test123',
        private_key: 'key123',
        sol_balance: '10.5',
        is_active: false
      })
      .execute();

    const result = await getDashboardData();

    expect(result.active_wallet).toBeNull();
    expect(result.total_holdings_usd).toEqual(0);
    expect(result.token_holdings).toEqual([]);
  });

  it('should return dashboard data with active wallet and no holdings', async () => {
    // Create active wallet
    await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test123',
        private_key: 'key123',
        sol_balance: '25.75',
        is_active: true
      })
      .execute();

    const result = await getDashboardData();

    expect(result.active_wallet).toBeDefined();
    expect(result.active_wallet!.name).toEqual('Test Wallet');
    expect(result.active_wallet!.address).toEqual('test123');
    expect(result.active_wallet!.sol_balance).toEqual(25.75);
    expect(result.active_wallet!.is_active).toBe(true);
    expect(result.total_holdings_usd).toEqual(0);
    expect(result.token_holdings).toEqual([]);
  });

  it('should return dashboard data with token holdings and calculations', async () => {
    // Create active wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test123',
        private_key: 'key123',
        sol_balance: '100.0',
        is_active: true
      })
      .returning()
      .execute();

    const wallet = walletResult[0];

    // Create tokens
    const tokenResults = await db.insert(tokensTable)
      .values([
        {
          contract_address: 'token1',
          name: 'Test Token 1',
          symbol: 'TT1',
          decimals: 9,
          price_usd: '2.50'
        },
        {
          contract_address: 'token2',
          name: 'Test Token 2',
          symbol: 'TT2',
          decimals: 6,
          price_usd: '10.00'
        }
      ])
      .returning()
      .execute();

    const token1 = tokenResults[0];
    const token2 = tokenResults[1];

    // Create token holdings
    await db.insert(tokenHoldingsTable)
      .values([
        {
          wallet_id: wallet.id,
          token_id: token1.id,
          quantity: '100.0',
          purchase_price_sol: '1.0',
          purchase_price_usd: '200.0'
        },
        {
          wallet_id: wallet.id,
          token_id: token2.id,
          quantity: '50.0',
          purchase_price_sol: '2.0',
          purchase_price_usd: '400.0'
        }
      ])
      .execute();

    const result = await getDashboardData();

    expect(result.active_wallet).toBeDefined();
    expect(result.active_wallet!.name).toEqual('Test Wallet');
    expect(result.active_wallet!.sol_balance).toEqual(100.0);

    // Total USD: (100 * 2.50) + (50 * 10.00) = 250 + 500 = 750
    expect(result.total_holdings_usd).toEqual(750);
    expect(result.token_holdings).toHaveLength(2);

    // Check first token holding
    const holding1 = result.token_holdings.find(h => h.token.symbol === 'TT1');
    expect(holding1).toBeDefined();
    expect(holding1!.quantity).toEqual(100);
    expect(holding1!.purchase_price_sol).toEqual(1.0);
    expect(holding1!.purchase_price_usd).toEqual(200.0);
    expect(holding1!.current_value_usd).toEqual(250);
    expect(holding1!.pnl_percentage).toEqual(25); // (250 - 200) / 200 * 100 = 25%
    expect(holding1!.token.name).toEqual('Test Token 1');
    expect(holding1!.token.price_usd).toEqual(2.50);

    // Check second token holding
    const holding2 = result.token_holdings.find(h => h.token.symbol === 'TT2');
    expect(holding2).toBeDefined();
    expect(holding2!.quantity).toEqual(50);
    expect(holding2!.purchase_price_usd).toEqual(400.0);
    expect(holding2!.current_value_usd).toEqual(500);
    expect(holding2!.pnl_percentage).toEqual(25); // (500 - 400) / 400 * 100 = 25%
  });

  it('should handle tokens without current price', async () => {
    // Create active wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test123',
        private_key: 'key123',
        sol_balance: '50.0',
        is_active: true
      })
      .returning()
      .execute();

    const wallet = walletResult[0];

    // Create token without price
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'token1',
        name: 'Test Token',
        symbol: 'TT',
        decimals: 9,
        price_usd: null
      })
      .returning()
      .execute();

    const token = tokenResult[0];

    // Create token holding
    await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        quantity: '100.0',
        purchase_price_sol: '1.0',
        purchase_price_usd: '50.0'
      })
      .execute();

    const result = await getDashboardData();

    expect(result.total_holdings_usd).toEqual(0);
    expect(result.token_holdings).toHaveLength(1);
    expect(result.token_holdings[0].current_value_usd).toEqual(0);
    expect(result.token_holdings[0].pnl_percentage).toEqual(0);
    expect(result.token_holdings[0].token.price_usd).toBeNull();
  });

  it('should only return holdings for active wallet', async () => {
    // Create active and inactive wallets
    const walletResults = await db.insert(walletsTable)
      .values([
        {
          name: 'Active Wallet',
          address: 'active123',
          private_key: 'key1',
          sol_balance: '50.0',
          is_active: true
        },
        {
          name: 'Inactive Wallet',
          address: 'inactive123',
          private_key: 'key2',
          sol_balance: '25.0',
          is_active: false
        }
      ])
      .returning()
      .execute();

    const activeWallet = walletResults[0];
    const inactiveWallet = walletResults[1];

    // Create token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'token1',
        name: 'Test Token',
        symbol: 'TT',
        decimals: 9,
        price_usd: '5.00'
      })
      .returning()
      .execute();

    const token = tokenResult[0];

    // Create holdings for both wallets
    await db.insert(tokenHoldingsTable)
      .values([
        {
          wallet_id: activeWallet.id,
          token_id: token.id,
          quantity: '10.0',
          purchase_price_sol: '1.0',
          purchase_price_usd: '40.0'
        },
        {
          wallet_id: inactiveWallet.id,
          token_id: token.id,
          quantity: '20.0',
          purchase_price_sol: '2.0',
          purchase_price_usd: '80.0'
        }
      ])
      .execute();

    const result = await getDashboardData();

    expect(result.active_wallet!.name).toEqual('Active Wallet');
    expect(result.token_holdings).toHaveLength(1);
    expect(result.token_holdings[0].quantity).toEqual(10);
    expect(result.total_holdings_usd).toEqual(50); // 10 * 5.00
  });
});
