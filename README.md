# herdr-plugins

Plugins for [Herdr](https://herdr.dev). Each plugin lives in its own directory under `plugins/` and installs separately.

## Plugins

- [Workspace Ports](plugins/workspace-ports) shows the TCP ports each workspace's processes listen on, under the workspace in the sidebar
- [Tab Autoname](plugins/tab-autoname) names tabs after the agent's title, the running command, or the folder, and leaves tabs you named by hand alone
- [Uncommitted](plugins/uncommitted) shows the number of uncommitted files next to each workspace's branch

Install one with:

```sh
herdr plugin install brachkow/herdr-plugins/plugins/<name>
```

## Development

```sh
pnpm install
pnpm test
pnpm build
herdr plugin link plugins/<name>
```

`herdr plugin link` does not run startup hooks. After rebuilding a plugin, restart its poller with `herdr plugin action invoke <plugin-id>.restart`.

[`packages/shared`](packages/shared) has the Herdr socket client and the poll loop that the plugins use.

To add a plugin, create `plugins/<name>` with a `herdr-plugin.toml`, a `README.md`, and a `package.json` that takes shared dev dependency versions from the `catalog:` in `pnpm-workspace.yaml`.
