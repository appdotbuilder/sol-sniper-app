
import { db } from '../db';
import { limitOrdersTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function cancelLimitOrder(orderId: number): Promise<{ success: boolean }> {
  try {
    // Update the limit order to set is_active to false
    const result = await db.update(limitOrdersTable)
      .set({ is_active: false })
      .where(eq(limitOrdersTable.id, orderId))
      .returning()
      .execute();

    // Return success if at least one row was updated
    return { success: result.length > 0 };
  } catch (error) {
    console.error('Limit order cancellation failed:', error);
    throw error;
  }
}
