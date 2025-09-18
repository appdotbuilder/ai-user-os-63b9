import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUser } from '../handlers/get_user';

// Test user data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4',
};

describe('getUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when user exists', async () => {
    // Create a test user first
    const createResult = await db.insert(usersTable)
      .values(testUserInput)
      .returning()
      .execute();

    const createdUser = createResult[0];
    
    // Get the user
    const result = await getUser(createdUser.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.email).toEqual('test@example.com');
    expect(result!.display_name).toEqual('Test User');
    expect(result!.timezone).toEqual('UTC');
    expect(result!.llm_provider).toEqual('openai');
    expect(result!.llm_model).toEqual('gpt-4');
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null when user does not exist', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
    
    const result = await getUser(nonExistentId);

    expect(result).toBeNull();
  });

  it('should return correct user when multiple users exist', async () => {
    // Create multiple users
    const user1Input: CreateUserInput = {
      email: 'user1@example.com',
      display_name: 'User One',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4',
    };

    const user2Input: CreateUserInput = {
      email: 'user2@example.com',
      display_name: 'User Two',
      timezone: 'America/New_York',
      llm_provider: 'anthropic',
      llm_model: 'claude-3',
    };

    const [createdUser1, createdUser2] = await Promise.all([
      db.insert(usersTable).values(user1Input).returning().execute().then(r => r[0]),
      db.insert(usersTable).values(user2Input).returning().execute().then(r => r[0])
    ]);

    // Get specific user
    const result = await getUser(createdUser2.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser2.id);
    expect(result!.email).toEqual('user2@example.com');
    expect(result!.display_name).toEqual('User Two');
    expect(result!.timezone).toEqual('America/New_York');
    expect(result!.llm_provider).toEqual('anthropic');
    expect(result!.llm_model).toEqual('claude-3');
  });

  it('should handle database errors gracefully', async () => {
    // Use an invalid UUID format to trigger a database error
    const invalidId = 'invalid-uuid-format';
    
    await expect(getUser(invalidId)).rejects.toThrow();
  });
});