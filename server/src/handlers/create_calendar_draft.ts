import { type CreateCalendarDraftInput } from '../schema';

export const createCalendarDraft = async (input: CreateCalendarDraftInput): Promise<{ calendar_event_draft: any }> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is creating a draft calendar event via Google Calendar API.
    // This is used by the SchedulerAgent to propose calendar events that require user approval.
    return Promise.resolve({
        calendar_event_draft: {
            id: crypto.randomUUID(),
            title: input.title,
            start: input.start,
            end: input.end,
            attendees: input.attendees || [],
            status: 'draft'
        }
    });
};