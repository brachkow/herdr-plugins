import { faker } from '@faker-js/faker'
import type { Pane } from '@herdr-plugins/shared'
import { describe, expect, it } from 'vitest'
import { countChanges, formatChanges, workspaceFolders } from './changes.ts'

const createPane = (workspaceId: string, cwd: string): Pane => ({
  pane_id: `${workspaceId}:p${faker.number.int(99)}`,
  workspace_id: workspaceId,
  tab_id: `${workspaceId}:t1`,
  cwd,
})

describe('countChanges', () => {
  it('counts modified, staged and untracked files', () => {
    const porcelain = ' M src/index.ts\nM  README.md\n?? notes.txt\n'

    expect(countChanges(porcelain)).toBe(3)
  })

  it('counts a rename as one file', () => {
    expect(countChanges('R  old.ts -> new.ts\n')).toBe(1)
  })

  it('counts a quoted path with a newline as one file', () => {
    expect(countChanges('?? "weird\\nname.txt"\n')).toBe(1)
  })

  it('returns 0 for a clean repository', () => {
    expect(countChanges('')).toBe(0)
  })
})

describe('formatChanges', () => {
  it('returns null for no changes so the token gets cleared', () => {
    expect(formatChanges(0)).toBeNull()
  })

  it('prefixes the count with ±', () => {
    expect(formatChanges(12)).toBe('±12')
  })
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
