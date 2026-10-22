import { connect } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REQUEST_TIMEOUT_MS = 5000

const socketPath = process.env.HERDR_SOCKET_PATH ?? join(homedir(), '.config', 'herdr', 'herdr.sock')

let requestCounter = 0

// The socket answers one newline-delimited JSON request per connection
export const request = <T>(method: string, params: Record<string, unknown> = {}): Promise<T> =>
  new Promise((resolve, reject) => {
    const id = `${process.env.HERDR_PLUGIN_ID ?? 'herdr-plugins'}:${++requestCounter}`
    const socket = connect(socketPath)
    let buffer = ''
    socket.setTimeout(REQUEST_TIMEOUT_MS, () => socket.destroy(new Error(`${method} timed out`)))
    socket.on('connect', () => socket.write(`${JSON.stringify({ id, method, params })}\n`))
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      socket.end()
      const response = JSON.parse(buffer.slice(0, newline))
      if (response.error) {
        reject(new Error(`${method}: ${response.error.code} ${response.error.message}`))
        return
      }
      resolve(response.result as T)
    })
    socket.on('error', reject)
  })

export type Workspace = { workspace_id: string; tokens?: Record<string, string> }
export type Tab = { tab_id: string; workspace_id: string; label: string }
export type Pane = {
  pane_id: string
  workspace_id: string
  tab_id: string
  agent?: string
  cwd?: string
  foreground_cwd?: string
  terminal_title_stripped?: string
}
export type Layout = { tab_id: string; focused_pane_id?: string }
export type Snapshot = { workspaces: Workspace[]; tabs: Tab[]; panes: Pane[]; layouts: Layout[] }

export type ForegroundProcess = { pid: number; name: string; argv?: string[] | null }
export type ProcessInfo = {
  shell_pid?: number
  foreground_process_group_id?: number
  foreground_processes: ForegroundProcess[]
}

export const getSnapshot = async (): Promise<Snapshot> =>
  (await request<{ snapshot: Snapshot }>('session.snapshot')).snapshot

export const listWorkspaces = async (): Promise<Workspace[]> =>
  (await request<{ workspaces: Workspace[] }>('workspace.list')).workspaces

export const listPanes = async (): Promise<Pane[]> => (await request<{ panes: Pane[] }>('pane.list')).panes

export const getProcessInfo = async (paneId: string): Promise<ProcessInfo> =>
  (await request<{ process_info: ProcessInfo }>('pane.process_info', { pane_id: paneId })).process_info

export const renameTab = (tabId: string, label: string) => request('tab.rename', { tab_id: tabId, label })

export const reportWorkspaceToken = (
  workspaceId: string,
  source: string,
  tokens: Record<string, string | null>,
  ttlMs: number,
) => request('workspace.report_metadata', { workspace_id: workspaceId, source, tokens, ttl_ms: ttlMs })
