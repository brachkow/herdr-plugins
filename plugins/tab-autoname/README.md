# Tab Autoname

Names each Herdr tab after its focused pane: the agent's title, the running command, or the folder.

```sh
herdr plugin install brachkow/herdr-plugins/plugins/tab-autoname
```

## Naming

Every 2 seconds the plugin picks a name for each tab from its focused pane:

1. An agent pane takes the agent's terminal title, such as the Claude Code session topic
2. A pane running a command takes the command: `lazygit`, `pnpm dev`, `docker compose up`, `nvim Button.vue`, or the npm package behind a node script, such as `vite`
3. An idle shell takes the folder name, or `~` for the home folder

Labels longer than 24 characters end with `…`.

## Manual names

Herdr does not say whether a tab label was set by hand, so the plugin renames only tabs labeled with a number, which is how Herdr shows unnamed tabs, and tabs it named itself. A tab you rename stays as you named it.

To make a tab automatic again, run "Tab Autoname: name this tab automatically again" from that tab, or bind the action to a key:

```toml
[[keys.command]]
key = "prefix+R"
type = "plugin_action"
command = "brachkow.tab-autoname.reset"
description = "auto-name tab"
```

## Actions

- `brachkow.tab-autoname.reset` makes the current tab automatic again
- `brachkow.tab-autoname.restart` starts a fresh poller in place of the running one

Requires `node` and `pnpm`. Works on macOS and Linux.
