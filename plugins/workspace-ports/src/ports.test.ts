import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import {
  collectDescendants,
  formatPortLines,
  mapPortsToWorkspaces,
  parseListeningPorts,
  parseProcessTable,
  withoutDynamicPorts,
} from './ports.ts'

const randomPort = () => faker.internet.port()

describe('parseProcessTable', () => {
  it('groups child pids by parent pid', () => {
    const output = '  100     1\n  200   100\n  300   100\n'

    const table = parseProcessTable(output)

    expect(table.get(100)).toEqual([200, 300])
  })

  it('ignores blank and malformed lines', () => {
    const output = '\n  garbage\n  200   100\n'

    const table = parseProcessTable(output)

    expect([...table.keys()]).toEqual([100])
  })
})

describe('parseListeningPorts', () => {
  it('reads IPv4, IPv6 and wildcard addresses', () => {
    const output = 'p42\nn127.0.0.1:3000\nn[::1]:3001\nn*:3002\n'

    const ports = parseListeningPorts(output)

    expect(ports.get(42)).toEqual(new Set([3000, 3001, 3002]))
  })

  it('deduplicates a port bound on both IPv4 and IPv6', () => {
    const port = randomPort()
    const output = `p42\nn*:${port}\nn[::]:${port}\n`

    const ports = parseListeningPorts(output)

    expect(ports.get(42)).toEqual(new Set([port]))
  })

  it('keeps ports of different processes apart', () => {
    const output = 'p1\nn*:80\np2\nn*:443\n'

    const ports = parseListeningPorts(output)

    expect(ports.get(2)).toEqual(new Set([443]))
  })

  it('returns nothing for empty lsof output', () => {
    const ports = parseListeningPorts('')

    expect(ports.size).toBe(0)
  })
})

describe('collectDescendants', () => {
  it('includes the root and every nested child', () => {
    const table = new Map([
      [1, [2]],
      [2, [3, 4]],
    ])

    const pids = collectDescendants(1, table)

    expect(pids.sort()).toEqual([1, 2, 3, 4])
  })

  it('does not loop forever on a cycle', () => {
    const table = new Map([
      [1, [2]],
      [2, [1]],
    ])

    const pids = collectDescendants(1, table)

    expect(pids.sort()).toEqual([1, 2])
  })
})

describe('mapPortsToWorkspaces', () => {
  it('attributes a port to the workspace of the pane that spawned the server', () => {
    // shell 10 -> pnpm 11 -> node 12 listening on 5173
    const children = new Map([
      [10, [11]],
      [11, [12]],
    ])
    const portsByPid = new Map([[12, new Set([5173])]])

    const result = mapPortsToWorkspaces([{ workspaceId: 'w1', shellPid: 10 }], children, portsByPid)

    expect(result.get('w1')).toEqual([5173])
  })

  it('merges and sorts ports from several panes of one workspace', () => {
    const portsByPid = new Map([
      [10, new Set([8080])],
      [20, new Set([3000])],
    ])
    const panes = [
      { workspaceId: 'w1', shellPid: 10 },
      { workspaceId: 'w1', shellPid: 20 },
    ]

    const result = mapPortsToWorkspaces(panes, new Map(), portsByPid)

    expect(result.get('w1')).toEqual([3000, 8080])
  })

  it('ignores ports of processes outside every pane', () => {
    const portsByPid = new Map([[99, new Set([7000])]])

    const result = mapPortsToWorkspaces([{ workspaceId: 'w1', shellPid: 10 }], new Map(), portsByPid)

    expect(result.get('w1')).toEqual([])
  })
})

describe('withoutDynamicPorts', () => {
  it('drops ports from 49152 up and keeps the ones below', () => {
    const result = withoutDynamicPorts([3000, 49151, 49152, 64554])

    expect(result).toEqual([3000, 49151])
  })
})

describe('formatPortLines', () => {
  it('returns no lines when there are no ports', () => {
    expect(formatPortLines([], 20, 4)).toEqual([])
  })

  it('prefixes each port with a colon', () => {
    expect(formatPortLines([3000, 5173], 20, 4)).toEqual([':3000 :5173'])
  })

  it('moves a port that does not fit the width to the next line', () => {
    const lines = formatPortLines([3000, 5173, 6006, 8080], 17, 4)

    expect(lines).toEqual([':3000 :5173 :6006', ':8080'])
  })

  it('never splits a port between lines', () => {
    const lines = formatPortLines([3000, 5173], 8, 4)

    expect(lines).toEqual([':3000', ':5173'])
  })

  it('replaces ports beyond the last line with a hidden count', () => {
    const ports = Array.from({ length: 10 }, (_, index) => 3000 + index)

    const lines = formatPortLines(ports, 11, 2)

    expect(lines).toEqual([':3000 :3001', ':3002 +7'])
  })

  it('keeps every line within the width when ports are hidden', () => {
    const ports = Array.from({ length: 100 }, (_, index) => 10000 + index)

    const lines = formatPortLines(ports, 20, 4)

    expect(lines).toHaveLength(4)
    expect(lines.every((line) => line.length <= 20)).toBe(true)
    expect(lines.at(-1)).toMatch(/ \+\d+$/)
  })
})
