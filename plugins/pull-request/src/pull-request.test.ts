import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { formatPullRequest, needsLookup, parsePullRequest } from './pull-request.ts'

describe('parsePullRequest', () => {
  it('reads the number, state and draft flag from gh output', () => {
    const json = '{"isDraft":true,"number":503,"state":"OPEN"}\n'

    expect(parsePullRequest(json)).toEqual({ number: 503, state: 'OPEN', isDraft: true })
  })

  it('returns null for output that is not JSON', () => {
    expect(parsePullRequest('no pull requests found for branch "main"')).toBeNull()
  })

  it('returns null for an unknown state', () => {
    expect(parsePullRequest('{"isDraft":false,"number":1,"state":"LOCKED"}')).toBeNull()
  })
})

describe('formatPullRequest', () => {
  it('shows an open pull request as its number', () => {
    const number = faker.number.int({ min: 1, max: 9999 })

    expect(formatPullRequest({ number, state: 'OPEN', isDraft: false })).toBe(`#${number}`)
  })

  it('marks a draft', () => {
    expect(formatPullRequest({ number: 7, state: 'OPEN', isDraft: true })).toBe('#7 draft')
  })

  it('marks a merged pull request', () => {
    expect(formatPullRequest({ number: 511, state: 'MERGED', isDraft: false })).toBe('#511 merged')
  })

  it('marks a closed pull request, even one closed as a draft', () => {
    expect(formatPullRequest({ number: 12, state: 'CLOSED', isDraft: true })).toBe('#12 closed')
  })

  it('returns null without a pull request so the token gets cleared', () => {
    expect(formatPullRequest(null)).toBeNull()
  })
})

describe('needsLookup', () => {
  const maxAgeMs = 120_000
  const branch = 'feature'

  it('looks up a folder seen for the first time', () => {
    expect(needsLookup(undefined, branch, 0, maxAgeMs)).toBe(true)
  })

  it('reuses a recent answer for the same branch', () => {
    const previous = { branch, value: '#1', at: 1000 }

    expect(needsLookup(previous, branch, 1000 + maxAgeMs - 1, maxAgeMs)).toBe(false)
  })

  it('looks up again after the branch changes', () => {
    const previous = { branch: 'main', value: null, at: 1000 }

    expect(needsLookup(previous, branch, 1001, maxAgeMs)).toBe(true)
  })

  it('looks up again once the answer is old', () => {
    const previous = { branch, value: '#1', at: 1000 }

    expect(needsLookup(previous, branch, 1000 + maxAgeMs, maxAgeMs)).toBe(true)
  })
})
