# Pull Request

Shows the GitHub pull request of the workspace's branch, such as `#503`, next to the branch in the Herdr sidebar.

```sh
herdr plugin install brachkow/herdr-plugins/plugins/pull-request
```

## Setup

Add `$pr` to a Space row in `~/.config/herdr/config.toml`:

```toml
[ui.sidebar.spaces]
rows = [
  ["state_icon", "workspace"],
  ["branch", "git_status", { token = "$pr", fg = "#9ece6a" }],
]
```

An open pull request shows as `#503`. Others show their state: `#7 draft`, `#511 merged`, `#12 closed`. Branches without a pull request, and folders outside GitHub repositories, show nothing.

## How it works

Every 5 seconds the plugin reads each workspace's branch with git. It asks GitHub with `gh pr view` when the branch changes, and otherwise every 2 minutes, so a pull request opened or merged on GitHub shows up within 2 minutes.

The folder comes from the worktree checkout for worktree workspaces, and otherwise from the workspace's first pane, the same way the Uncommitted plugin finds it.

## Actions

- `brachkow.pull-request.open` opens the workspace's pull request in the browser
- `brachkow.pull-request.restart` starts a fresh poller in place of the running one

Herdr does not make sidebar text clickable, so bind `open` to a key to get there quickly:

```toml
[[keys.command]]
key = "prefix+P"
type = "plugin_action"
command = "brachkow.pull-request.open"
description = "open pull request"
```

Requires `node`, `pnpm`, `git` and [`gh`](https://cli.github.com) signed in with `gh auth login`. Works on macOS and Linux.
