import { db } from '../db';
import { notesTable } from '../db/schema';
import { type CreateNoteInput, type Note } from '../schema';

export const createNote = async (input: CreateNoteInput): Promise<Note> => {
  try {
    // Insert note record
    const result = await db.insert(notesTable)
      .values({
        workspace_id: input.workspace_id,
        title: input.title,
        source: input.source,
        content_md: input.content_md || null,
        transcript_text: input.transcript_text || null,
        created_by: input.created_by,
        // summary_text and entities are not provided in input - they remain null for new notes
        summary_text: null,
        entities: null
      })
      .returning()
      .execute();

    const note = result[0];
    return {
      ...note,
      entities: note.entities as Record<string, any> | null
    };
  } catch (error) {
    console.error('Note creation failed:', error);
    throw error;
  }
};