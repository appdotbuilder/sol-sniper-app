
import { db } from '../db';
import { walletsTable } from '../db/schema';
import { type ImportWalletInput, type Wallet } from '../schema';

export async function importWallet(input: ImportWalletInput): Promise<Wallet> {
  try {
    // Validate private key format (base58-like string)
    if (!input.private_key || input.private_key.length < 32) {
      throw new Error('Invalid private key format. Private key must be at least 32 characters long.');
    }

    // Check if private key contains only valid base58 characters (excludes 0, O, I, l)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(input.private_key)) {
      throw new Error('Invalid private key format. Private key must be a valid base58 encoded string.');
    }

    // Generate a deterministic address from private key (mock implementation)
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    let address = '';
    
    // Create a hash from the private key
    let hash = 0;
    for (let i = 0; i < input.private_key.length; i++) {
      hash = ((hash << 5) - hash + input.private_key.charCodeAt(i)) & 0xffffffff;
    }
    
    // Generate exactly 44 characters by using the hash and private key characters
    for (let i = 0; i < 44; i++) {
      // Use different parts of the private key and hash for each position
      const seedValue = i < input.private_key.length 
        ? input.private_key.charCodeAt(i) + hash + i
        : hash + i * 31 + input.private_key.charCodeAt(i % input.private_key.length);
      
      const index = Math.abs(seedValue) % base58Chars.length;
      address += base58Chars[index];
    }

    // Insert wallet record
    const result = await db.insert(walletsTable)
      .values({
        name: input.name,
        address: address,
        private_key: input.private_key,
        sol_balance: '0', // Convert number to string for numeric column
        is_active: false
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const wallet = result[0];
    return {
      ...wallet,
      sol_balance: parseFloat(wallet.sol_balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Wallet import failed:', error);
    throw error;
  }
}
