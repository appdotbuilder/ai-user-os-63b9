import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type GetNotesQuery } from '../schema';
import { getNotes } from '../handlers/get_notes';

describe('getNotes', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: string;
  let testWorkspaceId: string;
  let otherWorkspaceId: string;

  beforeEach(async () => {
    // Create a test user
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
    testUserId = user[0].id;

    // Create test workspaces
    const workspaces = await db.insert(workspacesTable)
      .values([
        {
          owner_id: testUserId,
          name: 'Test Workspace',
          settings: {}
        },
        {
          owner_id: testUserId,
          name: 'Other Workspace',
          settings: {}
        }
      ])
      .returning()
      .execute();
    testWorkspaceId = workspaces[0].id;
    otherWorkspaceId = workspaces[1].id;
  });

  it('should return notes for a workspace', async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000); // 1 second earlier

    // Create test notes with explicit timestamps
    await db.insert(notesTable)
      .values([
        {
          workspace_id: testWorkspaceId,
          title: 'First Note',
          source: 'manual',
          content_md: 'First note content',
          created_by: testUserId,
          created_at: earlier,
          updated_at: earlier
        },
        {
          workspace_id: testWorkspaceId,
          title: 'Second Note',
          source: 'meeting',
          transcript_text: 'Meeting transcript',
          created_by: testUserId,
          created_at: now,
          updated_at: now
        }
      ])
      .execute();

    const query: GetNotesQuery = {
      workspace_id: testWorkspaceId
    };

    const results = await getNotes(query);

    expect(results).toHaveLength(2);
    expect(results[0].title).toEqual('Second Note'); // Most recent first (DESC order)
    expect(results[1].title).toEqual('First Note');
    expect(results[0].workspace_id).toEqual(testWorkspaceId);
    expect(results[1].workspace_id).toEqual(testWorkspaceId);
  });

  it('should filter notes by source', async () => {
    // Create notes with different sources
    await db.insert(notesTable)
      .values([
        {
          workspace_id: testWorkspaceId,
          title: 'Manual Note',
          source: 'manual',
          content_md: 'Manual content',
          created_by: testUserId
        },
        {
          workspace_id: testWorkspaceId,
          title: 'Meeting Note',
          source: 'meeting',
          transcript_text: 'Meeting transcript',
          created_by: testUserId
        },
        {
          workspace_id: testWorkspaceId,
          title: 'Import Note',
          source: 'import',
          content_md: 'Imported content',
          created_by: testUserId
        }
      ])
      .execute();

    const query: GetNotesQuery = {
      workspace_id: testWorkspaceId,
      source: 'meeting'
    };

    const results = await getNotes(query);

    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Meeting Note');
    expect(results[0].source).toEqual('meeting');
  });

  it('should limit results when limit is specified', async () => {
    const baseTime = new Date();
    
    // Create multiple notes with explicit timestamps
    const notePromises = [];
    for (let i = 1; i <= 5; i++) {
      const noteTime = new Date(baseTime.getTime() + i * 1000); // Each note 1 second later
      notePromises.push({
        workspace_id: testWorkspaceId,
        title: `Note ${i}`,
        source: 'manual' as const,
        content_md: `Content ${i}`,
        created_by: testUserId,
        created_at: noteTime,
        updated_at: noteTime
      });
    }

    await db.insert(notesTable)
      .values(notePromises)
      .execute();

    const query: GetNotesQuery = {
      workspace_id: testWorkspaceId,
      limit: 3
    };

    const results = await getNotes(query);

    expect(results).toHaveLength(3);
    // Should be ordered by created_at DESC
    expect(results[0].title).toEqual('Note 5');
    expect(results[1].title).toEqual('Note 4');
    expect(results[2].title).toEqual('Note 3');
  });

  it('should only return notes from the specified workspace', async () => {
    // Create notes in both workspaces
    await db.insert(notesTable)
      .values([
        {
          workspace_id: testWorkspaceId,
          title: 'Test Workspace Note',
          source: 'manual',
          content_md: 'Content for test workspace',
          created_by: testUserId
        },
        {
          workspace_id: otherWorkspaceId,
          title: 'Other Workspace Note',
          source: 'manual',
          content_md: 'Content for other workspace',
          created_by: testUserId
        }
      ])
      .execute();

    const query: GetNotesQuery = {
      workspace_id: testWorkspaceId
    };

    const results = await getNotes(query);

    expect(results).toHaveLength(1);
    expect(results[0].title).toEqual('Test Workspace Note');
    expect(results[0].workspace_id).toEqual(testWorkspaceId);
  });

  it('should return empty array when no notes exist', async () => {
    const query: GetNotesQuery = {
      workspace_id: testWorkspaceId
    };

    const results = await getNotes(query);

    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should combine source filter and limit correctly', async () => {
    const baseTime = new Date();
    
    // Create multiple notes with different sources and explicit timestamps
    await db.insert(notesTable)
      .values([
        {
          workspace_id: testWorkspaceId,
          title: 'Manual Note 1',
          source: 'manual',
          content_md: 'Manual content 1',
          created_by: testUserId,
          created_at: new Date(baseTime.getTime() + 1000),
          updated_at: new Date(baseTime.getTime() + 1000)
        },
        {
          workspace_id: testWorkspaceId,
          title: 'Meeting Note 1',
          source: 'meeting',
          transcript_text: 'Meeting transcript 1',
          created_by: testUserId,
          created_at: new Date(baseTime.getTime() + 2000),
          updated_at: new Date(baseTime.getTime() + 2000)
        },
        {
          workspace_id: testWorkspaceId,
          title: 'Manual Note 2',
          source: 'manual',
          content_md: 'Manual content 2',
          created_by: testUserId,
          created_at: new Date(baseTime.getTime() + 3000),
          updated_at: new Date(baseTime.getTime() + 3000)
        },
        {
          workspace_id: testWorkspaceId,
          title: 'Meeting Note 2',
          source: 'meeting',
          transcript_text: 'Meeting transcript 2',
          created_by: testUserId,
          created_at: new Date(baseTime.getTime() + 4000),
          updated_at: new Date(baseTime.getTime() + 4000)
        },
        {
          workspace_id: testWorkspaceId,
          title: 'Manual Note 3',
          source: 'manual',
          content_md: 'Manual content 3',
          created_by: testUserId,
          created_at: new Date(baseTime.getTime() + 5000),
          updated_at: new Date(baseTime.getTime() + 5000)
        }
      ])
      .execute();

    const query: GetNotesQuery = {
      workspace_id: testWorkspaceId,
      source: 'manual',
      limit: 2
    };

    const results = await getNotes(query);

    expect(results).toHaveLength(2);
    expect(results[0].source).toEqual('manual');
    expect(results[1].source).toEqual('manual');
    // Should be ordered by created_at DESC
    expect(results[0].title).toEqual('Manual Note 3');
    expect(results[1].title).toEqual('Manual Note 2');
  });

  it('should handle all note fields correctly', async () => {
    // Create a note with all optional fields populated
    await db.insert(notesTable)
      .values({
        workspace_id: testWorkspaceId,
        title: 'Complete Note',
        source: 'meeting',
        content_md: '# Meeting Notes\n\nSome markdown content',
        transcript_text: 'This is the full meeting transcript',
        summary_text: 'Meeting summary',
        entities: { people: ['John', 'Jane'], topics: ['project', 'deadline'] },
        created_by: testUserId
      })
      .execute();

    const query: GetNotesQuery = {
      workspace_id: testWorkspaceId
    };

    const results = await getNotes(query);

    expect(results).toHaveLength(1);
    const note = results[0];
    expect(note.title).toEqual('Complete Note');
    expect(note.source).toEqual('meeting');
    expect(note.content_md).toEqual('# Meeting Notes\n\nSome markdown content');
    expect(note.transcript_text).toEqual('This is the full meeting transcript');
    expect(note.summary_text).toEqual('Meeting summary');
    expect(note.entities).toEqual({ people: ['John', 'Jane'], topics: ['project', 'deadline'] });
    expect(note.created_by).toEqual(testUserId);
    expect(note.created_at).toBeInstanceOf(Date);
    expect(note.updated_at).toBeInstanceOf(Date);
    expect(note.id).toBeDefined();
  });
});