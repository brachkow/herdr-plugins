import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getProcessInfo, listPanes, listWorkspaces, reportWorkspaceToken, runPoller } from '@herdr-plugins/shared'
import {
  formatPortLines,
  mapPortsToWorkspaces,
  parseListeningPorts,
  parseProcessTable,
  withoutDynamicPorts,
  type PaneRoot,
} from './ports.ts'

const POLL_INTERVAL_MS = 3000
// The token outlives a few missed ticks, but disappears soon after the plugin dies
const TOKEN_TTL_MS = 30_000
const TOKEN_REFRESH_MS = 10_000
// Fits the default 26-column sidebar with its indent; the config needs one row per line token
const LINE_WIDTH = 20
const MAX_LINES = 4
const lineTokenName = (index: number) => `ports${index + 1}`

const run = promisify(execFile)
const source = `plugin:${process.env.HERDR_PLUGIN_ID ?? 'brachkow.workspace-ports'}`
const lastReported = new Map<string, { value: string | null; at: number }>()

const readListeningPorts = async () => {
  try {
    const { stdout } = await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn'])
    return parseListeningPorts(stdout)
  } catch (error) {
    // lsof exits with 1 when there is nothing to list
    const stdout = (error as { stdout?: string }).stdout ?? ''
    return parseListeningPorts(stdout)
  }
}

const readProcessTable = async () => {
  const { stdout } = await run('ps', ['-axo', 'pid=,ppid='])
  return parseProcessTable(stdout)
}

const readPaneRoots = async (): Promise<PaneRoot[]> => {
  const panes = await listPanes()
  const roots = await Promise.all(
    panes.map(async ({ pane_id, workspace_id }) => {
      // A pane can close between the list and this call
      const shellPid = await getProcessInfo(pane_id).then(
        ({ shell_pid }) => shell_pid,
        () => undefined,
      )
      return shellPid === undefined ? undefined : { workspaceId: workspace_id, shellPid }
    }),
  )
  return roots.filter((root) => root !== undefined)
}

const tick = async () => {
  const [workspaces, paneRoots, children, portsByPid] = await Promise.all([
    listWorkspaces(),
    readPaneRoots(),
    readProcessTable(),
    readListeningPorts(),
  ])
  const portsByWorkspace = mapPortsToWorkspaces(paneRoots, children, portsByPid)
  const now = Date.now()

  await Promise.all(
    workspaces.map(async ({ workspace_id }) => {
      const lines = formatPortLines(withoutDynamicPorts(portsByWorkspace.get(workspace_id) ?? []), LINE_WIDTH, MAX_LINES)
      // null clears the rows that are not needed anymore
      const tokens = Object.fromEntries(
        Array.from({ length: MAX_LINES }, (_, index) => [lineTokenName(index), lines[index] ?? null]),
      )
      const value = lines.length === 0 ? null : lines.join('\n')
      const previous = lastReported.get(workspace_id)
      const unchanged = previous !== undefined && previous.value === value
      if (unchanged && (value === null || now - previous.at < TOKEN_REFRESH_MS)) return
      await reportWorkspaceToken(workspace_id, source, tokens, TOKEN_TTL_MS)
      lastReported.set(workspace_id, { value, at: now })
    }),
  )

  const openWorkspaces = new Set(workspaces.map(({ workspace_id }) => workspace_id))
  for (const workspaceId of lastReported.keys()) {
    if (!openWorkspaces.has(workspaceId)) lastReported.delete(workspaceId)
  }
}

await runPoller(tick, POLL_INTERVAL_MS)
