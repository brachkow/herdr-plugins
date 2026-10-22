export type ProcessTable = Map<number, number[]>

export type PaneRoot = {
  workspaceId: string
  shellPid: number
}

// Herdr caps token values at 80 characters
const TOKEN_MAX_LENGTH = 80

export const parseProcessTable = (psOutput: string): ProcessTable => {
  const children: ProcessTable = new Map()
  for (const line of psOutput.split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number)
    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) continue
    const siblings = children.get(ppid) ?? []
    siblings.push(pid)
    children.set(ppid, siblings)
  }
  return children
}

// Parses `lsof -F pn` output, where each process starts with a `p<pid>` line
// followed by one `n<address>:<port>` line per listening socket
export const parseListeningPorts = (lsofOutput: string): Map<number, Set<number>> => {
  const portsByPid = new Map<number, Set<number>>()
  let currentPid: number | undefined
  for (const line of lsofOutput.split('\n')) {
    if (line.startsWith('p')) {
      currentPid = Number(line.slice(1))
      continue
    }
    if (!line.startsWith('n') || currentPid === undefined) continue
    const port = Number(line.slice(line.lastIndexOf(':') + 1))
    if (!Number.isInteger(port) || port <= 0) continue
    const ports = portsByPid.get(currentPid) ?? new Set<number>()
    ports.add(port)
    portsByPid.set(currentPid, ports)
  }
  return portsByPid
}

export const collectDescendants = (rootPid: number, children: ProcessTable): number[] => {
  const result: number[] = []
  const seen = new Set<number>()
  const stack = [rootPid]
  while (stack.length > 0) {
    const pid = stack.pop() as number
    if (seen.has(pid)) continue
    seen.add(pid)
    result.push(pid)
    stack.push(...(children.get(pid) ?? []))
  }
  return result
}

export const mapPortsToWorkspaces = (
  panes: PaneRoot[],
  children: ProcessTable,
  portsByPid: Map<number, Set<number>>,
): Map<string, number[]> => {
  const portsByWorkspace = new Map<string, Set<number>>()
  for (const { workspaceId, shellPid } of panes) {
    const ports = portsByWorkspace.get(workspaceId) ?? new Set<number>()
    for (const pid of collectDescendants(shellPid, children)) {
      for (const port of portsByPid.get(pid) ?? []) ports.add(port)
    }
    portsByWorkspace.set(workspaceId, ports)
  }
  return new Map(
    [...portsByWorkspace].map(([workspaceId, ports]) => [workspaceId, [...ports].sort((a, b) => a - b)]),
  )
}

// Ports from the IANA dynamic range are picked at random by tools such as workerd,
// Storybook and Vite for internal channels, so they are noise next to real dev servers
const DYNAMIC_PORT_RANGE_START = 49152

export const withoutDynamicPorts = (ports: number[]): number[] =>
  ports.filter((port) => port < DYNAMIC_PORT_RANGE_START)

// Herdr strips newlines from token values and renders each sidebar row as one line,
// so wrapping means splitting the ports over several tokens, one per row
export const formatPortLines = (ports: number[], lineWidth: number, maxLines: number): string[] => {
  const width = Math.min(lineWidth, TOKEN_MAX_LENGTH)
  const lines: string[][] = []
  for (const part of ports.map((port) => `:${port}`)) {
    const current = lines.at(-1)
    if (current && [...current, part].join(' ').length <= width) {
      current.push(part)
    } else {
      lines.push([part])
    }
  }
  if (lines.length <= maxLines) return lines.map((line) => line.join(' '))

  // Show how many ports did not fit instead of silently dropping them
  const shown = lines.slice(0, maxLines)
  const last = shown[maxLines - 1]
  const hiddenCount = () => ports.length - shown.flat().length
  while (last.length > 1 && [...last, `+${hiddenCount() + 1}`].join(' ').length > width) last.pop()
  last.push(`+${hiddenCount()}`)
  return shown.map((line) => line.join(' '))
}
