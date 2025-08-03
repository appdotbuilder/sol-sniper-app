
import { db } from '../db';
import { settingsTable } from '../db/schema';
import { type Settings } from '../schema';
import { eq } from 'drizzle-orm';

export async function getSettings(walletId: number): Promise<Settings> {
  try {
    // Query settings for the specified wallet
    const results = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.wallet_id, walletId))
      .execute();

    if (results.length > 0) {
      // Convert numeric fields back to numbers
      const settings = results[0];
      return {
        ...settings,
        slippage_percentage: parseFloat(settings.slippage_percentage)
      };
    }

    // Return default settings if none exist
    const defaultSettings: Settings = {
      id: 0,
      wallet_id: walletId,
      slippage_percentage: 0.5,
      mev_protection: true,
      alert_mode: 'popup',
      created_at: new Date(),
      updated_at: new Date()
    };

    return defaultSettings;
  } catch (error) {
    console.error('Get settings failed:', error);
    throw error;
  }
}
