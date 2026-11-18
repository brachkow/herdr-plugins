# @herdr-plugins/shared

Code shared by the plugins in this repository. It is not published. Plugins list it as a `workspace:*` dev dependency, and tsdown bundles it into each plugin's `dist`.

- `request` sends one JSON request to the Herdr socket at `HERDR_SOCKET_PATH`. The socket answers one request per connection.
- Typed wrappers for the calls the plugins use: `getSnapshot`, `listWorkspaces`, `listPanes`, `getProcessInfo`, `renameTab`, `reportWorkspaceToken`.
- `workspaceFolders` maps each workspace to its folder: the worktree checkout, or else the folder of its first pane.
- `runPoller(tick, intervalMs)` runs `tick` in a loop from a plugin's startup hook. It kills an earlier instance of the same plugin on the same Herdr socket, recorded in `HERDR_PLUGIN_STATE_DIR/poller-<socket hash>.json`, so pollers of other Herdr sessions keep running. After a failed tick it waits twice as long as before, up to a minute, and it never stops because of failures, since the server can stall for minutes and recover. It exits once its parent process, the Herdr server, is gone. With `--once` it runs a single tick.
