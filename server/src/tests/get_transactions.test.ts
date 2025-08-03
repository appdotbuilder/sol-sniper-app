
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, tokensTable, transactionsTable } from '../db/schema';
import { getTransactions } from '../handlers/get_transactions';

describe('getTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when wallet has no transactions', async () => {
    // Create wallet without transactions
    const [wallet] = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-private-key'
      })
      .returning()
      .execute();

    const result = await getTransactions(wallet.id);

    expect(result).toEqual([]);
  });

  it('should return transactions with token details for a wallet', async () => {
    // Create wallet
    const [wallet] = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-private-key'
      })
      .returning()
      .execute();

    // Create token
    const [token] = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-address',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9,
        price_usd: '1.50'
      })
      .returning()
      .execute();

    // Create transaction
    await db.insert(transactionsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        type: 'buy',
        amount_sol: '1.5',
        token_quantity: '1000.0',
        price_per_token_sol: '0.0015',
        take_profit_percentage: '20.0',
        stop_loss_percentage: '10.0',
        transaction_hash: 'test-hash',
        status: 'completed'
      })
      .execute();

    const result = await getTransactions(wallet.id);

    expect(result).toHaveLength(1);
    
    const transaction = result[0];
    expect(transaction.id).toBeDefined();
    expect(transaction.wallet_id).toEqual(wallet.id);
    expect(transaction.token_id).toEqual(token.id);
    expect(transaction.type).toEqual('buy');
    expect(transaction.amount_sol).toEqual(1.5);
    expect(typeof transaction.amount_sol).toBe('number');
    expect(transaction.token_quantity).toEqual(1000.0);
    expect(typeof transaction.token_quantity).toBe('number');
    expect(transaction.price_per_token_sol).toEqual(0.0015);
    expect(typeof transaction.price_per_token_sol).toBe('number');
    expect(transaction.take_profit_percentage).toEqual(20.0);
    expect(typeof transaction.take_profit_percentage).toBe('number');
    expect(transaction.stop_loss_percentage).toEqual(10.0);
    expect(typeof transaction.stop_loss_percentage).toBe('number');
    expect(transaction.transaction_hash).toEqual('test-hash');
    expect(transaction.status).toEqual('completed');
    expect(transaction.created_at).toBeInstanceOf(Date);

    // Verify token details
    expect(transaction.token.id).toEqual(token.id);
    expect(transaction.token.contract_address).toEqual('test-token-address');
    expect(transaction.token.name).toEqual('Test Token');
    expect(transaction.token.symbol).toEqual('TEST');
    expect(transaction.token.decimals).toEqual(9);
    expect(transaction.token.price_usd).toEqual(1.5);
    expect(typeof transaction.token.price_usd).toBe('number');
    expect(transaction.token.created_at).toBeInstanceOf(Date);
  });

  it('should return transactions ordered by most recent first', async () => {
    // Create wallet
    const [wallet] = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-private-key'
      })
      .returning()
      .execute();

    // Create token
    const [token] = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-address',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9
      })
      .returning()
      .execute();

    // Create multiple transactions with different timestamps
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier

    await db.insert(transactionsTable)
      .values([
        {
          wallet_id: wallet.id,
          token_id: token.id,
          type: 'buy',
          amount_sol: '1.0',
          token_quantity: '1000.0',
          price_per_token_sol: '0.001',
          status: 'completed'
        },
        {
          wallet_id: wallet.id,
          token_id: token.id,
          type: 'sell',
          amount_sol: '0.5',
          token_quantity: '500.0',
          price_per_token_sol: '0.001',
          status: 'completed'
        }
      ])
      .execute();

    const result = await getTransactions(wallet.id);

    expect(result).toHaveLength(2);
    // First transaction should be more recent (created_at is descending)
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should handle null numeric fields correctly', async () => {
    // Create wallet
    const [wallet] = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address',
        private_key: 'test-private-key'
      })
      .returning()
      .execute();

    // Create token with null price
    const [token] = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-address',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9,
        price_usd: null
      })
      .returning()
      .execute();

    // Create transaction with null profit/loss percentages
    await db.insert(transactionsTable)
      .values({
        wallet_id: wallet.id,
        token_id: token.id,
        type: 'buy',
        amount_sol: '1.0',
        token_quantity: '1000.0',
        price_per_token_sol: '0.001',
        take_profit_percentage: null,
        stop_loss_percentage: null,
        transaction_hash: null,
        status: 'pending'
      })
      .execute();

    const result = await getTransactions(wallet.id);

    expect(result).toHaveLength(1);
    expect(result[0].take_profit_percentage).toBeNull();
    expect(result[0].stop_loss_percentage).toBeNull();
    expect(result[0].transaction_hash).toBeNull();
    expect(result[0].token.price_usd).toBeNull();
  });

  it('should only return transactions for specified wallet', async () => {
    // Create two wallets
    const [wallet1] = await db.insert(walletsTable)
      .values({
        name: 'Wallet 1',
        address: 'address-1',
        private_key: 'key-1'
      })
      .returning()
      .execute();

    const [wallet2] = await db.insert(walletsTable)
      .values({
        name: 'Wallet 2',
        address: 'address-2',
        private_key: 'key-2'
      })
      .returning()
      .execute();

    // Create token
    const [token] = await db.insert(tokensTable)
      .values({
        contract_address: 'test-token-address',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9
      })
      .returning()
      .execute();

    // Create transactions for both wallets
    await db.insert(transactionsTable)
      .values([
        {
          wallet_id: wallet1.id,
          token_id: token.id,
          type: 'buy',
          amount_sol: '1.0',
          token_quantity: '1000.0',
          price_per_token_sol: '0.001',
          status: 'completed'
        },
        {
          wallet_id: wallet2.id,
          token_id: token.id,
          type: 'buy',
          amount_sol: '2.0',
          token_quantity: '2000.0',
          price_per_token_sol: '0.001',
          status: 'completed'
        }
      ])
      .execute();

    const result = await getTransactions(wallet1.id);

    expect(result).toHaveLength(1);
    expect(result[0].wallet_id).toEqual(wallet1.id);
    expect(result[0].amount_sol).toEqual(1.0);
  });
});
