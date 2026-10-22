import { describe, expect, it } from 'vitest'
import { countChanges, formatChanges } from './changes.ts'

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
