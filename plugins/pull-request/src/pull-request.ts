export type PullRequest = { number: number; state: 'OPEN' | 'CLOSED' | 'MERGED'; isDraft: boolean }

// Fields for `gh pr view --json`
export const PULL_REQUEST_FIELDS = 'number,state,isDraft'

export const parsePullRequest = (json: string): PullRequest | null => {
  try {
    const value: unknown = JSON.parse(json)
    if (typeof value !== 'object' || value === null) return null
    const { number, state, isDraft } = value as Record<string, unknown>
    if (typeof number !== 'number' || !['OPEN', 'CLOSED', 'MERGED'].includes(String(state))) return null
    return { number, state: state as PullRequest['state'], isDraft: isDraft === true }
  } catch {
    return null
  }
}

const SUFFIXES: Record<PullRequest['state'], string> = { OPEN: '', MERGED: ' merged', CLOSED: ' closed' }

export const formatPullRequest = (pullRequest: PullRequest | null): string | null => {
  if (!pullRequest) return null
  const suffix = pullRequest.state === 'OPEN' && pullRequest.isDraft ? ' draft' : SUFFIXES[pullRequest.state]
  return `#${pullRequest.number}${suffix}`
}

export type Lookup = { branch: string; value: string | null; at: number }

// Asking GitHub costs a network call, so a folder is looked up again only after
// its branch changes or the last answer gets old
export const needsLookup = (previous: Lookup | undefined, branch: string, now: number, maxAgeMs: number): boolean =>
  previous === undefined || previous.branch !== branch || now - previous.at >= maxAgeMs
