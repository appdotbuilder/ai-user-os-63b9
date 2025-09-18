import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type UpdateAgentEventInput, type CreateUserInput, type CreateWorkspaceInput, type CreateAgentEventInput } from '../schema';
import { updateAgentEvent } from '../handlers/update_agent_event';
import { eq } from 'drizzle-orm';

describe('updateAgentEvent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: string;
  let testWorkspaceId: string;
  let testAgentEventId: string;

  beforeEach(async () => {
    // Create prerequisite user
    const userInput: CreateUserInput = {
      email: 'test@example.com',
      display_name: 'Test User',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4'
    };

    const userResult = await db.insert(usersTable)
      .values(userInput)
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create prerequisite workspace
    const workspaceInput: CreateWorkspaceInput = {
      owner_id: testUserId,
      name: 'Test Workspace',
      settings: {}
    };

    const workspaceResult = await db.insert(workspacesTable)
      .values(workspaceInput)
      .returning()
      .execute();
    testWorkspaceId = workspaceResult[0].id;

    // Create prerequisite agent event
    const agentEventInput: CreateAgentEventInput = {
      workspace_id: testWorkspaceId,
      agent: 'calendar_agent',
      action: 'create_meeting',
      input: { title: 'Test Meeting', start: '2024-01-01T10:00:00Z' },
      status: 'draft'
    };

    const agentEventResult = await db.insert(agentEventsTable)
      .values(agentEventInput)
      .returning()
      .execute();
    testAgentEventId = agentEventResult[0].id;
  });

  it('should update agent event status', async () => {
    const input: UpdateAgentEventInput = {
      id: testAgentEventId,
      status: 'executed'
    };

    const result = await updateAgentEvent(input);

    expect(result.id).toEqual(testAgentEventId);
    expect(result.status).toEqual('executed');
    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.agent).toEqual('calendar_agent');
    expect(result.action).toEqual('create_meeting');
    expect(result.output).toBeNull();
  });

  it('should update agent event status and output', async () => {
    const output = { meeting_id: 'cal-123', success: true };
    const input: UpdateAgentEventInput = {
      id: testAgentEventId,
      status: 'executed',
      output: output
    };

    const result = await updateAgentEvent(input);

    expect(result.id).toEqual(testAgentEventId);
    expect(result.status).toEqual('executed');
    expect(result.output).toEqual(output);
    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.agent).toEqual('calendar_agent');
  });

  it('should update agent event to error status with error output', async () => {
    const errorOutput = { error: 'Calendar API failed', code: 'API_ERROR' };
    const input: UpdateAgentEventInput = {
      id: testAgentEventId,
      status: 'error',
      output: errorOutput
    };

    const result = await updateAgentEvent(input);

    expect(result.id).toEqual(testAgentEventId);
    expect(result.status).toEqual('error');
    expect(result.output).toEqual(errorOutput);
  });

  it('should save changes to database', async () => {
    const output = { result: 'confirmed' };
    const input: UpdateAgentEventInput = {
      id: testAgentEventId,
      status: 'awaiting_confirmation',
      output: output
    };

    await updateAgentEvent(input);

    // Verify changes were saved to database
    const agentEvents = await db.select()
      .from(agentEventsTable)
      .where(eq(agentEventsTable.id, testAgentEventId))
      .execute();

    expect(agentEvents).toHaveLength(1);
    expect(agentEvents[0].status).toEqual('awaiting_confirmation');
    expect(agentEvents[0].output).toEqual(output);
  });

  it('should update status without changing output when output not provided', async () => {
    // First set some output
    await db.update(agentEventsTable)
      .set({ output: { initial: 'data' } })
      .where(eq(agentEventsTable.id, testAgentEventId))
      .execute();

    const input: UpdateAgentEventInput = {
      id: testAgentEventId,
      status: 'executed'
    };

    const result = await updateAgentEvent(input);

    expect(result.status).toEqual('executed');
    expect(result.output).toEqual({ initial: 'data' }); // Should preserve existing output
  });

  it('should set output to null when explicitly provided', async () => {
    // First set some output
    await db.update(agentEventsTable)
      .set({ output: { initial: 'data' } })
      .where(eq(agentEventsTable.id, testAgentEventId))
      .execute();

    const input: UpdateAgentEventInput = {
      id: testAgentEventId,
      status: 'executed',
      output: null
    };

    const result = await updateAgentEvent(input);

    expect(result.status).toEqual('executed');
    expect(result.output).toBeNull();
  });

  it('should throw error when agent event does not exist', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const input: UpdateAgentEventInput = {
      id: nonExistentId,
      status: 'executed'
    };

    expect(updateAgentEvent(input)).rejects.toThrow(/not found/i);
  });

  it('should handle complex output data structures', async () => {
    const complexOutput = {
      calendar_event: {
        id: 'evt-123',
        title: 'Updated Meeting',
        attendees: ['user1@example.com', 'user2@example.com'],
        metadata: {
          source: 'agent_created',
          version: 1
        }
      },
      notifications_sent: ['email', 'app_push'],
      execution_time_ms: 1250
    };

    const input: UpdateAgentEventInput = {
      id: testAgentEventId,
      status: 'executed',
      output: complexOutput
    };

    const result = await updateAgentEvent(input);

    expect(result.status).toEqual('executed');
    expect(result.output).toEqual(complexOutput);
    expect((result.output as any)['calendar_event']['title']).toEqual('Updated Meeting');
    expect((result.output as any)['notifications_sent']).toHaveLength(2);
  });
});