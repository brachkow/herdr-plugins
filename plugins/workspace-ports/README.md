# Workspace Ports

Shows the TCP ports that processes started from a workspace's panes listen on, under the workspace in the Herdr sidebar.

```sh
herdr plugin install brachkow/herdr-plugins/plugins/workspace-ports
```

## Setup

Herdr renders each sidebar row as one line, so the plugin wraps ports over up to 4 tokens, `$ports1` to `$ports4`, one per row. Add them to `~/.config/herdr/config.toml`:

```toml
[ui.sidebar.spaces]
rows = [
  ["state_icon", "workspace"],
  ["branch", "git_status"],
  [{ token = "$ports1", fg = "#7aa2f7" }],
  [{ token = "$ports2", fg = "#7aa2f7" }],
  [{ token = "$ports3", fg = "#7aa2f7" }],
  [{ token = "$ports4", fg = "#7aa2f7" }],
]
```

Rows without ports disappear. When the ports do not fit in 4 lines, the last line ends with the number of hidden ports, such as `+7`.

## How it works

Every 3 seconds the plugin lists listening TCP ports with `lsof` and the process tree with `ps`. A port belongs to a workspace when the listening process descends from the shell of one of the workspace's panes.

Ports from 49152 up are hidden, because tools such as workerd, Storybook and Vite pick them at random for internal channels.

Processes that detach from the pane's shell, such as Docker containers or `brew services`, are not attributed to any workspace.

## Actions

- `brachkow.workspace-ports.restart` starts a fresh poller in place of the running one
- `brachkow.workspace-ports.refresh` updates the ports once

Requires `node`, `pnpm`, `lsof` and `ps`. Works on macOS and Linux.
