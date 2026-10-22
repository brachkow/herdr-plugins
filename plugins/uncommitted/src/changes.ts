// Counts `git status --porcelain` lines. Each changed, staged or untracked path is one line,
// renames included, and paths with newlines come quoted, so lines map to files.
export const countChanges = (porcelain: string): number =>
  porcelain.split('\n').filter((line) => line.length > 0).length

export const formatChanges = (count: number): string | null => (count === 0 ? null : `±${count}`)
