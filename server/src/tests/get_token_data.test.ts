
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tokensTable } from '../db/schema';
import { type TokenDataInput } from '../schema';
import { getTokenData } from '../handlers/get_token_data';
import { eq } from 'drizzle-orm';

// Use a well-known Solana token address for testing (USDC)
const testInput: TokenDataInput = {
  contract_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
};

// Test with a custom/unknown token address
const unknownTokenInput: TokenDataInput = {
  contract_address: 'TestToken123456789012345678901234567890123'
};

describe('getTokenData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create new token with external data when not exists', async () => {
    const result = await getTokenData(testInput);

    expect(result.contract_address).toEqual(testInput.contract_address);
    expect(result.decimals).toBeGreaterThan(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    
    // Price might be fetched from external API
    if (result.price_usd !== null) {
      expect(typeof result.price_usd).toEqual('number');
      expect(result.price_usd).toBeGreaterThan(0);
    }
  });

  it('should save token to database with fetched data', async () => {
    const result = await getTokenData(testInput);

    const tokens = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.id, result.id))
      .execute();

    expect(tokens).toHaveLength(1);
    expect(tokens[0].contract_address).toEqual(testInput.contract_address);
    expect(tokens[0].decimals).toBeGreaterThan(0);
    expect(tokens[0].created_at).toBeInstanceOf(Date);
  });

  it('should return existing token and update price when already exists', async () => {
    // Create token first
    const firstResult = await getTokenData(testInput);

    // Call again with same contract address - should update price
    const secondResult = await getTokenData(testInput);

    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.contract_address).toEqual(testInput.contract_address);
    expect(secondResult.created_at).toEqual(firstResult.created_at);
    
    // Price might be updated on second call
    if (secondResult.price_usd !== null) {
      expect(typeof secondResult.price_usd).toEqual('number');
    }
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

  it('should handle token with existing price data correctly', async () => {
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

  it('should handle unknown tokens gracefully', async () => {
    const result = await getTokenData(unknownTokenInput);

    expect(result.contract_address).toEqual(unknownTokenInput.contract_address);
    expect(result.decimals).toEqual(9); // Default decimals
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    
    // Unknown tokens should have basic metadata or null values
    if (result.name) {
      expect(typeof result.name).toEqual('string');
    }
    if (result.symbol) {
      expect(typeof result.symbol).toEqual('string');
    }
  });

  it('should return number type for price_usd after database conversion', async () => {
    // Insert token with string price
    const insertResult = await db.insert(tokensTable)
      .values({
        contract_address: 'NumberTestToken',
        name: 'Number Test',
        symbol: 'NUM',
        decimals: 8,
        price_usd: '123.456789'
      })
      .execute();

    const result = await getTokenData({ contract_address: 'NumberTestToken' });

    expect(typeof result.price_usd).toEqual('number');
    expect(result.price_usd).toEqual(123.456789);
  });

  it('should fetch and store real-time price data', async () => {
    // This test validates the price fetching mechanism
    const result = await getTokenData(testInput);

    // Save the initial state
    const initialPrice = result.price_usd;

    // Wait a moment and fetch again to potentially get updated price
    await new Promise(resolve => setTimeout(resolve, 100));
    const updatedResult = await getTokenData(testInput);

    // Both results should have the same token ID (no duplicate creation)
    expect(updatedResult.id).toEqual(result.id);
    
    // Price should be a number if fetched successfully
    if (updatedResult.price_usd !== null) {
      expect(typeof updatedResult.price_usd).toEqual('number');
      expect(updatedResult.price_usd).toBeGreaterThan(0);
    }
  });
});
