import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable } from '../db/schema';
import { type GetTasksQuery } from '../schema';
import { getTasks } from '../handlers/get_tasks';

describe('getTasks', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: string;
  let workspaceId: string;
  let otherWorkspaceId: string;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    userId = user[0].id;

    // Create test workspaces
    const workspace = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    workspaceId = workspace[0].id;

    const otherWorkspace = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Other Workspace',
        settings: {}
      })
      .returning()
      .execute();
    otherWorkspaceId = otherWorkspace[0].id;
  });

  it('should return empty array when no tasks exist', async () => {
    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const result = await getTasks(query);

    expect(result).toEqual([]);
  });

  it('should return all tasks for workspace without filters', async () => {
    // Create test tasks
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Task 1',
          status: 'todo',
          priority: 'high',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Task 2',
          status: 'doing',
          priority: 'low',
          assignee_id: userId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(2);
    expect(result.map(t => t.title)).toContain('Task 1');
    expect(result.map(t => t.title)).toContain('Task 2');
  });

  it('should filter tasks by status', async () => {
    // Create tasks with different statuses
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Todo Task',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Doing Task',
          status: 'doing',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Done Task',
          status: 'done',
          priority: 'med',
          assignee_id: userId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      status: 'doing'
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Doing Task');
    expect(result[0].status).toEqual('doing');
  });

  it('should filter tasks by priority', async () => {
    // Create tasks with different priorities
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'High Priority Task',
          status: 'todo',
          priority: 'high',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Medium Priority Task',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Low Priority Task',
          status: 'todo',
          priority: 'low',
          assignee_id: userId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      priority: 'high'
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('High Priority Task');
    expect(result[0].priority).toEqual('high');
  });

  it('should filter tasks by assignee_id', async () => {
    // Create another user
    const otherUser = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        display_name: 'Other User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const otherUserId = otherUser[0].id;

    // Create tasks with different assignees
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'My Task',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Other Task',
          status: 'todo',
          priority: 'med',
          assignee_id: otherUserId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      assignee_id: userId
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('My Task');
    expect(result[0].assignee_id).toEqual(userId);
  });

  it('should filter by multiple criteria', async () => {
    // Create another user
    const otherUser = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        display_name: 'Other User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    const otherUserId = otherUser[0].id;

    // Create various tasks
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Match All Criteria',
          status: 'doing',
          priority: 'high',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Wrong Status',
          status: 'todo',
          priority: 'high',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Wrong Priority',
          status: 'doing',
          priority: 'low',
          assignee_id: userId
        },
        {
          workspace_id: workspaceId,
          title: 'Wrong Assignee',
          status: 'doing',
          priority: 'high',
          assignee_id: otherUserId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId,
      status: 'doing',
      priority: 'high',
      assignee_id: userId
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Match All Criteria');
  });

  it('should only return tasks from specified workspace', async () => {
    // Create tasks in both workspaces
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Task in Target Workspace',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        },
        {
          workspace_id: otherWorkspaceId,
          title: 'Task in Other Workspace',
          status: 'todo',
          priority: 'med',
          assignee_id: userId
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Task in Target Workspace');
    expect(result[0].workspace_id).toEqual(workspaceId);
  });

  it('should return tasks ordered by priority, due_at, and created_at', async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Create tasks with different priorities and due dates
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspaceId,
          title: 'Low Priority, No Due Date',
          status: 'todo',
          priority: 'low',
          assignee_id: userId,
          due_at: null
        },
        {
          workspace_id: workspaceId,
          title: 'High Priority, Due Tomorrow',
          status: 'todo',
          priority: 'high',
          assignee_id: userId,
          due_at: tomorrow
        },
        {
          workspace_id: workspaceId,
          title: 'High Priority, Due Next Week',
          status: 'todo',
          priority: 'high',
          assignee_id: userId,
          due_at: nextWeek
        },
        {
          workspace_id: workspaceId,
          title: 'Medium Priority, No Due Date',
          status: 'todo',
          priority: 'med',
          assignee_id: userId,
          due_at: null
        }
      ])
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(4);
    
    // Should be ordered: high priority tasks first, then med, then low
    // Within same priority, earliest due date first
    const titles = result.map(t => t.title);
    
    // High priority tasks should come first
    expect(titles[0]).toEqual('High Priority, Due Tomorrow');
    expect(titles[1]).toEqual('High Priority, Due Next Week');
    
    // Then medium priority
    expect(titles[2]).toEqual('Medium Priority, No Due Date');
    
    // Then low priority
    expect(titles[3]).toEqual('Low Priority, No Due Date');
  });

  it('should include all task fields', async () => {
    await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Complete Task',
        description: 'Task description',
        status: 'doing',
        priority: 'high',
        due_at: new Date(),
        assignee_id: userId
      })
      .execute();

    const query: GetTasksQuery = {
      workspace_id: workspaceId
    };

    const result = await getTasks(query);

    expect(result).toHaveLength(1);
    const task = result[0];
    
    expect(task.id).toBeDefined();
    expect(task.workspace_id).toEqual(workspaceId);
    expect(task.title).toEqual('Complete Task');
    expect(task.description).toEqual('Task description');
    expect(task.status).toEqual('doing');
    expect(task.priority).toEqual('high');
    expect(task.due_at).toBeInstanceOf(Date);
    expect(task.assignee_id).toEqual(userId);
    expect(task.linked_note_id).toBeNull();
    expect(task.created_at).toBeInstanceOf(Date);
    expect(task.updated_at).toBeInstanceOf(Date);
  });
});