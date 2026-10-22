import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { workspaceFolders } from './folders.ts'
import type { Pane } from './herdr.ts'

const createPane = (workspaceId: string, cwd: string): Pane => ({
  pane_id: `${workspaceId}:p${faker.number.int(99)}`,
  workspace_id: workspaceId,
  tab_id: `${workspaceId}:t1`,
  cwd,
})

describe('workspaceFolders', () => {
  it('uses the first pane of the workspace', () => {
    const panes = [createPane('w1', '/repo/app'), createPane('w1', '/repo/app/packages/ui')]

    const folders = workspaceFolders([{ workspace_id: 'w1' }], panes)

    expect(folders.get('w1')).toBe('/repo/app')
  })

  it('prefers the checkout path of a worktree workspace', () => {
    const workspaces = [{ workspace_id: 'w1', worktree: { checkout_path: '/repo/.worktrees/feature' } }]

    const folders = workspaceFolders(workspaces, [createPane('w1', '/somewhere/else')])

    expect(folders.get('w1')).toBe('/repo/.worktrees/feature')
  })

  it('skips a workspace without panes', () => {
    const folders = workspaceFolders([{ workspace_id: 'w1' }], [createPane('w2', '/repo')])

    expect(folders.has('w1')).toBe(false)
  })
})
