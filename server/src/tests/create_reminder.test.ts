import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { remindersTable, usersTable, workspacesTable, tasksTable } from '../db/schema';
import { type CreateReminderInput } from '../schema';
import { createReminder } from '../handlers/create_reminder';
import { eq } from 'drizzle-orm';

describe('createReminder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let userId: string;
  let workspaceId: string;
  let taskId: string;

  const setupTestData = async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    // Create task
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Task',
        description: 'A task for testing',
        status: 'todo',
        priority: 'med',
        assignee_id: userId
      })
      .returning()
      .execute();
    taskId = taskResult[0].id;
  };

  it('should create a reminder with app push method', async () => {
    await setupTestData();

    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1);

    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: futureDate,
      method: 'app_push'
    };

    const result = await createReminder(testInput);

    // Basic field validation
    expect(result.task_id).toEqual(taskId);
    expect(result.remind_at).toEqual(futureDate);
    expect(result.method).toEqual('app_push');
    expect(result.status).toEqual('scheduled');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a reminder with email method', async () => {
    await setupTestData();

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: futureDate,
      method: 'email'
    };

    const result = await createReminder(testInput);

    expect(result.task_id).toEqual(taskId);
    expect(result.remind_at).toEqual(futureDate);
    expect(result.method).toEqual('email');
    expect(result.status).toEqual('scheduled');
  });

  it('should create a reminder with calendar method', async () => {
    await setupTestData();

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);

    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: futureDate,
      method: 'calendar'
    };

    const result = await createReminder(testInput);

    expect(result.task_id).toEqual(taskId);
    expect(result.remind_at).toEqual(futureDate);
    expect(result.method).toEqual('calendar');
    expect(result.status).toEqual('scheduled');
  });

  it('should save reminder to database', async () => {
    await setupTestData();

    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: futureDate,
      method: 'app_push'
    };

    const result = await createReminder(testInput);

    // Query the database to verify the reminder was saved
    const reminders = await db.select()
      .from(remindersTable)
      .where(eq(remindersTable.id, result.id))
      .execute();

    expect(reminders).toHaveLength(1);
    expect(reminders[0].task_id).toEqual(taskId);
    expect(reminders[0].remind_at).toEqual(futureDate);
    expect(reminders[0].method).toEqual('app_push');
    expect(reminders[0].status).toEqual('scheduled');
    expect(reminders[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent task', async () => {
    const nonExistentTaskId = crypto.randomUUID();
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1);

    const testInput: CreateReminderInput = {
      task_id: nonExistentTaskId,
      remind_at: futureDate,
      method: 'email'
    };

    await expect(createReminder(testInput)).rejects.toThrow(/Task with id .+ not found/);
  });

  it('should handle past reminder dates', async () => {
    await setupTestData();

    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);

    const testInput: CreateReminderInput = {
      task_id: taskId,
      remind_at: pastDate,
      method: 'calendar'
    };

    // Should still create the reminder even with past date
    const result = await createReminder(testInput);

    expect(result.task_id).toEqual(taskId);
    expect(result.remind_at).toEqual(pastDate);
    expect(result.method).toEqual('calendar');
    expect(result.status).toEqual('scheduled');
  });

  it('should create multiple reminders for the same task', async () => {
    await setupTestData();

    const date1 = new Date();
    date1.setHours(date1.getHours() + 1);
    
    const date2 = new Date();
    date2.setHours(date2.getHours() + 2);

    const input1: CreateReminderInput = {
      task_id: taskId,
      remind_at: date1,
      method: 'app_push'
    };

    const input2: CreateReminderInput = {
      task_id: taskId,
      remind_at: date2,
      method: 'email'
    };

    const result1 = await createReminder(input1);
    const result2 = await createReminder(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.task_id).toEqual(taskId);
    expect(result2.task_id).toEqual(taskId);
    expect(result1.method).toEqual('app_push');
    expect(result2.method).toEqual('email');

    // Verify both reminders are in the database
    const allReminders = await db.select()
      .from(remindersTable)
      .where(eq(remindersTable.task_id, taskId))
      .execute();

    expect(allReminders).toHaveLength(2);
  });
});