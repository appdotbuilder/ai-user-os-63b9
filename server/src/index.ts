import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createWorkspaceInputSchema,
  createNoteInputSchema,
  updateNoteInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  createReminderInputSchema,
  createAgentEventInputSchema,
  updateAgentEventInputSchema,
  getTasksQuerySchema,
  getNotesQuerySchema,
  transcribeAudioInputSchema,
  finaliseMeetingInputSchema,
  createCalendarDraftInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { createWorkspace } from './handlers/create_workspace';
import { createNote } from './handlers/create_note';
import { updateNote } from './handlers/update_note';
import { getNotes } from './handlers/get_notes';
import { createTask } from './handlers/create_task';
import { updateTask } from './handlers/update_task';
import { getTasks } from './handlers/get_tasks';
import { createReminder } from './handlers/create_reminder';
import { getReminders } from './handlers/get_reminders';
import { createAgentEvent } from './handlers/create_agent_event';
import { updateAgentEvent } from './handlers/update_agent_event';
import { getAgentEvents } from './handlers/get_agent_events';
import { transcribeAudio } from './handlers/transcribe_audio';
import { finaliseMeeting } from './handlers/finalise_meeting';
import { createCalendarDraft } from './handlers/create_calendar_draft';
import { getUser } from './handlers/get_user';
import { getWorkspaces } from './handlers/get_workspaces';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  getUser: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(({ input }) => getUser(input.userId)),

  // Workspace management
  createWorkspace: publicProcedure
    .input(createWorkspaceInputSchema)
    .mutation(({ input }) => createWorkspace(input)),
  
  getWorkspaces: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(({ input }) => getWorkspaces(input.userId)),

  // Notes management
  createNote: publicProcedure
    .input(createNoteInputSchema)
    .mutation(({ input }) => createNote(input)),
  
  updateNote: publicProcedure
    .input(updateNoteInputSchema)
    .mutation(({ input }) => updateNote(input)),
  
  getNotes: publicProcedure
    .input(getNotesQuerySchema)
    .query(({ input }) => getNotes(input)),

  // Tasks management
  createTask: publicProcedure
    .input(createTaskInputSchema)
    .mutation(({ input }) => createTask(input)),
  
  updateTask: publicProcedure
    .input(updateTaskInputSchema)
    .mutation(({ input }) => updateTask(input)),
  
  getTasks: publicProcedure
    .input(getTasksQuerySchema)
    .query(({ input }) => getTasks(input)),

  // Reminders management
  createReminder: publicProcedure
    .input(createReminderInputSchema)
    .mutation(({ input }) => createReminder(input)),
  
  getReminders: publicProcedure
    .query(() => getReminders()),

  // Agent events management
  createAgentEvent: publicProcedure
    .input(createAgentEventInputSchema)
    .mutation(({ input }) => createAgentEvent(input)),
  
  updateAgentEvent: publicProcedure
    .input(updateAgentEventInputSchema)
    .mutation(({ input }) => updateAgentEvent(input)),
  
  getAgentEvents: publicProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(({ input }) => getAgentEvents(input.workspaceId)),

  // Meeting/transcription functionality
  transcribeAudio: publicProcedure
    .input(transcribeAudioInputSchema)
    .mutation(({ input }) => transcribeAudio(input)),
  
  finaliseMeeting: publicProcedure
    .input(finaliseMeetingInputSchema)
    .mutation(({ input }) => finaliseMeeting(input)),

  // Calendar integration
  createCalendarDraft: publicProcedure
    .input(createCalendarDraftInputSchema)
    .mutation(({ input }) => createCalendarDraft(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`AI User Operating System TRPC server listening at port: ${port}`);
}

start();