import { request, renameTab, type Tab } from '@herdr-plugins/shared'

// Giving the tab its position number back, which is how Herdr labels unnamed tabs,
// hands it back to the poller
const tabId = process.env.HERDR_TAB_ID
if (!tabId) throw new Error('No tab in the action context')
const workspaceId = tabId.split(':')[0]
const { tabs } = await request<{ tabs: Tab[] }>('tab.list', { workspace_id: workspaceId })
const position = tabs.findIndex(({ tab_id }) => tab_id === tabId) + 1
await renameTab(tabId, String(position))
