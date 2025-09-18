import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable } from '../db/schema';
import { type UpdateTaskInput } from '../schema';
import { updateTask } from '../handlers/update_task';
import { eq } from 'drizzle-orm';

// Test user, workspace, and task data
const testUser = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai' as const,
  llm_model: 'gpt-4'
};

const testWorkspace = {
  name: 'Test Workspace',
  settings: { theme: 'dark' }
};

const testTask = {
  title: 'Original Task',
  description: 'Original description',
  status: 'todo' as const,
  priority: 'med' as const,
  due_at: new Date('2024-12-31T23:59:59Z')
};

describe('updateTask', () => {
  let userId: string;
  let workspaceId: string;
  let taskId: string;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = user.id;

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({ ...testWorkspace, owner_id: userId })
      .returning()
      .execute();
    workspaceId = workspace.id;

    // Create test task
    const [task] = await db.insert(tasksTable)
      .values({ ...testTask, workspace_id: workspaceId, assignee_id: userId })
      .returning()
      .execute();
    taskId = task.id;
  });

  afterEach(resetDB);

  it('should update a task with all fields', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Updated Task Title',
      description: 'Updated description',
      status: 'done',
      priority: 'high',
      due_at: new Date('2025-01-15T12:00:00Z'),
      assignee_id: userId
    };

    const result = await updateTask(updateInput);

    expect(result.id).toEqual(taskId);
    expect(result.title).toEqual('Updated Task Title');
    expect(result.description).toEqual('Updated description');
    expect(result.status).toEqual('done');
    expect(result.priority).toEqual('high');
    expect(result.due_at).toEqual(new Date('2025-01-15T12:00:00Z'));
    expect(result.assignee_id).toEqual(userId);
    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      status: 'doing',
      priority: 'high'
    };

    const result = await updateTask(updateInput);

    expect(result.id).toEqual(taskId);
    expect(result.status).toEqual('doing');
    expect(result.priority).toEqual('high');
    // Original values should remain unchanged
    expect(result.title).toEqual('Original Task');
    expect(result.description).toEqual('Original description');
    expect(result.due_at).toEqual(new Date('2024-12-31T23:59:59Z'));
    expect(result.assignee_id).toEqual(userId);
  });

  it('should update task status to done', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      status: 'done'
    };

    const result = await updateTask(updateInput);

    expect(result.status).toEqual('done');
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify in database
    const [dbTask] = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(dbTask.status).toEqual('done');
  });

  it('should update due date', async () => {
    const newDueDate = new Date('2025-06-01T09:00:00Z');
    const updateInput: UpdateTaskInput = {
      id: taskId,
      due_at: newDueDate
    };

    const result = await updateTask(updateInput);

    expect(result.due_at).toEqual(newDueDate);
    
    // Verify in database
    const [dbTask] = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(dbTask.due_at).toEqual(newDueDate);
  });

  it('should clear description when set to null', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      description: null
    };

    const result = await updateTask(updateInput);

    expect(result.description).toBeNull();
    
    // Verify in database
    const [dbTask] = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(dbTask.description).toBeNull();
  });

  it('should clear due date when set to null', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      due_at: null
    };

    const result = await updateTask(updateInput);

    expect(result.due_at).toBeNull();
    
    // Verify in database
    const [dbTask] = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(dbTask.due_at).toBeNull();
  });

  it('should update assignee', async () => {
    // Create another user to assign the task to
    const [newUser] = await db.insert(usersTable)
      .values({
        email: 'newuser@example.com',
        display_name: 'New User',
        timezone: 'UTC',
        llm_provider: 'anthropic',
        llm_model: 'claude-3'
      })
      .returning()
      .execute();

    const updateInput: UpdateTaskInput = {
      id: taskId,
      assignee_id: newUser.id
    };

    const result = await updateTask(updateInput);

    expect(result.assignee_id).toEqual(newUser.id);
    
    // Verify in database
    const [dbTask] = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(dbTask.assignee_id).toEqual(newUser.id);
  });

  it('should always update the updated_at timestamp', async () => {
    // Get original task to compare timestamps
    const [originalTask] = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'New title'
    };

    const result = await updateTask(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTask.updated_at.getTime());
  });

  it('should throw error when task not found', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
    const updateInput: UpdateTaskInput = {
      id: nonExistentId,
      status: 'done'
    };

    await expect(updateTask(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should throw error when updating with invalid assignee', async () => {
    const nonExistentUserId = '550e8400-e29b-41d4-a716-446655440000';
    const updateInput: UpdateTaskInput = {
      id: taskId,
      assignee_id: nonExistentUserId
    };

    await expect(updateTask(updateInput)).rejects.toThrow();
  });

  it('should preserve other fields when updating single field', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Just title change'
    };

    const result = await updateTask(updateInput);

    // All other fields should remain unchanged
    expect(result.title).toEqual('Just title change');
    expect(result.description).toEqual('Original description');
    expect(result.status).toEqual('todo');
    expect(result.priority).toEqual('med');
    expect(result.due_at).toEqual(new Date('2024-12-31T23:59:59Z'));
    expect(result.assignee_id).toEqual(userId);
    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.linked_note_id).toBeNull();
  });
});