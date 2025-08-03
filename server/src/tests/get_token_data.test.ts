
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tokensTable } from '../db/schema';
import { type TokenDataInput } from '../schema';
import { getTokenData } from '../handlers/get_token_data';
import { eq } from 'drizzle-orm';

const testInput: TokenDataInput = {
  contract_address: 'So11111111111111111111111111111111111111112'
};

describe('getTokenData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create new token when not exists', async () => {
    const result = await getTokenData(testInput);

    expect(result.contract_address).toEqual(testInput.contract_address);
    expect(result.name).toBeNull();
    expect(result.symbol).toBeNull();
    expect(result.decimals).toEqual(9);
    expect(result.price_usd).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save token to database', async () => {
    const result = await getTokenData(testInput);

    const tokens = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.id, result.id))
      .execute();

    expect(tokens).toHaveLength(1);
    expect(tokens[0].contract_address).toEqual(testInput.contract_address);
    expect(tokens[0].decimals).toEqual(9);
    expect(tokens[0].created_at).toBeInstanceOf(Date);
  });

  it('should return existing token when already exists', async () => {
    // Create token first
    const firstResult = await getTokenData(testInput);

    // Call again with same contract address
    const secondResult = await getTokenData(testInput);

    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.contract_address).toEqual(testInput.contract_address);
    expect(secondResult.created_at).toEqual(firstResult.created_at);
  });

  it('should not create duplicate tokens', async () => {
    // Call twice with same contract address
    await getTokenData(testInput);
    await getTokenData(testInput);

    const tokens = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.contract_address, testInput.contract_address))
      .execute();

    expect(tokens).toHaveLength(1);
  });

  it('should handle token with price data correctly', async () => {
    // Insert token with price data directly
    await db.insert(tokensTable)
      .values({
        contract_address: 'TokenWithPrice123',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 6,
        price_usd: '45.67'
      })
      .execute();

    const result = await getTokenData({ contract_address: 'TokenWithPrice123' });

    expect(result.price_usd).toEqual(45.67);
    expect(typeof result.price_usd).toEqual('number');
    expect(result.name).toEqual('Test Token');
    expect(result.symbol).toEqual('TEST');
    expect(result.decimals).toEqual(6);
  });
});
