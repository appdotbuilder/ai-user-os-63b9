import { type CreateReminderInput, type Reminder } from '../schema';

export const createReminder = async (input: CreateReminderInput): Promise<Reminder> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is creating a reminder linked to a task.
    // Reminders can be delivered via app push, email, or calendar integration.
    return Promise.resolve({
        id: crypto.randomUUID(),
        task_id: input.task_id,
        remind_at: input.remind_at,
        method: input.method,
        status: 'scheduled' as const,
        created_at: new Date()
    } as Reminder);
};