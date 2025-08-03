
import { db } from '../db';
import { settingsTable } from '../db/schema';
import { type UpdateSettingsInput, type Settings } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateSettings(input: UpdateSettingsInput): Promise<Settings> {
  try {
    // Check if settings exist for this wallet
    const existingSettings = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.wallet_id, input.wallet_id))
      .execute();

    let result;

    if (existingSettings.length === 0) {
      // Create new settings record
      const insertResult = await db.insert(settingsTable)
        .values({
          wallet_id: input.wallet_id,
          slippage_percentage: input.slippage_percentage?.toString() || '0.5',
          mev_protection: input.mev_protection ?? true,
          alert_mode: input.alert_mode || 'popup'
        })
        .returning()
        .execute();

      result = insertResult[0];
    } else {
      // Update existing settings
      const updateData: any = {
        updated_at: new Date()
      };

      if (input.slippage_percentage !== undefined) {
        updateData.slippage_percentage = input.slippage_percentage.toString();
      }
      if (input.mev_protection !== undefined) {
        updateData.mev_protection = input.mev_protection;
      }
      if (input.alert_mode !== undefined) {
        updateData.alert_mode = input.alert_mode;
      }

      const updateResult = await db.update(settingsTable)
        .set(updateData)
        .where(eq(settingsTable.wallet_id, input.wallet_id))
        .returning()
        .execute();

      result = updateResult[0];
    }

    // Convert numeric fields back to numbers
    return {
      ...result,
      slippage_percentage: parseFloat(result.slippage_percentage)
    };
  } catch (error) {
    console.error('Settings update failed:', error);
    throw error;
  }
}
