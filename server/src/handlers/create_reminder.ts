import { db } from '../db';
import { remindersTable, tasksTable } from '../db/schema';
import { type CreateReminderInput, type Reminder } from '../schema';
import { eq } from 'drizzle-orm';

export const createReminder = async (input: CreateReminderInput): Promise<Reminder> => {
  try {
    // Verify that the task exists before creating the reminder
    const taskExists = await db.select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.id, input.task_id))
      .execute();

    if (taskExists.length === 0) {
      throw new Error(`Task with id ${input.task_id} not found`);
    }

    // Insert reminder record
    const result = await db.insert(remindersTable)
      .values({
        task_id: input.task_id,
        remind_at: input.remind_at,
        method: input.method,
        status: 'scheduled' // Default status for new reminders
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Reminder creation failed:', error);
    throw error;
  }
};