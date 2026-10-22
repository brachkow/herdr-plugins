import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getSnapshot, reportWorkspaceToken, runPoller } from '@herdr-plugins/shared'
import { countChanges, formatChanges, workspaceFolders } from './changes.ts'

const POLL_INTERVAL_MS = 5000
// The token outlives a few missed ticks, but disappears soon after the plugin dies
const TOKEN_TTL_MS = 30_000
const TOKEN_REFRESH_MS = 10_000
const TOKEN_NAME = 'uncommitted'

const run = promisify(execFile)
const source = `plugin:${process.env.HERDR_PLUGIN_ID ?? 'brachkow.uncommitted'}`
const lastReported = new Map<string, { value: string | null; at: number }>()

const readChangeCount = async (folder: string): Promise<number> => {
  try {
    // Without --no-optional-locks a background status can make the user's own git commands fail on index.lock
    const { stdout } = await run('git', ['--no-optional-locks', '-C', folder, 'status', '--porcelain'], {
      maxBuffer: 64 * 1024 * 1024,
    })
    return countChanges(stdout)
  } catch {
    // Not a git repository, or the folder is gone
    return 0
  }
}

const tick = async () => {
  const { workspaces, panes } = await getSnapshot()
  const folders = workspaceFolders(workspaces, panes)
  // Several workspaces can share a repository, so read each folder once
  const counts = new Map(
    await Promise.all([...new Set(folders.values())].map(async (folder) => [folder, await readChangeCount(folder)] as const)),
  )
  const now = Date.now()

  await Promise.all(
    workspaces.map(async ({ workspace_id }) => {
      const folder = folders.get(workspace_id)
      const value = formatChanges(folder ? (counts.get(folder) ?? 0) : 0)
      const previous = lastReported.get(workspace_id)
      const unchanged = previous !== undefined && previous.value === value
      if (unchanged && (value === null || now - previous.at < TOKEN_REFRESH_MS)) return
      await reportWorkspaceToken(workspace_id, source, { [TOKEN_NAME]: value }, TOKEN_TTL_MS)
      lastReported.set(workspace_id, { value, at: now })
    }),
  )

  const openWorkspaces = new Set(workspaces.map(({ workspace_id }) => workspace_id))
  for (const workspaceId of lastReported.keys()) {
    if (!openWorkspaces.has(workspaceId)) lastReported.delete(workspaceId)
  }
}

await runPoller(tick, POLL_INTERVAL_MS)
