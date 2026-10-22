import { basename, extname, normalize } from 'node:path'
import type { ForegroundProcess, Pane, ProcessInfo } from '@herdr-plugins/shared'

const MAX_LABEL_LENGTH = 24

const SHELLS = new Set(['sh', 'bash', 'zsh', 'fish', 'nu', 'dash', 'ksh', 'tcsh', 'csh', 'elvish', 'xonsh'])
// For these the script tells more than the interpreter, e.g. `node .../vite.js` is "vite"
const INTERPRETERS = new Set(['node', 'bun', 'deno', 'python', 'python3', 'ruby', 'perl', 'tsx', 'php'])
// For these the subcommand tells what runs, e.g. `docker compose up`
const SUBCOMMAND_TOOLS = new Set([
  'pnpm', 'npm', 'yarn', 'npx', 'pnpx', 'bunx', 'cargo', 'go', 'make', 'just', 'mise', 'docker',
  'kubectl', 'git', 'uv', 'brew', 'rails', 'bundle', 'mix', 'gradle', 'mvn',
])
// `pnpm run dev` and `pnpm dev` do the same thing, so the shorter label wins
const FILLER_SUBCOMMANDS = new Set(['run', 'exec'])
const EDITORS =new Set(['vim', 'nvim', 'vi', 'hx', 'helix', 'nano', 'micro', 'emacs', 'kak'])
const MAX_SUBCOMMAND_WORDS = 2

const commandName = (path: string) => basename(path).replace(/^-/, '')

const positionalArgs = (args: string[]) => args.filter((arg) => !arg.startsWith('-'))

// Prefers the npm package name over the file name, so `node_modules/.bin/../vite/bin/vite.js` reads "vite"
const scriptName = (scriptPath: string) => {
  const packageMatch = normalize(scriptPath).match(/node_modules\/((?:@[^/]+\/)?[^/.][^/]*)\//)
  if (packageMatch) return packageMatch[1]
  return basename(scriptPath, extname(scriptPath))
}

const interpreterLabel = (name: string, args: string[]) => {
  const moduleFlag = args.indexOf('-m')
  if (moduleFlag !== -1 && args[moduleFlag + 1]) return args[moduleFlag + 1]
  const script = positionalArgs(args)[0]
  return script ? scriptName(script) : name
}

export const commandLabel = (argv: string[]): string => {
  const [first, ...args] = argv
  const name = commandName(first)

  // Package manager shims like pnpm are shell scripts, so the shell runs them as `sh /path/pnpm run dev`
  const script = args[0]
  if (SHELLS.has(name) && script && !script.startsWith('-')) return commandLabel(args)
  if (SHELLS.has(name) && args[0] === '-c' && args[1]) {
    // Name the first command of a chain like `make build && make test`
    const firstCommand = args[1].split(/&&|\|\||[;|&]/)[0].trim()
    if (firstCommand) return commandLabel(firstCommand.split(/\s+/))
  }

  if (INTERPRETERS.has(name)) return interpreterLabel(name, args)
  if (SUBCOMMAND_TOOLS.has(name)) {
    const words = positionalArgs(args).filter((arg) => !FILLER_SUBCOMMANDS.has(arg))
    return [name, ...words.slice(0, MAX_SUBCOMMAND_WORDS)].join(' ')
  }
  if (EDITORS.has(name)) {
    const file = positionalArgs(args)[0]
    return file ? `${name} ${basename(file)}` : name
  }
  return name
}

const groupLeader = (info: ProcessInfo): ForegroundProcess | undefined =>
  info.foreground_processes.find(({ pid }) => pid === info.foreground_process_group_id) ??
  info.foreground_processes.at(-1)

const folderLabel = (path: string | undefined, home: string) => {
  if (!path) return undefined
  if (path === home) return '~'
  return basename(path)
}

export const truncate = (label: string) =>
  label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label

export const tabLabel = (pane: Pane, info: ProcessInfo | undefined, home: string): string | undefined => {
  const title = pane.terminal_title_stripped?.trim()
  if (pane.agent && title) return truncate(title)
  if (pane.agent) return pane.agent

  const leader = info ? groupLeader(info) : undefined
  const isIdleShell = !leader || leader.pid === info?.shell_pid
  if (isIdleShell) {
    const folder = folderLabel(pane.foreground_cwd ?? pane.cwd, home)
    return folder ? truncate(folder) : undefined
  }

  const argv = leader.argv && leader.argv.length > 0 ? leader.argv : [leader.name]
  return truncate(commandLabel(argv))
}

// Herdr shows unnamed tabs by position and does not expose whether a label was set by hand,
// so a tab is ours when its label is a number or the last label we gave it
export const isOwnedLabel = (label: string, lastSetLabel: string | undefined) =>
  /^\d+$/.test(label) || label === lastSetLabel
