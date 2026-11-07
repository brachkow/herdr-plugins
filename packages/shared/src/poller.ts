import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { socketPath } from './herdr.ts'

// Herdr does not stop startup processes, so leave on our own once the server is gone
const MAX_CONSECUTIVE_FAILURES = 10

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

// Herdr has no events for most process changes, so plugins poll from a long-lived startup process.
// Pass --once to run a single tick, which is what one-shot actions use.
export const runPoller = async (tick: () => Promise<void>, intervalMs: number) => {
  if (process.argv.includes('--once')) {
    await tick()
    return
  }
  await replacePreviousInstance()
  let failures = 0
  while (failures < MAX_CONSECUTIVE_FAILURES) {
    try {
      await tick()
      failures = 0
    } catch (error) {
      failures++
      console.error(error)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  console.error(`Stopping after ${MAX_CONSECUTIVE_FAILURES} failed updates in a row`)
}
