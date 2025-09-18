import { db } from '../db';
import { workspacesTable, usersTable } from '../db/schema';
import { type CreateWorkspaceInput, type Workspace } from '../schema';
import { eq } from 'drizzle-orm';

export const createWorkspace = async (input: CreateWorkspaceInput): Promise<Workspace> => {
  try {
    // Verify that the owner exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.owner_id))
      .limit(1)
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with id ${input.owner_id} not found`);
    }

    // Insert workspace record
    const result = await db.insert(workspacesTable)
      .values({
        owner_id: input.owner_id,
        name: input.name,
        settings: input.settings || {}
      })
      .returning()
      .execute();

    // Cast settings to proper type since it comes back as unknown from JSON
    const workspace = result[0];
    return {
      ...workspace,
      settings: workspace.settings as Record<string, any>
    };
  } catch (error) {
    console.error('Workspace creation failed:', error);
    throw error;
  }
};