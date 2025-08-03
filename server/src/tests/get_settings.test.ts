
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, settingsTable } from '../db/schema';
import { getSettings } from '../handlers/get_settings';

describe('getSettings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return existing settings for a wallet', async () => {
    // Create a test wallet first
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-123',
        private_key: 'test-private-key'
      })
      .returning()
      .execute();

    const walletId = walletResult[0].id;

    // Create settings for the wallet
    await db.insert(settingsTable)
      .values({
        wallet_id: walletId,
        slippage_percentage: '1.5',
        mev_protection: false,
        alert_mode: 'silent'
      })
      .execute();

    const result = await getSettings(walletId);

    // Verify settings fields
    expect(result.wallet_id).toEqual(walletId);
    expect(result.slippage_percentage).toEqual(1.5);
    expect(typeof result.slippage_percentage).toEqual('number');
    expect(result.mev_protection).toEqual(false);
    expect(result.alert_mode).toEqual('silent');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should return default settings when none exist', async () => {
    const walletId = 999; // Non-existent wallet ID

    const result = await getSettings(walletId);

    // Verify default settings
    expect(result.id).toEqual(0);
    expect(result.wallet_id).toEqual(walletId);
    expect(result.slippage_percentage).toEqual(0.5);
    expect(result.mev_protection).toEqual(true);
    expect(result.alert_mode).toEqual('popup');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle numeric conversion correctly', async () => {
    // Create a test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test-address-456',
        private_key: 'test-private-key'
      })
      .returning()
      .execute();

    const walletId = walletResult[0].id;

    // Create settings with specific numeric value
    await db.insert(settingsTable)
      .values({
        wallet_id: walletId,
        slippage_percentage: '2.75'
      })
      .execute();

    const result = await getSettings(walletId);

    // Verify numeric conversion
    expect(typeof result.slippage_percentage).toEqual('number');
    expect(result.slippage_percentage).toEqual(2.75);
    expect(result.slippage_percentage).not.toEqual('2.75');
  });
});
