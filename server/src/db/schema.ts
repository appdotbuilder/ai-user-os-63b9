import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  pgEnum,
  json,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const sourceEnum = pgEnum('source', ['manual', 'meeting', 'import']);
export const statusEnum = pgEnum('status', ['todo', 'doing', 'done']);
export const priorityEnum = pgEnum('priority', ['low', 'med', 'high']);
export const reminderMethodEnum = pgEnum('reminder_method', ['app_push', 'email', 'calendar']);
export const reminderStatusEnum = pgEnum('reminder_status', ['scheduled', 'sent', 'cancelled']);
export const agentEventStatusEnum = pgEnum('agent_event_status', ['draft', 'awaiting_confirmation', 'executed', 'error']);
export const roleEnum = pgEnum('role', ['owner', 'member']);
export const llmProviderEnum = pgEnum('llm_provider', ['openai', 'anthropic', 'google']);

// Users table
export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  display_name: text('display_name').notNull(),
  timezone: text('timezone').notNull(),
  llm_provider: llmProviderEnum('llm_provider').notNull(),
  llm_model: text('llm_model').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Workspaces table
export const workspacesTable = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  owner_id: uuid('owner_id').references(() => usersTable.id).notNull(),
  name: text('name').notNull(),
  settings: json('settings').default({}).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Notes table
export const notesTable = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspace_id: uuid('workspace_id').references(() => workspacesTable.id).notNull(),
  title: text('title').notNull(),
  source: sourceEnum('source').notNull(),
  content_md: text('content_md'),
  transcript_text: text('transcript_text'),
  summary_text: text('summary_text'),
  entities: json('entities'),
  created_by: uuid('created_by').references(() => usersTable.id).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceCreatedAtIdx: index('notes_workspace_created_at_idx').on(table.workspace_id, table.created_at),
}));

// Tasks table
export const tasksTable = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspace_id: uuid('workspace_id').references(() => workspacesTable.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: statusEnum('status').notNull().default('todo'),
  priority: priorityEnum('priority').notNull().default('med'),
  due_at: timestamp('due_at'),
  assignee_id: uuid('assignee_id').references(() => usersTable.id).notNull(),
  linked_note_id: uuid('linked_note_id').references(() => notesTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceStatusDueIdx: index('tasks_workspace_status_due_idx').on(table.workspace_id, table.status, table.due_at),
}));

// Reminders table
export const remindersTable = pgTable('reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  task_id: uuid('task_id').references(() => tasksTable.id).notNull(),
  remind_at: timestamp('remind_at').notNull(),
  method: reminderMethodEnum('method').notNull(),
  status: reminderStatusEnum('status').notNull().default('scheduled'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  remindAtIdx: index('reminders_remind_at_idx').on(table.remind_at),
}));

// Agent Events table
export const agentEventsTable = pgTable('agent_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspace_id: uuid('workspace_id').references(() => workspacesTable.id).notNull(),
  agent: text('agent').notNull(),
  action: text('action').notNull(),
  input: json('input').notNull(),
  output: json('output'),
  status: agentEventStatusEnum('status').notNull().default('draft'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  workspaceCreatedAtIdx: index('agent_events_workspace_created_at_idx').on(table.workspace_id, table.created_at),
}));

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  ownedWorkspaces: many(workspacesTable),
  createdNotes: many(notesTable),
  assignedTasks: many(tasksTable),
}));

export const workspacesRelations = relations(workspacesTable, ({ one, many }) => ({
  owner: one(usersTable, {
    fields: [workspacesTable.owner_id],
    references: [usersTable.id],
  }),
  notes: many(notesTable),
  tasks: many(tasksTable),
  agentEvents: many(agentEventsTable),
}));

export const notesRelations = relations(notesTable, ({ one, many }) => ({
  workspace: one(workspacesTable, {
    fields: [notesTable.workspace_id],
    references: [workspacesTable.id],
  }),
  createdBy: one(usersTable, {
    fields: [notesTable.created_by],
    references: [usersTable.id],
  }),
  linkedTasks: many(tasksTable),
}));

export const tasksRelations = relations(tasksTable, ({ one, many }) => ({
  workspace: one(workspacesTable, {
    fields: [tasksTable.workspace_id],
    references: [workspacesTable.id],
  }),
  assignee: one(usersTable, {
    fields: [tasksTable.assignee_id],
    references: [usersTable.id],
  }),
  linkedNote: one(notesTable, {
    fields: [tasksTable.linked_note_id],
    references: [notesTable.id],
  }),
  reminders: many(remindersTable),
}));

export const remindersRelations = relations(remindersTable, ({ one }) => ({
  task: one(tasksTable, {
    fields: [remindersTable.task_id],
    references: [tasksTable.id],
  }),
}));

export const agentEventsRelations = relations(agentEventsTable, ({ one }) => ({
  workspace: one(workspacesTable, {
    fields: [agentEventsTable.workspace_id],
    references: [workspacesTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Workspace = typeof workspacesTable.$inferSelect;
export type NewWorkspace = typeof workspacesTable.$inferInsert;

export type Note = typeof notesTable.$inferSelect;
export type NewNote = typeof notesTable.$inferInsert;

export type Task = typeof tasksTable.$inferSelect;
export type NewTask = typeof tasksTable.$inferInsert;

export type Reminder = typeof remindersTable.$inferSelect;
export type NewReminder = typeof remindersTable.$inferInsert;

export type AgentEvent = typeof agentEventsTable.$inferSelect;
export type NewAgentEvent = typeof agentEventsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  workspaces: workspacesTable,
  notes: notesTable,
  tasks: tasksTable,
  reminders: remindersTable,
  agentEvents: agentEventsTable,
};