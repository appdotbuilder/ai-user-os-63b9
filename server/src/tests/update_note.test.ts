import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type UpdateNoteInput } from '../schema';
import { updateNote } from '../handlers/update_note';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai' as const,
  llm_model: 'gpt-4'
};

const testWorkspace = {
  name: 'Test Workspace',
  settings: {}
};

const testNote = {
  title: 'Original Note',
  source: 'manual' as const,
  content_md: 'Original content',
  transcript_text: null,
  summary_text: null,
  entities: null
};

describe('updateNote', () => {
  let userId: string;
  let workspaceId: string;
  let noteId: string;

  beforeEach(async () => {
    await createDB();

    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        ...testWorkspace,
        owner_id: userId
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    // Create note
    const noteResult = await db.insert(notesTable)
      .values({
        ...testNote,
        workspace_id: workspaceId,
        created_by: userId
      })
      .returning()
      .execute();
    noteId = noteResult[0].id;
  });

  afterEach(resetDB);

  it('should update note title', async () => {
    const input: UpdateNoteInput = {
      id: noteId,
      title: 'Updated Title'
    };

    const result = await updateNote(input);

    expect(result.id).toEqual(noteId);
    expect(result.title).toEqual('Updated Title');
    expect(result.content_md).toEqual('Original content'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update content_md', async () => {
    const input: UpdateNoteInput = {
      id: noteId,
      content_md: '# Updated Content\n\nThis is updated markdown content.'
    };

    const result = await updateNote(input);

    expect(result.content_md).toEqual('# Updated Content\n\nThis is updated markdown content.');
    expect(result.title).toEqual('Original Note'); // Should remain unchanged
  });

  it('should update transcript_text', async () => {
    const input: UpdateNoteInput = {
      id: noteId,
      transcript_text: 'This is the transcribed audio from a meeting.'
    };

    const result = await updateNote(input);

    expect(result.transcript_text).toEqual('This is the transcribed audio from a meeting.');
    expect(result.title).toEqual('Original Note'); // Should remain unchanged
  });

  it('should update summary_text', async () => {
    const input: UpdateNoteInput = {
      id: noteId,
      summary_text: 'This is an AI-generated summary of the note content.'
    };

    const result = await updateNote(input);

    expect(result.summary_text).toEqual('This is an AI-generated summary of the note content.');
  });

  it('should update entities', async () => {
    const entities = {
      people: ['John Doe', 'Jane Smith'],
      companies: ['Acme Corp'],
      dates: ['2024-01-15']
    };

    const input: UpdateNoteInput = {
      id: noteId,
      entities: entities
    };

    const result = await updateNote(input);

    expect(result.entities).toEqual(entities);
  });

  it('should update multiple fields at once', async () => {
    const entities = {
      topics: ['project planning', 'budget review']
    };

    const input: UpdateNoteInput = {
      id: noteId,
      title: 'Meeting Notes - Q1 Planning',
      transcript_text: 'We discussed the Q1 planning and budget allocation...',
      summary_text: 'Key decisions made regarding Q1 priorities and resource allocation.',
      entities: entities
    };

    const result = await updateNote(input);

    expect(result.title).toEqual('Meeting Notes - Q1 Planning');
    expect(result.transcript_text).toEqual('We discussed the Q1 planning and budget allocation...');
    expect(result.summary_text).toEqual('Key decisions made regarding Q1 priorities and resource allocation.');
    expect(result.entities).toEqual(entities);
    expect(result.content_md).toEqual('Original content'); // Should remain unchanged
  });

  it('should set nullable fields to null', async () => {
    // First, set some content
    await db.update(notesTable)
      .set({
        transcript_text: 'Some transcript',
        summary_text: 'Some summary',
        entities: { test: 'data' }
      })
      .where(eq(notesTable.id, noteId))
      .execute();

    // Now clear them with null values
    const input: UpdateNoteInput = {
      id: noteId,
      transcript_text: null,
      summary_text: null,
      entities: null
    };

    const result = await updateNote(input);

    expect(result.transcript_text).toBeNull();
    expect(result.summary_text).toBeNull();
    expect(result.entities).toBeNull();
  });

  it('should update updated_at timestamp', async () => {
    // Get original timestamp
    const originalNote = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, noteId))
      .execute();
    
    const originalUpdatedAt = originalNote[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: UpdateNoteInput = {
      id: noteId,
      title: 'Updated Title'
    };

    const result = await updateNote(input);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });

  it('should persist changes to database', async () => {
    const input: UpdateNoteInput = {
      id: noteId,
      title: 'Persisted Title',
      summary_text: 'Persisted summary'
    };

    await updateNote(input);

    // Verify changes were saved to database
    const dbNote = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, noteId))
      .execute();

    expect(dbNote).toHaveLength(1);
    expect(dbNote[0].title).toEqual('Persisted Title');
    expect(dbNote[0].summary_text).toEqual('Persisted summary');
    expect(dbNote[0].content_md).toEqual('Original content');
  });

  it('should throw error for non-existent note', async () => {
    const input: UpdateNoteInput = {
      id: '00000000-0000-0000-0000-000000000000',
      title: 'This should fail'
    };

    await expect(updateNote(input)).rejects.toThrow(/not found/i);
  });

  it('should handle empty update gracefully', async () => {
    const input: UpdateNoteInput = {
      id: noteId
    };

    const result = await updateNote(input);

    // Should still update the updated_at timestamp
    expect(result.id).toEqual(noteId);
    expect(result.title).toEqual('Original Note'); // Original values preserved
    expect(result.content_md).toEqual('Original content');
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});