import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parsePullRequest, PULL_REQUEST_FIELDS, type PullRequest } from './pull-request.ts'

const GH_TIMEOUT_MS = 20_000

const run = promisify(execFile)
// gh must never wait for input, since nobody sees its prompts
const env = { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' }

export const readBranch = async (folder: string): Promise<string | null> => {
  try {
    const { stdout } = await run('git', ['-C', folder, 'branch', '--show-current'])
    return stdout.trim() || null
  } catch {
    // Not a git repository, or the folder is gone
    return null
  }
}

export const readPullRequest = async (folder: string): Promise<PullRequest | null> => {
  try {
    const { stdout } = await run('gh', ['pr', 'view', '--json', PULL_REQUEST_FIELDS], {
      cwd: folder,
      env,
      timeout: GH_TIMEOUT_MS,
    })
    return parsePullRequest(stdout)
  } catch {
    // No pull request for the branch, no GitHub remote, or gh is missing or signed out
    return null
  }
}
