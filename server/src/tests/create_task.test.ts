import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, notesTable } from '../db/schema';
import { type CreateTaskInput } from '../schema';
import { createTask } from '../handlers/create_task';
import { eq } from 'drizzle-orm';

// Test setup data
const testUser = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai' as const,
  llm_model: 'gpt-4',
};

const testWorkspace = {
  name: 'Test Workspace',
  settings: {},
};

const testNote = {
  title: 'Test Note',
  source: 'manual' as const,
  content_md: 'Test note content',
};

describe('createTask', () => {
  let userId: string;
  let workspaceId: string;
  let noteId: string;

  beforeEach(async () => {
    await createDB();

    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create prerequisite workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        ...testWorkspace,
        owner_id: userId,
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    // Create prerequisite note for linking tests
    const noteResult = await db.insert(notesTable)
      .values({
        ...testNote,
        workspace_id: workspaceId,
        created_by: userId,
      })
      .returning()
      .execute();
    noteId = noteResult[0].id;
  });

  afterEach(resetDB);

  it('should create a task with all required fields', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: workspaceId,
      title: 'Test Task',
      description: 'A task for testing',
      status: 'todo',
      priority: 'high',
      due_at: new Date('2024-12-31'),
      assignee_id: userId,
      linked_note_id: noteId,
    };

    const result = await createTask(testInput);

    // Basic field validation
    expect(result.title).toEqual('Test Task');
    expect(result.description).toEqual('A task for testing');
    expect(result.status).toEqual('todo');
    expect(result.priority).toEqual('high');
    expect(result.due_at).toEqual(new Date('2024-12-31'));
    expect(result.assignee_id).toEqual(userId);
    expect(result.linked_note_id).toEqual(noteId);
    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a task with minimal required fields', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: workspaceId,
      title: 'Minimal Task',
      status: 'todo',
      priority: 'med',
      assignee_id: userId,
    };

    const result = await createTask(testInput);

    expect(result.title).toEqual('Minimal Task');
    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.assignee_id).toEqual(userId);
    expect(result.description).toBeNull();
    expect(result.status).toEqual('todo'); // default value
    expect(result.priority).toEqual('med'); // default value
    expect(result.due_at).toBeNull();
    expect(result.linked_note_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save task to database', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: workspaceId,
      title: 'Database Test Task',
      description: 'Testing database persistence',
      status: 'doing',
      priority: 'low',
      assignee_id: userId,
    };

    const result = await createTask(testInput);

    // Query database to verify task was saved
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, result.id))
      .execute();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toEqual('Database Test Task');
    expect(tasks[0].description).toEqual('Testing database persistence');
    expect(tasks[0].status).toEqual('doing');
    expect(tasks[0].priority).toEqual('low');
    expect(tasks[0].assignee_id).toEqual(userId);
    expect(tasks[0].workspace_id).toEqual(workspaceId);
    expect(tasks[0].created_at).toBeInstanceOf(Date);
    expect(tasks[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle foreign key constraint for invalid assignee', async () => {
    const invalidUserId = crypto.randomUUID();
    const testInput: CreateTaskInput = {
      workspace_id: workspaceId,
      title: 'Invalid Assignee Task',
      status: 'todo',
      priority: 'med',
      assignee_id: invalidUserId,
    };

    await expect(createTask(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should handle foreign key constraint for invalid workspace', async () => {
    const invalidWorkspaceId = crypto.randomUUID();
    const testInput: CreateTaskInput = {
      workspace_id: invalidWorkspaceId,
      title: 'Invalid Workspace Task',
      status: 'todo',
      priority: 'med',
      assignee_id: userId,
    };

    await expect(createTask(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should handle foreign key constraint for invalid linked note', async () => {
    const invalidNoteId = crypto.randomUUID();
    const testInput: CreateTaskInput = {
      workspace_id: workspaceId,
      title: 'Invalid Note Link Task',
      status: 'todo',
      priority: 'med',
      assignee_id: userId,
      linked_note_id: invalidNoteId,
    };

    await expect(createTask(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should create task with all status enum values', async () => {
    const statuses = ['todo', 'doing', 'done'] as const;
    
    for (const status of statuses) {
      const testInput: CreateTaskInput = {
        workspace_id: workspaceId,
        title: `Task with ${status} status`,
        status,
        priority: 'med',
        assignee_id: userId,
      };

      const result = await createTask(testInput);
      expect(result.status).toEqual(status);
    }
  });

  it('should create task with all priority enum values', async () => {
    const priorities = ['low', 'med', 'high'] as const;
    
    for (const priority of priorities) {
      const testInput: CreateTaskInput = {
        workspace_id: workspaceId,
        title: `Task with ${priority} priority`,
        status: 'todo',
        priority,
        assignee_id: userId,
      };

      const result = await createTask(testInput);
      expect(result.priority).toEqual(priority);
    }
  });
});