import type { Pane, Workspace } from './herdr.ts'

type WorkspaceWithWorktree = Workspace & { worktree?: { checkout_path: string } }

// Herdr reads the branch from the folder a workspace started in, but does not expose that folder.
// A worktree workspace reports its checkout; otherwise the first pane is the one the workspace started with.
export const workspaceFolders = (workspaces: WorkspaceWithWorktree[], panes: Pane[]): Map<string, string> => {
  const folders = new Map<string, string>()
  for (const { workspace_id, worktree } of workspaces) {
    const folder = worktree?.checkout_path ?? panes.find((pane) => pane.workspace_id === workspace_id)?.cwd
    if (folder) folders.set(workspace_id, folder)
  }
  return folders
}
