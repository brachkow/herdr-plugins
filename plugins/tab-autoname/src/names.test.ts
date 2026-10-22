import { faker } from '@faker-js/faker'
import type { Pane, ProcessInfo } from '@herdr-plugins/shared'
import { describe, expect, it } from 'vitest'
import { commandLabel, isOwnedLabel, tabLabel, truncate } from './names.ts'

const HOME = '/Users/someone'

const createPane = (overrides: Partial<Pane> = {}): Pane => ({
  pane_id: 'w1:p1',
  workspace_id: 'w1',
  tab_id: 'w1:t1',
  cwd: `${HOME}/Projects/app`,
  ...overrides,
})

const idleShell = (): ProcessInfo => ({
  shell_pid: 100,
  foreground_process_group_id: 100,
  foreground_processes: [{ pid: 100, name: 'fish', argv: ['-fish'] }],
})

const running = (argv: string[]): ProcessInfo => ({
  shell_pid: 100,
  foreground_process_group_id: 200,
  foreground_processes: [
    { pid: 300, name: 'child', argv: ['child'] },
    { pid: 200, name: argv[0], argv },
  ],
})

describe('commandLabel', () => {
  it('uses the program name for plain programs', () => {
    expect(commandLabel(['lazygit'])).toBe('lazygit')
  })

  it('drops the directory from the program path', () => {
    expect(commandLabel(['/opt/homebrew/bin/btop'])).toBe('btop')
  })

  it('keeps up to two subcommand words for tools like docker', () => {
    expect(commandLabel(['docker', 'compose', 'up', 'web'])).toBe('docker compose up')
  })

  it('skips flags when reading subcommands', () => {
    expect(commandLabel(['pnpm', '--silent', 'dev'])).toBe('pnpm dev')
  })

  it('looks through the shell that runs the pnpm shim', () => {
    const argv = ['/bin/sh', `${HOME}/Library/pnpm/bin/pnpm`, 'run', 'storybook']

    expect(commandLabel(argv)).toBe('pnpm storybook')
  })

  it('drops run from package manager commands', () => {
    expect(commandLabel(['npm', 'run', 'dev'])).toBe('npm dev')
  })

  it('reads the command from sh -c', () => {
    expect(commandLabel(['sh', '-c', 'make build && make test'])).toBe('make build')
  })

  it('names a node script after its npm package', () => {
    const argv = ['node', `${HOME}/app/node_modules/.bin/../vite/bin/vite.js`]

    expect(commandLabel(argv)).toBe('vite')
  })

  it('keeps the scope of a scoped npm package', () => {
    const argv = ['node', `${HOME}/app/node_modules/@scope/tool/dist/cli.js`]

    expect(commandLabel(argv)).toBe('@scope/tool')
  })

  it('names a local script after its file', () => {
    expect(commandLabel(['node', 'scripts/seed.ts'])).toBe('seed')
  })

  it('names python -m after the module', () => {
    expect(commandLabel(['python3', '-m', 'http.server', '8000'])).toBe('http.server')
  })

  it('falls back to the interpreter when it runs no script', () => {
    expect(commandLabel(['node'])).toBe('node')
  })

  it('adds the file name for editors', () => {
    expect(commandLabel(['nvim', 'src/components/Button.vue'])).toBe('nvim Button.vue')
  })
})

describe('tabLabel', () => {
  it('uses the terminal title for agent panes', () => {
    const title = faker.lorem.words(2)
    const pane = createPane({ agent: 'claude', terminal_title_stripped: title })

    expect(tabLabel(pane, undefined, HOME)).toBe(title)
  })

  it('falls back to the agent name when the agent has no title', () => {
    const pane = createPane({ agent: 'codex', terminal_title_stripped: '  ' })

    expect(tabLabel(pane, undefined, HOME)).toBe('codex')
  })

  it('uses the folder name when the shell is idle', () => {
    const pane = createPane({ foreground_cwd: `${HOME}/Projects/zakzak-frontend` })

    expect(tabLabel(pane, idleShell(), HOME)).toBe('zakzak-frontend')
  })

  it('shows ~ for the home folder', () => {
    const pane = createPane({ cwd: HOME })

    expect(tabLabel(pane, idleShell(), HOME)).toBe('~')
  })

  it('names the process group leader, not its children', () => {
    const pane = createPane()

    expect(tabLabel(pane, running(['lazygit']), HOME)).toBe('lazygit')
  })

  it('uses the process name when herdr cannot read argv', () => {
    const info: ProcessInfo = {
      shell_pid: 100,
      foreground_process_group_id: 200,
      foreground_processes: [{ pid: 200, name: 'fzf', argv: null }],
    }

    expect(tabLabel(createPane(), info, HOME)).toBe('fzf')
  })

  it('treats a pane without process info as an idle shell', () => {
    const pane = createPane({ cwd: `${HOME}/Projects/api` })

    expect(tabLabel(pane, undefined, HOME)).toBe('api')
  })

  it('returns nothing when there is no folder to show', () => {
    const pane = createPane({ cwd: undefined })

    expect(tabLabel(pane, idleShell(), HOME)).toBeUndefined()
  })
})

describe('truncate', () => {
  it('keeps short labels as they are', () => {
    expect(truncate('lazygit')).toBe('lazygit')
  })

  it('cuts long labels to 24 characters with an ellipsis', () => {
    const label = truncate('a'.repeat(40))

    expect(label).toHaveLength(24)
    expect(label.endsWith('…')).toBe(true)
  })
})

describe('isOwnedLabel', () => {
  it('owns the numeric labels herdr gives unnamed tabs', () => {
    expect(isOwnedLabel('3', undefined)).toBe(true)
  })

  it('owns a label it set itself', () => {
    expect(isOwnedLabel('lazygit', 'lazygit')).toBe(true)
  })

  it('leaves a label the user set by hand', () => {
    expect(isOwnedLabel('my notes', 'lazygit')).toBe(false)
  })

  it('leaves a hand-set label on a tab it never named', () => {
    expect(isOwnedLabel('deploy', undefined)).toBe(false)
  })
})
