import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { socketPath } from './herdr.ts'

// The server can stall for minutes and then recover, so failed requests only slow the poller down
const MAX_RETRY_DELAY_MS = 60_000

const run = promisify(execFile)

const processStartTime = async (pid: number) => {
  try {
    const { stdout } = await run('ps', ['-p', String(pid), '-o', 'lstart='])
    return stdout.trim()
  } catch {
    return undefined
  }
}

// HERDR_PLUGIN_STATE_DIR is shared by every Herdr session (`herdr --session <name>`), so a single
// pid file lets another session's startup hook kill this session's poller. Each session has its own socket.
export const pollerPidFile = (stateDir: string, socket: string) =>
  join(stateDir, `poller-${createHash('sha256').update(socket).digest('hex').slice(0, 12)}.json`)

// Startup hooks run again on live handoff, so a new instance replaces the old one.
// The start time guards against killing an unrelated process that reused the pid.
const replacePreviousInstance = async () => {
  const stateDir = process.env.HERDR_PLUGIN_STATE_DIR
  if (!stateDir) return
  const pidFile = pollerPidFile(stateDir, socketPath)
  try {
    const previous = JSON.parse(readFileSync(pidFile, 'utf8')) as { pid: number; startedAt: string }
    if (previous.pid !== process.pid && (await processStartTime(previous.pid)) === previous.startedAt) {
      process.kill(previous.pid, 'SIGTERM')
    }
  } catch {
    // No previous instance
  }
  writeFileSync(pidFile, JSON.stringify({ pid: process.pid, startedAt: await processStartTime(process.pid) }))
}

// Doubles the wait after each failed tick in a row, up to a minute, or up to the interval if that is longer
export const retryDelay = (intervalMs: number, failures: number) =>
  Math.min(intervalMs * 2 ** failures, Math.max(intervalMs, MAX_RETRY_DELAY_MS))

// Herdr has no events for most process changes, so plugins poll from a long-lived startup process.
// Pass --once to run a single tick, which is what one-shot actions use.
export const runPoller = async (tick: () => Promise<void>, intervalMs: number) => {
  if (process.argv.includes('--once')) {
    await tick()
    return
  }
  await replacePreviousInstance()
  // Herdr does not stop startup processes. They are children of the server, and the OS
  // gives them a new parent once the server exits, so that is the signal to leave.
  const serverPid = process.ppid
  let failures = 0
  while (process.ppid === serverPid) {
    try {
      await tick()
      failures = 0
    } catch (error) {
      failures++
      console.error(error)
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay(intervalMs, failures)))
  }
  console.error('Stopping because the Herdr server is gone')
}
