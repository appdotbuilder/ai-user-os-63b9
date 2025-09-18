import { db } from '../db';
import { workspacesTable } from '../db/schema';
import { type Workspace } from '../schema';
import { eq } from 'drizzle-orm';

export const getWorkspaces = async (userId: string): Promise<Workspace[]> => {
  try {
    // Fetch workspaces where the user is the owner
    const results = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.owner_id, userId))
      .execute();

    // Convert settings from unknown to Record<string, any> to match Zod schema
    return results.map(workspace => ({
      ...workspace,
      settings: workspace.settings as Record<string, any>
    }));
  } catch (error) {
    console.error('Get workspaces failed:', error);
    throw error;
  }
};