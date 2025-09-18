import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type CreateCalendarDraftInput } from '../schema';
import { createCalendarDraft } from '../handlers/create_calendar_draft';

// Test input data
const testInput: CreateCalendarDraftInput = {
  title: 'Team Sprint Planning',
  start: new Date('2024-02-15T10:00:00Z'),
  end: new Date('2024-02-15T12:00:00Z'),
  attendees: ['alice@example.com', 'bob@example.com']
};

const minimalInput: CreateCalendarDraftInput = {
  title: 'Quick Meeting',
  start: new Date('2024-02-16T15:30:00Z'),
  end: new Date('2024-02-16T16:00:00Z')
};

describe('createCalendarDraft', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a calendar draft with all fields', async () => {
    const result = await createCalendarDraft(testInput);

    // Verify the returned draft structure
    expect(result.calendar_event_draft).toBeDefined();
    expect(result.calendar_event_draft.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.calendar_event_draft.title).toEqual('Team Sprint Planning');
    expect(result.calendar_event_draft.start).toEqual(testInput.start);
    expect(result.calendar_event_draft.end).toEqual(testInput.end);
    expect(result.calendar_event_draft.attendees).toEqual(['alice@example.com', 'bob@example.com']);
    expect(result.calendar_event_draft.status).toEqual('draft');
    expect(result.calendar_event_draft.created_at).toBeInstanceOf(Date);
  });

  it('should create a calendar draft without attendees', async () => {
    const result = await createCalendarDraft(minimalInput);

    expect(result.calendar_event_draft).toBeDefined();
    expect(result.calendar_event_draft.title).toEqual('Quick Meeting');
    expect(result.calendar_event_draft.start).toEqual(minimalInput.start);
    expect(result.calendar_event_draft.end).toEqual(minimalInput.end);
    expect(result.calendar_event_draft.attendees).toEqual([]);
    expect(result.calendar_event_draft.status).toEqual('draft');
  });

  it('should handle date objects correctly', async () => {
    const startDate = new Date('2024-03-01T09:00:00Z');
    const endDate = new Date('2024-03-01T10:30:00Z');
    
    const dateInput: CreateCalendarDraftInput = {
      title: 'Date Test Meeting',
      start: startDate,
      end: endDate,
      attendees: ['test@example.com']
    };

    const result = await createCalendarDraft(dateInput);

    // Verify dates are preserved correctly
    expect(result.calendar_event_draft.start).toEqual(startDate);
    expect(result.calendar_event_draft.end).toEqual(endDate);
    expect(result.calendar_event_draft.start.getTime()).toEqual(startDate.getTime());
    expect(result.calendar_event_draft.end.getTime()).toEqual(endDate.getTime());
  });

  it('should create unique draft IDs for multiple calls', async () => {
    const result1 = await createCalendarDraft(testInput);
    const result2 = await createCalendarDraft(minimalInput);

    expect(result1.calendar_event_draft.id).not.toEqual(result2.calendar_event_draft.id);
    
    // Both should be valid UUIDs
    expect(result1.calendar_event_draft.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result2.calendar_event_draft.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should handle empty attendees array correctly', async () => {
    const inputWithEmptyAttendees: CreateCalendarDraftInput = {
      title: 'Solo Meeting',
      start: new Date('2024-02-20T14:00:00Z'),
      end: new Date('2024-02-20T14:30:00Z'),
      attendees: []
    };

    const result = await createCalendarDraft(inputWithEmptyAttendees);

    expect(result.calendar_event_draft.attendees).toEqual([]);
    expect(result.calendar_event_draft.title).toEqual('Solo Meeting');
  });

  it('should handle undefined attendees correctly', async () => {
    const inputWithoutAttendees: CreateCalendarDraftInput = {
      title: 'No Attendees Meeting',
      start: new Date('2024-02-21T16:00:00Z'),
      end: new Date('2024-02-21T17:00:00Z')
      // attendees is undefined
    };

    const result = await createCalendarDraft(inputWithoutAttendees);

    expect(result.calendar_event_draft.attendees).toEqual([]);
    expect(result.calendar_event_draft.title).toEqual('No Attendees Meeting');
  });

  it('should set created_at timestamp correctly', async () => {
    const beforeCreate = new Date();
    const result = await createCalendarDraft(testInput);
    const afterCreate = new Date();

    expect(result.calendar_event_draft.created_at).toBeInstanceOf(Date);
    expect(result.calendar_event_draft.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.calendar_event_draft.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  it('should handle various date formats correctly', async () => {
    const testCases = [
      {
        title: 'UTC Date',
        start: new Date('2024-04-01T14:00:00.000Z'),
        end: new Date('2024-04-01T15:00:00.000Z')
      },
      {
        title: 'Non-UTC Date',
        start: new Date('2024-04-02T09:30:00-05:00'),
        end: new Date('2024-04-02T10:30:00-05:00')
      }
    ];

    for (const testCase of testCases) {
      const input: CreateCalendarDraftInput = {
        title: testCase.title,
        start: testCase.start,
        end: testCase.end,
        attendees: ['attendee@example.com']
      };

      const result = await createCalendarDraft(input);

      expect(result.calendar_event_draft.start).toEqual(testCase.start);
      expect(result.calendar_event_draft.end).toEqual(testCase.end);
      expect(result.calendar_event_draft.title).toEqual(testCase.title);
    }
  });

  it('should preserve attendee email formatting', async () => {
    const complexAttendeesInput: CreateCalendarDraftInput = {
      title: 'Complex Attendees Meeting',
      start: new Date('2024-02-25T11:00:00Z'),
      end: new Date('2024-02-25T12:00:00Z'),
      attendees: [
        'user1@company.com',
        'user.name+tag@example.org',
        'test.email@sub.domain.com'
      ]
    };

    const result = await createCalendarDraft(complexAttendeesInput);

    expect(result.calendar_event_draft.attendees).toEqual([
      'user1@company.com',
      'user.name+tag@example.org',
      'test.email@sub.domain.com'
    ]);
  });
});