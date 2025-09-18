import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, remindersTable } from '../db/schema';
import { getReminders } from '../handlers/get_reminders';

describe('getReminders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no reminders exist', async () => {
    const result = await getReminders();
    expect(result).toEqual([]);
  });

  it('should return scheduled reminders that are due', async () => {
    // Create prerequisite data
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

    const workspace = await db.insert(workspacesTable)
      .values({
        owner_id: user[0].id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const task = await db.insert(tasksTable)
      .values({
        workspace_id: workspace[0].id,
        title: 'Test Task',
        assignee_id: user[0].id,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create a reminder that is due (past time)
    const pastTime = new Date();
    pastTime.setHours(pastTime.getHours() - 1);

    const dueReminder = await db.insert(remindersTable)
      .values({
        task_id: task[0].id,
        remind_at: pastTime,
        method: 'email',
        status: 'scheduled'
      })
      .returning()
      .execute();

    const result = await getReminders();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(dueReminder[0].id);
    expect(result[0].task_id).toEqual(task[0].id);
    expect(result[0].method).toEqual('email');
    expect(result[0].status).toEqual('scheduled');
    expect(result[0].remind_at).toBeInstanceOf(Date);
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should not return future reminders', async () => {
    // Create prerequisite data
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

    const workspace = await db.insert(workspacesTable)
      .values({
        owner_id: user[0].id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const task = await db.insert(tasksTable)
      .values({
        workspace_id: workspace[0].id,
        title: 'Test Task',
        assignee_id: user[0].id,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create a reminder in the future
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 2);

    await db.insert(remindersTable)
      .values({
        task_id: task[0].id,
        remind_at: futureTime,
        method: 'email',
        status: 'scheduled'
      })
      .execute();

    const result = await getReminders();
    expect(result).toHaveLength(0);
  });

  it('should not return non-scheduled reminders', async () => {
    // Create prerequisite data
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

    const workspace = await db.insert(workspacesTable)
      .values({
        owner_id: user[0].id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const task = await db.insert(tasksTable)
      .values({
        workspace_id: workspace[0].id,
        title: 'Test Task',
        assignee_id: user[0].id,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    const pastTime = new Date();
    pastTime.setHours(pastTime.getHours() - 1);

    // Create reminders with different statuses
    await db.insert(remindersTable)
      .values([
        {
          task_id: task[0].id,
          remind_at: pastTime,
          method: 'email',
          status: 'sent'
        },
        {
          task_id: task[0].id,
          remind_at: pastTime,
          method: 'app_push',
          status: 'cancelled'
        }
      ])
      .execute();

    const result = await getReminders();
    expect(result).toHaveLength(0);
  });

  it('should return multiple due scheduled reminders', async () => {
    // Create prerequisite data
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

    const workspace = await db.insert(workspacesTable)
      .values({
        owner_id: user[0].id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const tasks = await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspace[0].id,
          title: 'Task 1',
          assignee_id: user[0].id,
          status: 'todo',
          priority: 'med'
        },
        {
          workspace_id: workspace[0].id,
          title: 'Task 2',
          assignee_id: user[0].id,
          status: 'todo',
          priority: 'high'
        }
      ])
      .returning()
      .execute();

    const pastTime = new Date();
    pastTime.setMinutes(pastTime.getMinutes() - 30);

    // Create multiple due reminders
    await db.insert(remindersTable)
      .values([
        {
          task_id: tasks[0].id,
          remind_at: pastTime,
          method: 'email',
          status: 'scheduled'
        },
        {
          task_id: tasks[1].id,
          remind_at: pastTime,
          method: 'app_push',
          status: 'scheduled'
        }
      ])
      .execute();

    const result = await getReminders();

    expect(result).toHaveLength(2);
    expect(result.every(r => r.status === 'scheduled')).toBe(true);
    expect(result.every(r => r.remind_at <= new Date())).toBe(true);
    
    const taskIds = result.map(r => r.task_id).sort();
    const expectedTaskIds = [tasks[0].id, tasks[1].id].sort();
    expect(taskIds).toEqual(expectedTaskIds);
  });

  it('should handle mixed scenarios correctly', async () => {
    // Create prerequisite data
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

    const workspace = await db.insert(workspacesTable)
      .values({
        owner_id: user[0].id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const task = await db.insert(tasksTable)
      .values({
        workspace_id: workspace[0].id,
        title: 'Test Task',
        assignee_id: user[0].id,
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    const pastTime = new Date();
    pastTime.setHours(pastTime.getHours() - 1);
    
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 1);

    // Create various reminders - only one should match
    const reminders = await db.insert(remindersTable)
      .values([
        {
          task_id: task[0].id,
          remind_at: pastTime,
          method: 'email',
          status: 'scheduled' // Should be returned
        },
        {
          task_id: task[0].id,
          remind_at: pastTime,
          method: 'app_push',
          status: 'sent' // Already sent - should not be returned
        },
        {
          task_id: task[0].id,
          remind_at: futureTime,
          method: 'calendar',
          status: 'scheduled' // Future - should not be returned
        },
        {
          task_id: task[0].id,
          remind_at: pastTime,
          method: 'email',
          status: 'cancelled' // Cancelled - should not be returned
        }
      ])
      .returning()
      .execute();

    const result = await getReminders();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(reminders[0].id);
    expect(result[0].status).toEqual('scheduled');
    expect(result[0].method).toEqual('email');
  });
});