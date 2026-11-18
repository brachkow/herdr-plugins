import { faker } from '@faker-js/faker'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pollerPidFile, retryDelay, runPoller } from './poller.ts'

describe('pollerPidFile', () => {
  it('gives each Herdr session its own file', () => {
    const stateDir = faker.system.directoryPath()

    const main = pollerPidFile(stateDir, '/home/user/.config/herdr/herdr.sock')
    const other = pollerPidFile(stateDir, '/home/user/.config/herdr/sessions/test/herdr.sock')

    expect(main).not.toBe(other)
  })

  it('keeps the same file for the same socket, so live handoff replaces the old poller', () => {
    const stateDir = faker.system.directoryPath()
    const socket = faker.system.filePath()

    expect(pollerPidFile(stateDir, socket)).toBe(pollerPidFile(stateDir, socket))
  })

  it('stays inside the plugin state directory', () => {
    const stateDir = faker.system.directoryPath()

    expect(pollerPidFile(stateDir, faker.system.filePath()).startsWith(`${stateDir}/`)).toBe(true)
  })
})

describe('retryDelay', () => {
  it('waits one interval while ticks succeed', () => {
    expect(retryDelay(5000, 0)).toBe(5000)
  })

  it('doubles the wait after each failed tick in a row', () => {
    expect(retryDelay(5000, 1)).toBe(10_000)
    expect(retryDelay(5000, 2)).toBe(20_000)
  })

  it('waits no longer than a minute during a long outage', () => {
    expect(retryDelay(5000, 50)).toBe(60_000)
  })

  it('keeps an interval longer than a minute', () => {
    expect(retryDelay(120_000, 3)).toBe(120_000)
  })
})

describe('runPoller', () => {
  const realPpid = process.ppid
  const setParent = (pid: number) => Object.defineProperty(process, 'ppid', { value: pid, configurable: true })

  afterEach(() => {
    setParent(realPpid)
    vi.restoreAllMocks()
  })

  it('keeps polling through failed ticks while the server is alive', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let calls = 0
    const tick = async () => {
      calls++
      if (calls === 30) setParent(1)
      throw new Error('session.snapshot timed out')
    }

    await runPoller(tick, 0)

    expect(calls).toBe(30)
  })

  it('stops once the server process is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const tick = vi.fn(async () => {
      setParent(1)
    })

    await runPoller(tick, 0)

    expect(tick).toHaveBeenCalledTimes(1)
  })
})
