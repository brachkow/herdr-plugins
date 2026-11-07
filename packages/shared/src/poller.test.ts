import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { pollerPidFile } from './poller.ts'

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
