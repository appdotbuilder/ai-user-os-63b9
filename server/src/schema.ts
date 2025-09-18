import { z } from 'zod';

// Enums
export const sourceEnum = z.enum(['manual', 'meeting', 'import']);
export const statusEnum = z.enum(['todo', 'doing', 'done']);
export const priorityEnum = z.enum(['low', 'med', 'high']);
export const reminderMethodEnum = z.enum(['app_push', 'email', 'calendar']);
export const reminderStatusEnum = z.enum(['scheduled', 'sent', 'cancelled']);
export const agentEventStatusEnum = z.enum(['draft', 'awaiting_confirmation', 'executed', 'error']);
export const roleEnum = z.enum(['owner', 'member']);
export const llmProviderEnum = z.enum(['openai', 'anthropic', 'google']);

// User schema
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string(),
  timezone: z.string(),
  llm_provider: llmProviderEnum,
  llm_model: z.string(),
  created_at: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

// Workspace schema
export const workspaceSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
  settings: z.record(z.any()), // JSON object
  created_at: z.coerce.date(),
});

export type Workspace = z.infer<typeof workspaceSchema>;

// Note schema
export const noteSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string(),
  source: sourceEnum,
  content_md: z.string().nullable(),
  transcript_text: z.string().nullable(),
  summary_text: z.string().nullable(),
  entities: z.record(z.any()).nullable(), // JSON object
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Note = z.infer<typeof noteSchema>;

// Task schema
export const taskSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: statusEnum,
  priority: priorityEnum,
  due_at: z.coerce.date().nullable(),
  assignee_id: z.string().uuid(),
  linked_note_id: z.string().uuid().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Task = z.infer<typeof taskSchema>;

// Reminder schema
export const reminderSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  remind_at: z.coerce.date(),
  method: reminderMethodEnum,
  status: reminderStatusEnum,
  created_at: z.coerce.date(),
});

export type Reminder = z.infer<typeof reminderSchema>;

// Agent Event schema
export const agentEventSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  agent: z.string(),
  action: z.string(),
  input: z.record(z.any()), // JSON object
  output: z.record(z.any()).nullable(), // JSON object
  status: agentEventStatusEnum,
  created_at: z.coerce.date(),
});

export type AgentEvent = z.infer<typeof agentEventSchema>;

// Input schemas for creating records
export const createUserInputSchema = z.object({
  email: z.string().email(),
  display_name: z.string(),
  timezone: z.string(),
  llm_provider: llmProviderEnum,
  llm_model: z.string(),
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createWorkspaceInputSchema = z.object({
  owner_id: z.string().uuid(),
  name: z.string(),
  settings: z.record(z.any()).optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;

export const createNoteInputSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string(),
  source: sourceEnum,
  content_md: z.string().nullable().optional(),
  transcript_text: z.string().nullable().optional(),
  created_by: z.string().uuid(),
});

export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;

export const createTaskInputSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: statusEnum.default('todo'),
  priority: priorityEnum.default('med'),
  due_at: z.coerce.date().nullable().optional(),
  assignee_id: z.string().uuid(),
  linked_note_id: z.string().uuid().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const createReminderInputSchema = z.object({
  task_id: z.string().uuid(),
  remind_at: z.coerce.date(),
  method: reminderMethodEnum,
});

export type CreateReminderInput = z.infer<typeof createReminderInputSchema>;

export const createAgentEventInputSchema = z.object({
  workspace_id: z.string().uuid(),
  agent: z.string(),
  action: z.string(),
  input: z.record(z.any()),
  status: agentEventStatusEnum.default('draft'),
});

export type CreateAgentEventInput = z.infer<typeof createAgentEventInputSchema>;

// Update schemas
export const updateNoteInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  content_md: z.string().nullable().optional(),
  transcript_text: z.string().nullable().optional(),
  summary_text: z.string().nullable().optional(),
  entities: z.record(z.any()).nullable().optional(),
});

export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>;

export const updateTaskInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  due_at: z.coerce.date().nullable().optional(),
  assignee_id: z.string().uuid().optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const updateAgentEventInputSchema = z.object({
  id: z.string().uuid(),
  status: agentEventStatusEnum,
  output: z.record(z.any()).nullable().optional(),
});

export type UpdateAgentEventInput = z.infer<typeof updateAgentEventInputSchema>;

// Query schemas
export const getTasksQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assignee_id: z.string().uuid().optional(),
});

export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;

export const getNotesQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  source: sourceEnum.optional(),
  limit: z.number().int().positive().optional(),
});

export type GetNotesQuery = z.infer<typeof getNotesQuerySchema>;

// Meeting/transcription related schemas
export const transcribeAudioInputSchema = z.object({
  audio_chunk: z.string(), // base64 encoded audio
  meeting_id: z.string().uuid().optional(),
});

export type TranscribeAudioInput = z.infer<typeof transcribeAudioInputSchema>;

export const finaliseMeetingInputSchema = z.object({
  note_id: z.string().uuid(),
});

export type FinaliseMeetingInput = z.infer<typeof finaliseMeetingInputSchema>;

// Calendar draft schema
export const createCalendarDraftInputSchema = z.object({
  title: z.string(),
  start: z.coerce.date(),
  end: z.coerce.date(),
  attendees: z.array(z.string().email()).optional(),
});

export type CreateCalendarDraftInput = z.infer<typeof createCalendarDraftInputSchema>;