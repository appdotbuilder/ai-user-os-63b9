import { db } from '../db';
import { agentEventsTable } from '../db/schema';
import { type UpdateAgentEventInput, type AgentEvent } from '../schema';
import { eq } from 'drizzle-orm';

export const updateAgentEvent = async (input: UpdateAgentEventInput): Promise<AgentEvent> => {
  try {
    // Build update values object
    const updateValues: any = {
      status: input.status,
    };

    // Only update output if provided
    if (input.output !== undefined) {
      updateValues.output = input.output;
    }

    // Update agent event record
    const result = await db.update(agentEventsTable)
      .set(updateValues)
      .where(eq(agentEventsTable.id, input.id))
      .returning()
      .execute();

    // Check if agent event exists
    if (result.length === 0) {
      throw new Error(`Agent event with id ${input.id} not found`);
    }

    return result[0] as AgentEvent;
  } catch (error) {
    console.error('Agent event update failed:', error);
    throw error;
  }
};