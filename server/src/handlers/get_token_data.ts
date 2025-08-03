
import { db } from '../db';
import { tokensTable } from '../db/schema';
import { type TokenDataInput, type Token } from '../schema';
import { eq } from 'drizzle-orm';

// Interface for Jupiter price API response
interface JupiterPriceResponse {
  data: {
    [key: string]: {
      id: string;
      mintSymbol: string;
      vsToken: string;
      vsTokenSymbol: string;
      price: number;
    };
  };
}

// Interface for Solana RPC response
interface SolanaRpcResponse {
  jsonrpc: string;
  id: number;
  result: {
    value: {
      data: {
        parsed: {
          info: {
            decimals?: number;
            symbol?: string;
            tokenAmount?: {
              uiAmount: number;
            };
          };
        };
      };
    } | null;
  };
}

// Interface for CoinGecko response
interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
  };
}

// Interface for Solana token metadata
interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

// Fetch token metadata from Solana RPC
async function fetchTokenMetadata(contractAddress: string): Promise<TokenMetadata | null> {
  try {
    // Use Solana mainnet RPC endpoint
    const rpcUrl = 'https://api.mainnet-beta.solana.com';
    
    // First, try to get token metadata using getAccountInfo
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          contractAddress,
          {
            encoding: 'jsonParsed',
          },
        ],
      }),
    });

    const data = await response.json() as SolanaRpcResponse;
    
    if (data.result?.value?.data?.parsed?.info) {
      const tokenInfo = data.result.value.data.parsed.info;
      return {
        name: tokenInfo.tokenAmount?.uiAmount ? `Token ${contractAddress.slice(0, 8)}` : 'Unknown Token',
        symbol: tokenInfo.symbol || contractAddress.slice(0, 6).toUpperCase(),
        decimals: tokenInfo.decimals || 9,
      };
    }

    // Fallback: try to get mint info
    const mintResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          contractAddress,
          {
            encoding: 'base64',
          },
        ],
      }),
    });

    const mintData = await mintResponse.json() as SolanaRpcResponse;
    
    if (mintData.result?.value) {
      // For basic mint accounts, we can extract decimals from the account data
      // This is a simplified approach - in production you might want to use a proper SPL token library
      return {
        name: `Token ${contractAddress.slice(0, 8)}`,
        symbol: contractAddress.slice(0, 6).toUpperCase(),
        decimals: 9, // Default SPL token decimals
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch token metadata:', error);
    return null;
  }
}

// Fetch token price from Jupiter API
async function fetchTokenPrice(contractAddress: string): Promise<number | null> {
  try {
    // Jupiter price API endpoint
    const response = await fetch(`https://price.jup.ag/v4/price?ids=${contractAddress}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as JupiterPriceResponse;
    
    if (data.data && data.data[contractAddress]) {
      return data.data[contractAddress].price;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch token price:', error);
    return null;
  }
}

// Fallback price fetching from CoinGecko (for well-known tokens)
async function fetchTokenPriceFromCoinGecko(contractAddress: string): Promise<number | null> {
  try {
    // CoinGecko API for Solana tokens
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${contractAddress}&vs_currencies=usd`
    );
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as CoinGeckoResponse;
    
    if (data[contractAddress] && data[contractAddress].usd) {
      return data[contractAddress].usd;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch token price from CoinGecko:', error);
    return null;
  }
}

export async function getTokenData(input: TokenDataInput): Promise<Token> {
  try {
    // Check if token already exists in database
    const existingTokens = await db.select()
      .from(tokensTable)
      .where(eq(tokensTable.contract_address, input.contract_address))
      .execute();

    let tokenData: Token;

    if (existingTokens.length > 0) {
      // Update existing token with fresh price data
      const existingToken = existingTokens[0];
      
      // Fetch fresh price data
      let priceUsd: number | null = null;
      
      // Try Jupiter API first
      priceUsd = await fetchTokenPrice(input.contract_address);
      
      // If Jupiter fails, try CoinGecko as fallback
      if (priceUsd === null) {
        priceUsd = await fetchTokenPriceFromCoinGecko(input.contract_address);
      }
      
      // Update price if we got new data
      if (priceUsd !== null) {
        const updateResult = await db.update(tokensTable)
          .set({
            price_usd: priceUsd.toString()
          })
          .where(eq(tokensTable.id, existingToken.id))
          .returning()
          .execute();

        tokenData = {
          ...updateResult[0],
          price_usd: parseFloat(updateResult[0].price_usd || '0')
        };
      } else {
        // Return existing token with numeric conversion
        tokenData = {
          ...existingToken,
          price_usd: existingToken.price_usd ? parseFloat(existingToken.price_usd) : null
        };
      }
    } else {
      // Fetch fresh token data from external sources
      const [metadata, priceUsd] = await Promise.all([
        fetchTokenMetadata(input.contract_address),
        fetchTokenPrice(input.contract_address)
      ]);

      // If Jupiter fails, try CoinGecko as fallback for price
      const fallbackPrice = priceUsd === null ? await fetchTokenPriceFromCoinGecko(input.contract_address) : null;
      const finalPrice = priceUsd || fallbackPrice;

      // Create new token record with fetched data
      const result = await db.insert(tokensTable)
        .values({
          contract_address: input.contract_address,
          name: metadata?.name || null,
          symbol: metadata?.symbol || null,
          decimals: metadata?.decimals || 9, // Default SPL token decimals
          price_usd: finalPrice ? finalPrice.toString() : null
        })
        .returning()
        .execute();

      const newToken = result[0];
      tokenData = {
        ...newToken,
        price_usd: newToken.price_usd ? parseFloat(newToken.price_usd) : null
      };
    }

    return tokenData;
  } catch (error) {
    console.error('Token data fetch failed:', error);
    throw error;
  }
}
