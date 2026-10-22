import type { Pane, Workspace } from '@herdr-plugins/shared'

// Counts `git status --porcelain` lines. Each changed, staged or untracked path is one line,
// renames included, and paths with newlines come quoted, so lines map to files.
export const countChanges = (porcelain: string): number =>
  porcelain.split('\n').filter((line) => line.length > 0).length

export const formatChanges = (count: number): string | null => (count === 0 ? null : `±${count}`)

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
