import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type CreateUserInput, type CreateWorkspaceInput, type CreateAgentEventInput } from '../schema';
import { getAgentEvents } from '../handlers/get_agent_events';

// Test data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

const testWorkspace: CreateWorkspaceInput = {
  name: 'Test Workspace',
  settings: { theme: 'dark' },
  owner_id: '' // Will be set after user creation
};

const testAgentEvent1: CreateAgentEventInput = {
  workspace_id: '', // Will be set after workspace creation
  agent: 'calendar',
  action: 'create_event',
  input: { title: 'Meeting', start: '2024-01-01T10:00:00Z' },
  status: 'draft'
};

const testAgentEvent2: CreateAgentEventInput = {
  workspace_id: '', // Will be set after workspace creation
  agent: 'task_manager',
  action: 'create_task',
  input: { title: 'Review document', priority: 'high' },
  status: 'awaiting_confirmation'
};

const testAgentEvent3: CreateAgentEventInput = {
  workspace_id: '', // Will be set after workspace creation
  agent: 'email',
  action: 'send_message',
  input: { to: 'user@example.com', subject: 'Update' },
  status: 'executed'
};

describe('getAgentEvents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return agent events for a workspace', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create workspace
    const workspaceInput = { ...testWorkspace, owner_id: userId };
    const workspaceResult = await db.insert(workspacesTable)
      .values(workspaceInput)
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create agent events
    const event1Input = { ...testAgentEvent1, workspace_id: workspaceId };
    const event2Input = { ...testAgentEvent2, workspace_id: workspaceId };
    
    await db.insert(agentEventsTable)
      .values([event1Input, event2Input])
      .execute();

    // Test the handler
    const result = await getAgentEvents(workspaceId);

    expect(result).toHaveLength(2);
    
    // Verify both events are returned (order may vary due to same timestamp)
    const agents = result.map(event => event.agent);
    const statuses = result.map(event => event.status);
    
    expect(agents).toContain('task_manager');
    expect(agents).toContain('calendar');
    expect(statuses).toContain('awaiting_confirmation');
    expect(statuses).toContain('draft');
    
    // Find specific events and verify their content
    const calendarEvent = result.find(event => event.agent === 'calendar');
    const taskEvent = result.find(event => event.agent === 'task_manager');
    
    expect(calendarEvent).toBeDefined();
    expect(calendarEvent?.action).toEqual('create_event');
    expect(calendarEvent?.status).toEqual('draft');
    expect(calendarEvent?.input).toEqual({ title: 'Meeting', start: '2024-01-01T10:00:00Z' });
    
    expect(taskEvent).toBeDefined();
    expect(taskEvent?.action).toEqual('create_task');
    expect(taskEvent?.status).toEqual('awaiting_confirmation');
    expect(taskEvent?.input).toEqual({ title: 'Review document', priority: 'high' });

    // Verify common fields
    result.forEach(event => {
      expect(event.id).toBeDefined();
      expect(event.workspace_id).toEqual(workspaceId);
      expect(event.created_at).toBeInstanceOf(Date);
    });
  });

  it('should only return draft and awaiting_confirmation events', async () => {
    // Create user and workspace
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const workspaceInput = { ...testWorkspace, owner_id: userId };
    const workspaceResult = await db.insert(workspacesTable)
      .values(workspaceInput)
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create events with different statuses
    const event1Input = { ...testAgentEvent1, workspace_id: workspaceId };
    const event2Input = { ...testAgentEvent2, workspace_id: workspaceId };
    const event3Input = { ...testAgentEvent3, workspace_id: workspaceId }; // executed status
    
    await db.insert(agentEventsTable)
      .values([event1Input, event2Input, event3Input])
      .execute();

    const result = await getAgentEvents(workspaceId);

    // Should only return draft and awaiting_confirmation events
    expect(result).toHaveLength(2);
    
    const statuses = result.map(event => event.status);
    expect(statuses).toContain('draft');
    expect(statuses).toContain('awaiting_confirmation');
    expect(statuses).not.toContain('executed');
  });

  it('should return empty array for workspace with no pending events', async () => {
    // Create user and workspace
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const workspaceInput = { ...testWorkspace, owner_id: userId };
    const workspaceResult = await db.insert(workspacesTable)
      .values(workspaceInput)
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create only executed/error events
    const executedEvent = { ...testAgentEvent3, workspace_id: workspaceId };
    const errorEvent = { 
      ...testAgentEvent1, 
      workspace_id: workspaceId, 
      status: 'error' as const 
    };
    
    await db.insert(agentEventsTable)
      .values([executedEvent, errorEvent])
      .execute();

    const result = await getAgentEvents(workspaceId);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent workspace', async () => {
    const nonExistentWorkspaceId = '550e8400-e29b-41d4-a716-446655440000';
    
    const result = await getAgentEvents(nonExistentWorkspaceId);

    expect(result).toHaveLength(0);
  });

  it('should filter events by workspace correctly', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create two workspaces
    const workspace1Input = { ...testWorkspace, name: 'Workspace 1', owner_id: userId };
    const workspace2Input = { ...testWorkspace, name: 'Workspace 2', owner_id: userId };
    
    const workspace1Result = await db.insert(workspacesTable)
      .values(workspace1Input)
      .returning()
      .execute();
    const workspace1Id = workspace1Result[0].id;

    const workspace2Result = await db.insert(workspacesTable)
      .values(workspace2Input)
      .returning()
      .execute();
    const workspace2Id = workspace2Result[0].id;

    // Create events for both workspaces
    const event1 = { ...testAgentEvent1, workspace_id: workspace1Id };
    const event2 = { ...testAgentEvent2, workspace_id: workspace2Id };
    
    await db.insert(agentEventsTable)
      .values([event1, event2])
      .execute();

    // Test workspace 1
    const result1 = await getAgentEvents(workspace1Id);
    expect(result1).toHaveLength(1);
    expect(result1[0].workspace_id).toEqual(workspace1Id);
    expect(result1[0].agent).toEqual('calendar');

    // Test workspace 2
    const result2 = await getAgentEvents(workspace2Id);
    expect(result2).toHaveLength(1);
    expect(result2[0].workspace_id).toEqual(workspace2Id);
    expect(result2[0].agent).toEqual('task_manager');
  });

  it('should handle events with null output field', async () => {
    // Create user and workspace
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const workspaceInput = { ...testWorkspace, owner_id: userId };
    const workspaceResult = await db.insert(workspacesTable)
      .values(workspaceInput)
      .returning()
      .execute();
    const workspaceId = workspaceResult[0].id;

    // Create event without output (draft status)
    const eventInput = { ...testAgentEvent1, workspace_id: workspaceId };
    
    await db.insert(agentEventsTable)
      .values(eventInput)
      .execute();

    const result = await getAgentEvents(workspaceId);

    expect(result).toHaveLength(1);
    expect(result[0].output).toBeNull();
    expect(result[0].status).toEqual('draft');
  });
});