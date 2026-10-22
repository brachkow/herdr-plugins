import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getProcessInfo, getSnapshot, renameTab, runPoller } from '@herdr-plugins/shared'
import { isOwnedLabel, tabLabel } from './names.ts'

const POLL_INTERVAL_MS = 2000

const home = homedir()
const stateDir = process.env.HERDR_PLUGIN_STATE_DIR
const labelsFile = stateDir ? join(stateDir, 'labels.json') : undefined

// Remembered across restarts, otherwise tabs we named before would look renamed by hand
const readSetLabels = (): Map<string, string> => {
  if (!labelsFile) return new Map()
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(labelsFile, 'utf8'))))
  } catch {
    return new Map()
  }
}

const setLabels = readSetLabels()

const saveSetLabels = () => {
  if (labelsFile) writeFileSync(labelsFile, JSON.stringify(Object.fromEntries(setLabels)))
}

const tick = async () => {
  const { tabs, panes, layouts } = await getSnapshot()
  const panesById = new Map(panes.map((pane) => [pane.pane_id, pane]))
  const focusedPaneByTab = new Map(layouts.map(({ tab_id, focused_pane_id }) => [tab_id, focused_pane_id]))
  let changed = false

  await Promise.all(
    tabs.map(async ({ tab_id, label }) => {
      if (!isOwnedLabel(label, setLabels.get(tab_id))) return
      const pane = panesById.get(focusedPaneByTab.get(tab_id) ?? '')
      if (!pane) return
      // A pane can close between the snapshot and this call
      const info = pane.agent ? undefined : await getProcessInfo(pane.pane_id).catch(() => undefined)
      const next = tabLabel(pane, info, home)
      if (!next || next === label) return
      await renameTab(tab_id, next)
      setLabels.set(tab_id, next)
      changed = true
    }),
  )

  // Tab ids get reused after a tab closes
  const openTabs = new Set(tabs.map(({ tab_id }) => tab_id))
  for (const tabId of setLabels.keys()) {
    if (openTabs.has(tabId)) continue
    setLabels.delete(tabId)
    changed = true
  }
  if (changed) saveSetLabels()
}

await runPoller(tick, POLL_INTERVAL_MS)
