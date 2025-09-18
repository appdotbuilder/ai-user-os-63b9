import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { workspacesTable, usersTable } from '../db/schema';
import { type CreateWorkspaceInput } from '../schema';
import { createWorkspace } from '../handlers/create_workspace';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai' as const,
  llm_model: 'gpt-4'
};

// Test workspace input
const testWorkspaceInput: CreateWorkspaceInput = {
  owner_id: '', // Will be set after creating user
  name: 'Test Workspace'
};

describe('createWorkspace', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a workspace with basic information', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testWorkspaceInput, owner_id: userId };

    const result = await createWorkspace(input);

    // Basic field validation
    expect(result.name).toEqual('Test Workspace');
    expect(result.owner_id).toEqual(userId);
    expect(result.settings).toEqual({});
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a workspace with custom settings', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const customSettings = { theme: 'dark', notifications: true };
    const input: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Custom Workspace',
      settings: customSettings
    };

    const result = await createWorkspace(input);

    // Validate custom settings
    expect(result.name).toEqual('Custom Workspace');
    expect(result.owner_id).toEqual(userId);
    expect(result.settings).toEqual(customSettings);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save workspace to database', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testWorkspaceInput, owner_id: userId };

    const result = await createWorkspace(input);

    // Query workspace from database
    const workspaces = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, result.id))
      .execute();

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toEqual('Test Workspace');
    expect(workspaces[0].owner_id).toEqual(userId);
    expect(workspaces[0].settings).toEqual({});
    expect(workspaces[0].created_at).toBeInstanceOf(Date);
  });

  it('should create multiple workspaces for the same user', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create first workspace
    const input1: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Workspace 1'
    };
    const result1 = await createWorkspace(input1);

    // Create second workspace
    const input2: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Workspace 2',
      settings: { color: 'blue' }
    };
    const result2 = await createWorkspace(input2);

    // Verify both workspaces exist and are different
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Workspace 1');
    expect(result2.name).toEqual('Workspace 2');
    expect(result1.settings).toEqual({});
    expect(result2.settings).toEqual({ color: 'blue' });

    // Query all workspaces for the user
    const userWorkspaces = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.owner_id, userId))
      .execute();

    expect(userWorkspaces).toHaveLength(2);
  });

  it('should throw error when owner does not exist', async () => {
    const nonExistentUserId = crypto.randomUUID();
    const input: CreateWorkspaceInput = {
      owner_id: nonExistentUserId,
      name: 'Test Workspace'
    };

    await expect(createWorkspace(input)).rejects.toThrow(/User with id .+ not found/i);
  });

  it('should handle empty settings object', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input: CreateWorkspaceInput = {
      owner_id: userId,
      name: 'Empty Settings Workspace',
      settings: {}
    };

    const result = await createWorkspace(input);

    expect(result.settings).toEqual({});
  });
});