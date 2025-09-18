import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { notesTable, usersTable, workspacesTable } from '../db/schema';
import { type CreateNoteInput } from '../schema';
import { createNote } from '../handlers/create_note';
import { eq } from 'drizzle-orm';

// Test data setup
let testUserId: string;
let testWorkspaceId: string;

const baseTestInput: CreateNoteInput = {
  workspace_id: '', // Will be set in beforeEach
  title: 'Test Note',
  source: 'manual' as const,
  content_md: '# Test Content\n\nThis is a test note.',
  transcript_text: null,
  created_by: '' // Will be set in beforeEach
};

describe('createNote', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test user first
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
    
    testUserId = userResult[0].id;
    
    // Create test workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: testUserId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    
    testWorkspaceId = workspaceResult[0].id;
    
    // Update test input with real IDs
    baseTestInput.workspace_id = testWorkspaceId;
    baseTestInput.created_by = testUserId;
  });

  afterEach(resetDB);

  it('should create a manual note with content', async () => {
    const result = await createNote(baseTestInput);

    // Basic field validation
    expect(result.title).toEqual('Test Note');
    expect(result.source).toEqual('manual');
    expect(result.content_md).toEqual('# Test Content\n\nThis is a test note.');
    expect(result.transcript_text).toBeNull();
    expect(result.summary_text).toBeNull();
    expect(result.entities).toBeNull();
    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a meeting note with transcript', async () => {
    const meetingInput: CreateNoteInput = {
      ...baseTestInput,
      title: 'Team Meeting Notes',
      source: 'meeting',
      content_md: null,
      transcript_text: 'This is the meeting transcript text.'
    };

    const result = await createNote(meetingInput);

    expect(result.title).toEqual('Team Meeting Notes');
    expect(result.source).toEqual('meeting');
    expect(result.content_md).toBeNull();
    expect(result.transcript_text).toEqual('This is the meeting transcript text.');
    expect(result.summary_text).toBeNull();
    expect(result.entities).toBeNull();
  });

  it('should create an imported note', async () => {
    const importInput: CreateNoteInput = {
      ...baseTestInput,
      title: 'Imported Document',
      source: 'import',
      content_md: '# Imported Content\n\nThis was imported from another system.',
      transcript_text: null
    };

    const result = await createNote(importInput);

    expect(result.title).toEqual('Imported Document');
    expect(result.source).toEqual('import');
    expect(result.content_md).toEqual('# Imported Content\n\nThis was imported from another system.');
    expect(result.transcript_text).toBeNull();
  });

  it('should save note to database correctly', async () => {
    const result = await createNote(baseTestInput);

    // Query the database to verify the note was saved
    const notes = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, result.id))
      .execute();

    expect(notes).toHaveLength(1);
    const savedNote = notes[0];
    
    expect(savedNote.title).toEqual('Test Note');
    expect(savedNote.source).toEqual('manual');
    expect(savedNote.content_md).toEqual('# Test Content\n\nThis is a test note.');
    expect(savedNote.transcript_text).toBeNull();
    expect(savedNote.workspace_id).toEqual(testWorkspaceId);
    expect(savedNote.created_by).toEqual(testUserId);
    expect(savedNote.created_at).toBeInstanceOf(Date);
    expect(savedNote.updated_at).toBeInstanceOf(Date);
  });

  it('should handle notes with both content and transcript', async () => {
    const mixedInput: CreateNoteInput = {
      ...baseTestInput,
      title: 'Mixed Content Note',
      source: 'meeting',
      content_md: '# Meeting Summary\n\nKey points discussed.',
      transcript_text: 'Full transcript of the meeting discussion.'
    };

    const result = await createNote(mixedInput);

    expect(result.title).toEqual('Mixed Content Note');
    expect(result.source).toEqual('meeting');
    expect(result.content_md).toEqual('# Meeting Summary\n\nKey points discussed.');
    expect(result.transcript_text).toEqual('Full transcript of the meeting discussion.');
  });

  it('should handle minimal note with only required fields', async () => {
    const minimalInput: CreateNoteInput = {
      workspace_id: testWorkspaceId,
      title: 'Minimal Note',
      source: 'manual',
      created_by: testUserId
      // content_md and transcript_text are optional and not provided
    };

    const result = await createNote(minimalInput);

    expect(result.title).toEqual('Minimal Note');
    expect(result.source).toEqual('manual');
    expect(result.content_md).toBeNull();
    expect(result.transcript_text).toBeNull();
    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.created_by).toEqual(testUserId);
  });

  it('should create notes with different sources correctly', async () => {
    const sources = ['manual', 'meeting', 'import'] as const;
    
    for (const source of sources) {
      const input: CreateNoteInput = {
        ...baseTestInput,
        title: `${source} Note`,
        source
      };

      const result = await createNote(input);
      expect(result.source).toEqual(source);
      expect(result.title).toEqual(`${source} Note`);
    }
  });

  it('should throw error for invalid workspace_id', async () => {
    const invalidInput: CreateNoteInput = {
      ...baseTestInput,
      workspace_id: '00000000-0000-0000-0000-000000000000' // Non-existent workspace
    };

    await expect(createNote(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should throw error for invalid created_by user_id', async () => {
    const invalidInput: CreateNoteInput = {
      ...baseTestInput,
      created_by: '00000000-0000-0000-0000-000000000000' // Non-existent user
    };

    await expect(createNote(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
  });
});