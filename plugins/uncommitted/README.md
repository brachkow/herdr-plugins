# Uncommitted

Shows the number of uncommitted files as `±12` next to the workspace's branch in the Herdr sidebar.

```sh
herdr plugin install brachkow/herdr-plugins/plugins/uncommitted
```

## Setup

Add `$uncommitted` to a Space row in `~/.config/herdr/config.toml`:

```toml
[ui.sidebar.spaces]
rows = [
  ["state_icon", "workspace"],
  ["branch", "git_status", { token = "$uncommitted", fg = "#e0af68" }],
]
```

## How it works

Every 5 seconds the plugin runs `git --no-optional-locks status --porcelain` and counts staged, unstaged and untracked files. Clean repositories and folders outside git show nothing. `--no-optional-locks` keeps it from holding `index.lock` while you run git yourself.

Herdr reads the branch from the folder the workspace started in, but does not expose that folder to plugins. The plugin uses the worktree checkout for worktree workspaces, and otherwise the folder of the workspace's first pane.

## Actions

- `brachkow.uncommitted.restart` starts a fresh poller in place of the running one

Requires `node`, `pnpm` and `git`. Works on macOS and Linux.
