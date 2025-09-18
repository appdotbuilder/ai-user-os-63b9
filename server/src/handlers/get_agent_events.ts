import { db } from '../db';
import { agentEventsTable } from '../db/schema';
import { type AgentEvent } from '../schema';
import { eq, and, or, desc } from 'drizzle-orm';

export const getAgentEvents = async (workspaceId: string): Promise<AgentEvent[]> => {
  try {
    // Query agent events for the workspace
    // Focus on draft and awaiting_confirmation events for user review
    const results = await db.select()
      .from(agentEventsTable)
      .where(
        and(
          eq(agentEventsTable.workspace_id, workspaceId),
          or(
            eq(agentEventsTable.status, 'draft'),
            eq(agentEventsTable.status, 'awaiting_confirmation')
          )
        )
      )
      .orderBy(desc(agentEventsTable.created_at))
      .execute();

    // Type cast the JSON fields to match the schema expectations
    return results.map(result => ({
      ...result,
      input: result.input as Record<string, any>,
      output: result.output as Record<string, any> | null
    }));
  } catch (error) {
    console.error('Get agent events failed:', error);
    throw error;
  }
};