import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentEventsTable, usersTable, workspacesTable } from '../db/schema';
import { type CreateAgentEventInput } from '../schema';
import { createAgentEvent } from '../handlers/create_agent_event';
import { eq } from 'drizzle-orm';

describe('createAgentEvent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let workspaceId: string;

  beforeEach(async () => {
    // Create prerequisite user and workspace
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4',
      })
      .returning()
      .execute();

    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userResult[0].id,
        name: 'Test Workspace',
        settings: {},
      })
      .returning()
      .execute();

    workspaceId = workspaceResult[0].id;
  });

  const testInput: CreateAgentEventInput = {
    workspace_id: '', // Will be set in each test
    agent: 'task_manager',
    action: 'create_task',
    input: {
      title: 'Review quarterly reports',
      priority: 'high',
      due_date: '2024-12-31'
    },
    status: 'draft'
  };

  it('should create an agent event with all fields', async () => {
    const input = { ...testInput, workspace_id: workspaceId };
    const result = await createAgentEvent(input);

    // Basic field validation
    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.agent).toEqual('task_manager');
    expect(result.action).toEqual('create_task');
    expect(result.input).toEqual({
      title: 'Review quarterly reports',
      priority: 'high',
      due_date: '2024-12-31'
    });
    expect(result.status).toEqual('draft');
    expect(result.output).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save agent event to database', async () => {
    const input = { ...testInput, workspace_id: workspaceId };
    const result = await createAgentEvent(input);

    // Query database to verify record was saved
    const agentEvents = await db.select()
      .from(agentEventsTable)
      .where(eq(agentEventsTable.id, result.id))
      .execute();

    expect(agentEvents).toHaveLength(1);
    expect(agentEvents[0].workspace_id).toEqual(workspaceId);
    expect(agentEvents[0].agent).toEqual('task_manager');
    expect(agentEvents[0].action).toEqual('create_task');
    expect(agentEvents[0].input).toEqual({
      title: 'Review quarterly reports',
      priority: 'high',
      due_date: '2024-12-31'
    });
    expect(agentEvents[0].status).toEqual('draft');
    expect(agentEvents[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle default status correctly', async () => {
    const inputWithDefaultStatus: CreateAgentEventInput = {
      workspace_id: workspaceId,
      agent: 'calendar_agent',
      action: 'schedule_meeting',
      input: { title: 'Team standup', duration: 30 },
      status: 'draft' // Uses the same default as the schema
    };

    const result = await createAgentEvent(inputWithDefaultStatus);

    expect(result.status).toEqual('draft'); // Should use default status
    expect(result.agent).toEqual('calendar_agent');
    expect(result.action).toEqual('schedule_meeting');
  });

  it('should handle different agent types and actions', async () => {
    const emailAgentInput = {
      workspace_id: workspaceId,
      agent: 'email_agent',
      action: 'send_summary',
      input: {
        recipients: ['user@example.com'],
        subject: 'Weekly Summary',
        template: 'weekly_report'
      },
      status: 'awaiting_confirmation' as const
    };

    const result = await createAgentEvent(emailAgentInput);

    expect(result.agent).toEqual('email_agent');
    expect(result.action).toEqual('send_summary');
    expect(result.status).toEqual('awaiting_confirmation');
    expect(result.input).toEqual({
      recipients: ['user@example.com'],
      subject: 'Weekly Summary',
      template: 'weekly_report'
    });
  });

  it('should handle complex input data structures', async () => {
    const complexInput = {
      workspace_id: workspaceId,
      agent: 'workflow_agent',
      action: 'execute_workflow',
      input: {
        workflow_id: 'wf-123',
        parameters: {
          filters: {
            status: ['todo', 'doing'],
            priority: 'high'
          },
          actions: [
            { type: 'notify', target: 'assignee' },
            { type: 'update', field: 'priority', value: 'urgent' }
          ]
        },
        metadata: {
          triggered_by: 'schedule',
          execution_time: '2024-01-15T10:00:00Z'
        }
      },
      status: 'draft' as const
    };

    const result = await createAgentEvent(complexInput);

    expect(result.input).toEqual(complexInput.input);
    expect(result.agent).toEqual('workflow_agent');
    expect(result.action).toEqual('execute_workflow');
    expect(typeof result.input).toEqual('object');
    expect(result.input['workflow_id']).toEqual('wf-123');
  });

  it('should throw error for invalid workspace reference', async () => {
    const invalidInput = {
      ...testInput,
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' // Non-existent UUID
    };

    await expect(createAgentEvent(invalidInput))
      .rejects
      .toThrow(/violates foreign key constraint/i);
  });
});