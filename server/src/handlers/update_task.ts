import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type UpdateTaskInput, type Task } from '../schema';
import { eq } from 'drizzle-orm';

export const updateTask = async (input: UpdateTaskInput): Promise<Task> => {
  try {
    // First, check if the task exists
    const existingTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, input.id))
      .execute();

    if (existingTask.length === 0) {
      throw new Error(`Task with ID ${input.id} not found`);
    }

    // Build update values object with only provided fields
    const updateValues: Partial<typeof tasksTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateValues.title = input.title;
    }

    if (input.description !== undefined) {
      updateValues.description = input.description;
    }

    if (input.status !== undefined) {
      updateValues.status = input.status;
    }

    if (input.priority !== undefined) {
      updateValues.priority = input.priority;
    }

    if (input.due_at !== undefined) {
      updateValues.due_at = input.due_at;
    }

    if (input.assignee_id !== undefined) {
      updateValues.assignee_id = input.assignee_id;
    }

    // Update the task
    const result = await db.update(tasksTable)
      .set(updateValues)
      .where(eq(tasksTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task update failed:', error);
    throw error;
  }
};