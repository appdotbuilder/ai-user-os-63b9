import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type GetTasksQuery, type Task } from '../schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

export const getTasks = async (query: GetTasksQuery): Promise<Task[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Always filter by workspace_id (required field)
    conditions.push(eq(tasksTable.workspace_id, query.workspace_id));

    // Add optional filters
    if (query.status) {
      conditions.push(eq(tasksTable.status, query.status));
    }

    if (query.priority) {
      conditions.push(eq(tasksTable.priority, query.priority));
    }

    if (query.assignee_id) {
      conditions.push(eq(tasksTable.assignee_id, query.assignee_id));
    }

    // Build query with proper ordering
    const results = await db.select()
      .from(tasksTable)
      .where(and(...conditions))
      .orderBy(
        desc(tasksTable.priority),
        tasksTable.due_at,
        desc(tasksTable.created_at)
      )
      .execute();

    // Return results (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Get tasks failed:', error);
    throw error;
  }
};