import { db } from '../db';
import { agentEventsTable } from '../db/schema';
import { type CreateAgentEventInput, type AgentEvent } from '../schema';

export const createAgentEvent = async (input: CreateAgentEventInput): Promise<AgentEvent> => {
  try {
    // Insert agent event record
    const result = await db.insert(agentEventsTable)
      .values({
        workspace_id: input.workspace_id,
        agent: input.agent,
        action: input.action,
        input: input.input,
        status: input.status, // Defaults to 'draft' if not provided
      })
      .returning()
      .execute();

    // Return the created agent event with proper typing
    const agentEvent = result[0];
    return {
      ...agentEvent,
      input: agentEvent.input as Record<string, any>,
      output: agentEvent.output as Record<string, any> | null,
    };
  } catch (error) {
    console.error('Agent event creation failed:', error);
    throw error;
  }
};