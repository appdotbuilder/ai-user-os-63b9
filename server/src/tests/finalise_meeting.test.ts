import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type CreateUserInput, type CreateWorkspaceInput, type CreateNoteInput, type FinaliseMeetingInput } from '../schema';
import { finaliseMeeting } from '../handlers/finalise_meeting';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

const testTranscript = `
John: Good morning everyone, thanks for joining today's meeting.
Sarah: Hi John, happy to be here. Let's discuss the project timeline.
John: We've decided to move the deadline to March 15th, 2024 to accommodate the new requirements.
Sarah: That sounds reasonable. I'm concerned about the risk of scope creep though.
Mike: I agree with Sarah. We need to be careful about adding new features.
John: Agreed. We resolved to freeze the scope after this week.
Sarah: Great decision. One issue we have is the database performance in the staging environment.
John: That's a critical problem we need to address immediately.
Mike: I'll take the action item to investigate the database issues by Friday.
Sarah: Perfect. Any other concerns or blockers?
John: I think we covered everything. Meeting concluded at 10:30 AM.
`;

const simpleTranscript = `
This is a simple meeting. We talked about the weather.
It was a short discussion with basic content.
`;

describe('finaliseMeeting', () => {
  let userId: string;
  let workspaceId: string;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        display_name: testUser.display_name,
        timezone: testUser.timezone,
        llm_provider: testUser.llm_provider,
        llm_model: testUser.llm_model
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;
  });

  afterEach(resetDB);

  it('should successfully finalize a meeting note with transcript', async () => {
    // Create a meeting note with transcript
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Meeting',
        source: 'meeting',
        transcript_text: testTranscript,
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    const result = await finaliseMeeting(input);

    // Verify the result structure
    expect(result).toHaveProperty('summary_text');
    expect(result).toHaveProperty('entities');
    expect(typeof result.summary_text).toBe('string');
    expect(result.summary_text.length).toBeGreaterThan(0);

    // Verify entities structure
    expect(result.entities).toHaveProperty('decisions');
    expect(result.entities).toHaveProperty('risks');
    expect(result.entities).toHaveProperty('people');
    expect(result.entities).toHaveProperty('dates');

    // Verify arrays are present
    expect(Array.isArray(result.entities['decisions'])).toBe(true);
    expect(Array.isArray(result.entities['risks'])).toBe(true);
    expect(Array.isArray(result.entities['people'])).toBe(true);
    expect(Array.isArray(result.entities['dates'])).toBe(true);

    // Verify some basic entity extraction from our test transcript
    expect(result.entities['people'].length).toBeGreaterThan(0);
    expect(result.entities['people']).toContain('John');
    expect(result.entities['people']).toContain('Sarah');
    expect(result.entities['people']).toContain('Mike');
  });

  it('should update the note in database with processed data', async () => {
    // Create a meeting note
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Test Meeting',
        source: 'meeting',
        transcript_text: testTranscript,
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    await finaliseMeeting(input);

    // Verify the note was updated in the database
    const updatedNotes = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, noteResult[0].id))
      .execute();

    expect(updatedNotes).toHaveLength(1);
    const updatedNote = updatedNotes[0];

    expect(updatedNote.summary_text).not.toBeNull();
    expect(updatedNote.summary_text!.length).toBeGreaterThan(0);
    expect(updatedNote.entities).not.toBeNull();
    expect(typeof updatedNote.entities).toBe('object');

    // Verify updated_at was changed
    expect(updatedNote.updated_at).toBeInstanceOf(Date);
  });

  it('should extract decisions from transcript correctly', async () => {
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Decision Meeting',
        source: 'meeting',
        transcript_text: testTranscript,
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    const result = await finaliseMeeting(input);

    expect(result.entities['decisions'].length).toBeGreaterThan(0);
    
    // Check that decisions are properly structured
    result.entities['decisions'].forEach((decision: any) => {
      expect(decision).toHaveProperty('decision');
      expect(decision).toHaveProperty('context');
      expect(typeof decision.decision).toBe('string');
      expect(typeof decision.context).toBe('string');
    });

    // Look for specific decisions from our test transcript
    const decisionTexts = result.entities['decisions'].map((d: any) => d.decision.toLowerCase());
    expect(decisionTexts.some((text: string) => text.includes('decided') || text.includes('resolved'))).toBe(true);
  });

  it('should extract risks from transcript correctly', async () => {
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Risk Discussion',
        source: 'meeting',
        transcript_text: testTranscript,
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    const result = await finaliseMeeting(input);

    expect(result.entities['risks'].length).toBeGreaterThan(0);
    
    // Check risk structure
    result.entities['risks'].forEach((risk: any) => {
      expect(risk).toHaveProperty('risk');
      expect(risk).toHaveProperty('severity');
      expect(typeof risk.risk).toBe('string');
      expect(['low', 'medium', 'high']).toContain(risk.severity);
    });

    // Look for specific risks from our test transcript
    const riskTexts = result.entities['risks'].map((r: any) => r.risk.toLowerCase());
    expect(riskTexts.some((text: string) => 
      text.includes('concern') || 
      text.includes('risk') || 
      text.includes('problem') || 
      text.includes('issue')
    )).toBe(true);
  });

  it('should extract dates from transcript correctly', async () => {
    const transcriptWithDates = `
    Team meeting on March 15th, 2024. 
    We discussed the deadline for 03/30/2024.
    Next review scheduled for Apr 10, 2024.
    `;

    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Date Meeting',
        source: 'meeting',
        transcript_text: transcriptWithDates,
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    const result = await finaliseMeeting(input);

    expect(result.entities['dates'].length).toBeGreaterThan(0);
    
    // Check date structure
    result.entities['dates'].forEach((dateItem: any) => {
      expect(dateItem).toHaveProperty('date');
      expect(dateItem).toHaveProperty('context');
      expect(typeof dateItem.date).toBe('string');
      expect(typeof dateItem.context).toBe('string');
    });
  });

  it('should generate meaningful summary', async () => {
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Summary Test',
        source: 'meeting',
        transcript_text: testTranscript,
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    const result = await finaliseMeeting(input);

    expect(result.summary_text.length).toBeGreaterThan(50);
    expect(result.summary_text.toLowerCase()).toContain('meeting');
    expect(result.summary_text.toLowerCase()).toContain('participants');
  });

  it('should handle simple transcript correctly', async () => {
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Simple Meeting',
        source: 'meeting',
        transcript_text: simpleTranscript,
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    const result = await finaliseMeeting(input);

    expect(result.summary_text).toBeDefined();
    expect(result.entities['decisions']).toBeDefined();
    expect(result.entities['risks']).toBeDefined();
    expect(result.entities['people']).toBeDefined();
    expect(result.entities['dates']).toBeDefined();
    
    // Arrays can be empty for simple content
    expect(Array.isArray(result.entities['decisions'])).toBe(true);
    expect(Array.isArray(result.entities['risks'])).toBe(true);
    expect(Array.isArray(result.entities['people'])).toBe(true);
    expect(Array.isArray(result.entities['dates'])).toBe(true);
  });

  it('should throw error when note does not exist', async () => {
    const input: FinaliseMeetingInput = {
      note_id: '550e8400-e29b-41d4-a716-446655440000' // Valid UUID format but non-existent
    };

    await expect(finaliseMeeting(input)).rejects.toThrow(/not found/i);
  });

  it('should throw error when note is not from meeting source', async () => {
    // Create a non-meeting note
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Manual Note',
        source: 'manual',
        content_md: 'This is a manual note',
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    await expect(finaliseMeeting(input)).rejects.toThrow(/meeting source/i);
  });

  it('should throw error when note has no transcript text', async () => {
    // Create a meeting note without transcript
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Empty Meeting',
        source: 'meeting',
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    await expect(finaliseMeeting(input)).rejects.toThrow(/transcript text/i);
  });

  it('should throw error when note has empty transcript text', async () => {
    // Create a meeting note with empty transcript
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: workspaceId,
        title: 'Empty Transcript Meeting',
        source: 'meeting',
        transcript_text: '   ',
        created_by: userId
      })
      .returning()
      .execute();

    const input: FinaliseMeetingInput = {
      note_id: noteResult[0].id
    };

    await expect(finaliseMeeting(input)).rejects.toThrow(/transcript text/i);
  });
});