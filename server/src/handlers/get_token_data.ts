
import { db } from '../db';
import { tokensTable } from '../db/schema';
import { type TokenDataInput, type Token } from '../schema';
import { eq } from 'drizzle-orm';

export async function getTokenData(input: TokenDataInput): Promise<Token> {
  try {
    // Check if token already exists in database
    const existingTokens = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.contract_address, input.contract_address))
      .execute();

    if (existingTokens.length > 0) {
      // Return existing token with numeric conversions
      const token = existingTokens[0];
      return {
        ...token,
        price_usd: token.price_usd ? parseFloat(token.price_usd) : null
      };
    }

    // Create new token record with placeholder data
    // In a real implementation, this would fetch from Solana blockchain/APIs
    const result = await db.insert(tokensTable)
      .values({
        contract_address: input.contract_address,
        name: null,
        symbol: null,
        decimals: 9, // Default SPL token decimals
        price_usd: null
      })
      .returning()
      .execute();

    const newToken = result[0];
    return {
      ...newToken,
      price_usd: newToken.price_usd ? parseFloat(newToken.price_usd) : null
    };
  } catch (error) {
    console.error('Token data fetch failed:', error);
    throw error;
  }
}
