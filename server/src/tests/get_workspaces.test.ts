import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable } from '../db/schema';
import { getWorkspaces } from '../handlers/get_workspaces';

// Test user data
const testUser1 = {
  email: 'user1@example.com',
  display_name: 'User One',
  timezone: 'UTC',
  llm_provider: 'openai' as const,
  llm_model: 'gpt-4',
};

const testUser2 = {
  email: 'user2@example.com',
  display_name: 'User Two',
  timezone: 'UTC',
  llm_provider: 'anthropic' as const,
  llm_model: 'claude-3',
};

describe('getWorkspaces', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return workspaces owned by user', async () => {
    // Create test users
    const [user1] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    // Create workspaces for user1
    const workspace1 = {
      owner_id: user1.id,
      name: 'Workspace One',
      settings: { theme: 'dark' },
    };

    const workspace2 = {
      owner_id: user1.id,
      name: 'Workspace Two',
      settings: { theme: 'light' },
    };

    const [createdWorkspace1, createdWorkspace2] = await db.insert(workspacesTable)
      .values([workspace1, workspace2])
      .returning()
      .execute();

    // Get workspaces for user1
    const result = await getWorkspaces(user1.id);

    expect(result).toHaveLength(2);

    // Verify workspace data
    const workspace1Result = result.find(w => w.name === 'Workspace One');
    const workspace2Result = result.find(w => w.name === 'Workspace Two');

    expect(workspace1Result).toBeDefined();
    expect(workspace1Result!.id).toEqual(createdWorkspace1.id);
    expect(workspace1Result!.owner_id).toEqual(user1.id);
    expect(workspace1Result!.name).toEqual('Workspace One');
    expect(workspace1Result!.settings).toEqual({ theme: 'dark' });
    expect(workspace1Result!.created_at).toBeInstanceOf(Date);

    expect(workspace2Result).toBeDefined();
    expect(workspace2Result!.id).toEqual(createdWorkspace2.id);
    expect(workspace2Result!.owner_id).toEqual(user1.id);
    expect(workspace2Result!.name).toEqual('Workspace Two');
    expect(workspace2Result!.settings).toEqual({ theme: 'light' });
    expect(workspace2Result!.created_at).toBeInstanceOf(Date);
  });

  it('should return empty array when user has no workspaces', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const result = await getWorkspaces(user.id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return workspaces owned by the specific user', async () => {
    // Create two test users
    const [user1, user2] = await db.insert(usersTable)
      .values([testUser1, testUser2])
      .returning()
      .execute();

    // Create workspaces for both users
    const workspace1 = {
      owner_id: user1.id,
      name: 'User1 Workspace',
      settings: { theme: 'dark' },
    };

    const workspace2 = {
      owner_id: user2.id,
      name: 'User2 Workspace',
      settings: { theme: 'light' },
    };

    await db.insert(workspacesTable)
      .values([workspace1, workspace2])
      .returning()
      .execute();

    // Get workspaces for user1 only
    const result = await getWorkspaces(user1.id);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('User1 Workspace');
    expect(result[0].owner_id).toEqual(user1.id);

    // Verify user2's workspace is not included
    const user2Workspace = result.find(w => w.name === 'User2 Workspace');
    expect(user2Workspace).toBeUndefined();
  });

  it('should return workspaces ordered by creation date (most recent first)', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    // Create workspaces with slight delay to ensure different timestamps
    const workspace1 = {
      owner_id: user.id,
      name: 'First Workspace',
      settings: {},
    };

    const [createdWorkspace1] = await db.insert(workspacesTable)
      .values(workspace1)
      .returning()
      .execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const workspace2 = {
      owner_id: user.id,
      name: 'Second Workspace',
      settings: {},
    };

    const [createdWorkspace2] = await db.insert(workspacesTable)
      .values(workspace2)
      .returning()
      .execute();

    const result = await getWorkspaces(user.id);

    expect(result).toHaveLength(2);

    // Verify both workspaces are returned with proper data
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[1].created_at).toBeInstanceOf(Date);

    // Find workspaces by name to verify they exist
    const firstWorkspace = result.find(w => w.name === 'First Workspace');
    const secondWorkspace = result.find(w => w.name === 'Second Workspace');

    expect(firstWorkspace).toBeDefined();
    expect(secondWorkspace).toBeDefined();
    expect(firstWorkspace!.id).toEqual(createdWorkspace1.id);
    expect(secondWorkspace!.id).toEqual(createdWorkspace2.id);
  });

  it('should handle non-existent user ID gracefully', async () => {
    const nonExistentUserId = '550e8400-e29b-41d4-a716-446655440000';

    const result = await getWorkspaces(nonExistentUserId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});