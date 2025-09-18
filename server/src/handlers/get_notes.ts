import { db } from '../db';
import { notesTable } from '../db/schema';
import { type GetNotesQuery, type Note } from '../schema';
import { eq, desc, and, type SQL } from 'drizzle-orm';

export const getNotes = async (query: GetNotesQuery): Promise<Note[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];
    
    // Always filter by workspace_id
    conditions.push(eq(notesTable.workspace_id, query.workspace_id));

    // Optional source filter
    if (query.source) {
      conditions.push(eq(notesTable.source, query.source));
    }

    // Build the complete query in one chain
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const baseQuery = db.select()
      .from(notesTable)
      .where(whereCondition)
      .orderBy(desc(notesTable.created_at));

    // Apply limit if provided
    const finalQuery = query.limit ? baseQuery.limit(query.limit) : baseQuery;

    const results = await finalQuery.execute();

    // Convert results to proper Note type, ensuring entities field is properly typed
    return results.map(note => ({
      ...note,
      entities: note.entities as Record<string, any> | null
    }));
  } catch (error) {
    console.error('Failed to get notes:', error);
    throw error;
  }
};