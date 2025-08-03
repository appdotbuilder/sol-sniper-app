
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, tokenHoldingsTable } from '../db/schema';
import { getTokenHoldings } from '../handlers/get_token_holdings';

describe('getTokenHoldings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when wallet has no holdings', async () => {
    // Create a wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-key'
      })
      .returning()
      .execute();

    const result = await getTokenHoldings(walletResult[0].id);

    expect(result).toEqual([]);
  });

  it('should return token holdings with enriched data', async () => {
    // Create a wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-key'
      })
      .returning()
      .execute();
    const walletId = walletResult[0].id;

    // Create a token
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'token-contract-123',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9,
        price_usd: '2.50'
      })
      .returning()
      .execute();
    const tokenId = tokenResult[0].id;

    // Create a token holding
    await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: walletId,
        token_id: tokenId,
        quantity: '100.000000000',
        purchase_price_sol: '0.5',
        purchase_price_usd: '200.00'
      })
      .execute();

    const result = await getTokenHoldings(walletId);

    expect(result).toHaveLength(1);
    
    const holding = result[0];
    expect(holding.id).toBeDefined();
    expect(holding.wallet_id).toEqual(walletId);
    expect(holding.token_id).toEqual(tokenId);
    expect(holding.quantity).toEqual(100);
    expect(holding.purchase_price_sol).toEqual(0.5);
    expect(holding.purchase_price_usd).toEqual(200);
    expect(holding.created_at).toBeInstanceOf(Date);
    expect(holding.updated_at).toBeInstanceOf(Date);

    // Verify token data
    expect(holding.token.id).toEqual(tokenId);
    expect(holding.token.contract_address).toEqual('token-contract-123');
    expect(holding.token.name).toEqual('Test Token');
    expect(holding.token.symbol).toEqual('TEST');
    expect(holding.token.decimals).toEqual(9);
    expect(holding.token.price_usd).toEqual(2.5);
    expect(holding.token.created_at).toBeInstanceOf(Date);

    // Verify calculated fields
    expect(holding.current_value_usd).toEqual(250); // 100 tokens * $2.50
    expect(holding.pnl_percentage).toEqual(25); // (250 - 200) / 200 * 100
  });

  it('should handle null token prices correctly', async () => {
    // Create a wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-key'
      })
      .returning()
      .execute();
    const walletId = walletResult[0].id;

    // Create a token without price
    const tokenResult = await db.insert(tokensTable)
      .values({
        contract_address: 'token-contract-456',
        name: 'No Price Token',
        symbol: 'NPT',
        decimals: 18,
        price_usd: null
      })
      .returning()
      .execute();
    const tokenId = tokenResult[0].id;

    // Create a token holding
    await db.insert(tokenHoldingsTable)
      .values({
        wallet_id: walletId,
        token_id: tokenId,
        quantity: '50.000000000000000000',
        purchase_price_sol: '1.0',
        purchase_price_usd: null
      })
      .execute();

    const result = await getTokenHoldings(walletId);

    expect(result).toHaveLength(1);
    
    const holding = result[0];
    expect(holding.token.price_usd).toBeNull();
    expect(holding.purchase_price_usd).toBeNull();
    expect(holding.current_value_usd).toEqual(0);
    expect(holding.pnl_percentage).toEqual(0);
  });

  it('should return multiple holdings for a wallet', async () => {
    // Create a wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-key'
      })
      .returning()
      .execute();
    const walletId = walletResult[0].id;

    // Create tokens
    const token1Result = await db.insert(tokensTable)
      .values({
        contract_address: 'token-1',
        name: 'Token One',
        symbol: 'T1',
        decimals: 9,
        price_usd: '1.00'
      })
      .returning()
      .execute();

    const token2Result = await db.insert(tokensTable)
      .values({
        contract_address: 'token-2',
        name: 'Token Two',
        symbol: 'T2',
        decimals: 6,
        price_usd: '5.00'
      })
      .returning()
      .execute();

    // Create token holdings
    await db.insert(tokenHoldingsTable)
      .values([
        {
          wallet_id: walletId,
          token_id: token1Result[0].id,
          quantity: '100.000000000',
          purchase_price_sol: '0.1',
          purchase_price_usd: '80.00'
        },
        {
          wallet_id: walletId,
          token_id: token2Result[0].id,
          quantity: '20.000000',
          purchase_price_sol: '0.2',
          purchase_price_usd: '90.00'
        }
      ])
      .execute();

    const result = await getTokenHoldings(walletId);

    expect(result).toHaveLength(2);
    
    // Results should include both holdings
    const tokenSymbols = result.map(h => h.token.symbol).sort();
    expect(tokenSymbols).toEqual(['T1', 'T2']);

    // Verify calculations for each holding
    const t1Holding = result.find(h => h.token.symbol === 'T1');
    expect(t1Holding?.current_value_usd).toEqual(100); // 100 * $1.00
    expect(t1Holding?.pnl_percentage).toEqual(25); // (100 - 80) / 80 * 100

    const t2Holding = result.find(h => h.token.symbol === 'T2');
    expect(t2Holding?.current_value_usd).toEqual(100); // 20 * $5.00
    expect(t2Holding?.pnl_percentage).toBeCloseTo(11.11, 2); // (100 - 90) / 90 * 100
  });
});
