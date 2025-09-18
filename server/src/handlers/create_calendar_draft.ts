import { type CreateCalendarDraftInput } from '../schema';

export interface CalendarEventDraft {
  id: string;
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
  status: 'draft';
  created_at: Date;
}

export const createCalendarDraft = async (input: CreateCalendarDraftInput): Promise<{ calendar_event_draft: CalendarEventDraft }> => {
  try {
    // Create a unique draft ID
    const draftId = crypto.randomUUID();
    
    // Create calendar event draft object
    const calendarEventDraft: CalendarEventDraft = {
      id: draftId,
      title: input.title,
      start: input.start,
      end: input.end,
      attendees: input.attendees || [],
      status: 'draft',
      created_at: new Date()
    };

    // In a real implementation, this would integrate with Google Calendar API
    // and create a proper draft event that can be confirmed later.
    // For now, we return the draft directly without database storage
    // since this is a lightweight calendar draft creation.
    
    return {
      calendar_event_draft: calendarEventDraft
    };
  } catch (error) {
    console.error('Calendar draft creation failed:', error);
    throw error;
  }
};