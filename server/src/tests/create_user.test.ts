import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'America/New_York',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testInput);

    // Validate all fields are correctly set
    expect(result.email).toEqual('test@example.com');
    expect(result.display_name).toEqual('Test User');
    expect(result.timezone).toEqual('America/New_York');
    expect(result.llm_provider).toEqual('openai');
    expect(result.llm_model).toEqual('gpt-4');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Verify user exists in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.display_name).toEqual('Test User');
    expect(savedUser.timezone).toEqual('America/New_York');
    expect(savedUser.llm_provider).toEqual('openai');
    expect(savedUser.llm_model).toEqual('gpt-4');
    expect(savedUser.created_at).toBeInstanceOf(Date);
  });

  it('should handle different llm providers', async () => {
    const anthropicInput: CreateUserInput = {
      ...testInput,
      email: 'anthropic@example.com',
      llm_provider: 'anthropic',
      llm_model: 'claude-3-opus'
    };

    const result = await createUser(anthropicInput);

    expect(result.llm_provider).toEqual('anthropic');
    expect(result.llm_model).toEqual('claude-3-opus');
    expect(result.email).toEqual('anthropic@example.com');
  });

  it('should handle google provider', async () => {
    const googleInput: CreateUserInput = {
      ...testInput,
      email: 'google@example.com',
      llm_provider: 'google',
      llm_model: 'gemini-pro'
    };

    const result = await createUser(googleInput);

    expect(result.llm_provider).toEqual('google');
    expect(result.llm_model).toEqual('gemini-pro');
  });

  it('should generate unique IDs for multiple users', async () => {
    const input1: CreateUserInput = {
      ...testInput,
      email: 'user1@example.com'
    };

    const input2: CreateUserInput = {
      ...testInput,
      email: 'user2@example.com'
    };

    const user1 = await createUser(input1);
    const user2 = await createUser(input2);

    expect(user1.id).not.toEqual(user2.id);
    expect(user1.email).toEqual('user1@example.com');
    expect(user2.email).toEqual('user2@example.com');
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with same email
    const duplicateInput: CreateUserInput = {
      ...testInput,
      display_name: 'Different Name'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/unique/i);
  });

  it('should handle different timezones', async () => {
    const timezones = [
      'UTC',
      'Europe/London',
      'Asia/Tokyo',
      'Australia/Sydney'
    ];

    for (let i = 0; i < timezones.length; i++) {
      const input: CreateUserInput = {
        ...testInput,
        email: `tz${i}@example.com`,
        timezone: timezones[i]
      };

      const result = await createUser(input);
      expect(result.timezone).toEqual(timezones[i]);
    }
  });
});