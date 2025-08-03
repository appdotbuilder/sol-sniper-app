
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, settingsTable } from '../db/schema';
import { type UpdateSettingsInput } from '../schema';
import { updateSettings } from '../handlers/update_settings';
import { eq } from 'drizzle-orm';

describe('updateSettings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testWalletId: number;

  beforeEach(async () => {
    // Create a test wallet first
    const walletResult = await db.insert(walletsTable)
      .values({
        name: 'Test Wallet',
        address: 'test_address_123',
        private_key: 'test_private_key'
      })
      .returning()
      .execute();

    testWalletId = walletResult[0].id;
  });

  it('should create new settings when none exist', async () => {
    const input: UpdateSettingsInput = {
      wallet_id: testWalletId,
      slippage_percentage: 1.5,
      mev_protection: false,
      alert_mode: 'silent'
    };

    const result = await updateSettings(input);

    expect(result.wallet_id).toEqual(testWalletId);
    expect(result.slippage_percentage).toEqual(1.5);
    expect(result.mev_protection).toEqual(false);
    expect(result.alert_mode).toEqual('silent');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should use defaults when creating new settings with partial input', async () => {
    const input: UpdateSettingsInput = {
      wallet_id: testWalletId,
      slippage_percentage: 2.0
    };

    const result = await updateSettings(input);

    expect(result.wallet_id).toEqual(testWalletId);
    expect(result.slippage_percentage).toEqual(2.0);
    expect(result.mev_protection).toEqual(true); // Default
    expect(result.alert_mode).toEqual('popup'); // Default
  });

  it('should update existing settings', async () => {
    // Create initial settings
    await db.insert(settingsTable)
      .values({
        wallet_id: testWalletId,
        slippage_percentage: '1.0',
        mev_protection: true,
        alert_mode: 'popup'
      })
      .execute();

    const input: UpdateSettingsInput = {
      wallet_id: testWalletId,
      slippage_percentage: 3.0,
      mev_protection: false
    };

    const result = await updateSettings(input);

    expect(result.wallet_id).toEqual(testWalletId);
    expect(result.slippage_percentage).toEqual(3.0);
    expect(result.mev_protection).toEqual(false);
    expect(result.alert_mode).toEqual('popup'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save settings to database correctly', async () => {
    const input: UpdateSettingsInput = {
      wallet_id: testWalletId,
      slippage_percentage: 2.5,
      mev_protection: false,
      alert_mode: 'silent'
    };

    const result = await updateSettings(input);

    // Verify in database
    const settings = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.wallet_id, testWalletId))
      .execute();

    expect(settings).toHaveLength(1);
    expect(settings[0].wallet_id).toEqual(testWalletId);
    expect(parseFloat(settings[0].slippage_percentage)).toEqual(2.5);
    expect(settings[0].mev_protection).toEqual(false);
    expect(settings[0].alert_mode).toEqual('silent');
  });

  it('should update only specified fields', async () => {
    // Create initial settings
    await db.insert(settingsTable)
      .values({
        wallet_id: testWalletId,
        slippage_percentage: '1.0',
        mev_protection: true,
        alert_mode: 'popup'
      })
      .execute();

    const input: UpdateSettingsInput = {
      wallet_id: testWalletId,
      alert_mode: 'silent'
    };

    const result = await updateSettings(input);

    expect(result.slippage_percentage).toEqual(1.0); // Unchanged
    expect(result.mev_protection).toEqual(true); // Unchanged
    expect(result.alert_mode).toEqual('silent'); // Updated
  });

  it('should handle numeric conversion correctly', async () => {
    const input: UpdateSettingsInput = {
      wallet_id: testWalletId,
      slippage_percentage: 0.25
    };

    const result = await updateSettings(input);

    expect(typeof result.slippage_percentage).toEqual('number');
    expect(result.slippage_percentage).toEqual(0.25);

    // Verify stored as string in database
    const dbSettings = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.wallet_id, testWalletId))
      .execute();

    expect(typeof dbSettings[0].slippage_percentage).toEqual('string');
    expect(parseFloat(dbSettings[0].slippage_percentage)).toEqual(0.25);
  });
});
