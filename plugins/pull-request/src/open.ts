import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getSnapshot, workspaceFolders } from '@herdr-plugins/shared'

const workspaceId = process.env.HERDR_WORKSPACE_ID
if (!workspaceId) throw new Error('No workspace in the action context')
const { workspaces, panes } = await getSnapshot()
const folder = workspaceFolders(workspaces, panes).get(workspaceId)
if (!folder) throw new Error(`Workspace ${workspaceId} has no folder`)
// gh finds the pull request of the folder's current branch and opens it in the default browser
await promisify(execFile)('gh', ['pr', 'view', '--web'], {
  cwd: folder,
  env: { ...process.env, GH_PROMPT_DISABLED: '1' },
})
