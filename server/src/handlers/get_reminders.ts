import { db } from '../db';
import { remindersTable } from '../db/schema';
import { type Reminder } from '../schema';
import { and, eq, lte } from 'drizzle-orm';

export const getReminders = async (): Promise<Reminder[]> => {
  try {
    // Get reminders that are scheduled and due to be sent (remind_at <= now)
    const now = new Date();
    
    const results = await db.select()
      .from(remindersTable)
      .where(
        and(
          eq(remindersTable.status, 'scheduled'),
          lte(remindersTable.remind_at, now)
        )
      )
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    throw error;
  }
};