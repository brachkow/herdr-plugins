import { getSnapshot, reportWorkspaceToken, runPoller, workspaceFolders } from '@herdr-plugins/shared'
import { readBranch, readPullRequest } from './github.ts'
import { formatPullRequest, needsLookup, type Lookup } from './pull-request.ts'

const POLL_INTERVAL_MS = 5000
// Pull requests get opened and merged on GitHub without any local change to notice
const LOOKUP_MAX_AGE_MS = 120_000
// The token outlives a few missed ticks, but disappears soon after the plugin dies
const TOKEN_TTL_MS = 30_000
const TOKEN_REFRESH_MS = 10_000
const TOKEN_NAME = 'pr'

const source = `plugin:${process.env.HERDR_PLUGIN_ID ?? 'brachkow.pull-request'}`
const lookups = new Map<string, Lookup>()
const lastReported = new Map<string, { value: string | null; at: number }>()

const lookUp = async (folder: string, now: number): Promise<string | null> => {
  const branch = await readBranch(folder)
  if (!branch) {
    lookups.delete(folder)
    return null
  }
  const previous = lookups.get(folder)
  if (previous && !needsLookup(previous, branch, now, LOOKUP_MAX_AGE_MS)) return previous.value
  const value = formatPullRequest(await readPullRequest(folder))
  lookups.set(folder, { branch, value, at: now })
  return value
}

const tick = async () => {
  const { workspaces, panes } = await getSnapshot()
  const folders = workspaceFolders(workspaces, panes)
  const now = Date.now()
  // Several workspaces can share a folder, so look each one up once
  const values = new Map(
    await Promise.all([...new Set(folders.values())].map(async (folder) => [folder, await lookUp(folder, now)] as const)),
  )

  await Promise.all(
    workspaces.map(async ({ workspace_id }) => {
      const folder = folders.get(workspace_id)
      const value = folder ? (values.get(folder) ?? null) : null
      const previous = lastReported.get(workspace_id)
      const unchanged = previous !== undefined && previous.value === value
      if (unchanged && (value === null || now - previous.at < TOKEN_REFRESH_MS)) return
      await reportWorkspaceToken(workspace_id, source, { [TOKEN_NAME]: value }, TOKEN_TTL_MS)
      lastReported.set(workspace_id, { value, at: now })
    }),
  )

  const openFolders = new Set(folders.values())
  for (const folder of lookups.keys()) {
    if (!openFolders.has(folder)) lookups.delete(folder)
  }
  const openWorkspaces = new Set(workspaces.map(({ workspace_id }) => workspace_id))
  for (const workspaceId of lastReported.keys()) {
    if (!openWorkspaces.has(workspaceId)) lastReported.delete(workspaceId)
  }
}

await runPoller(tick, POLL_INTERVAL_MS)
