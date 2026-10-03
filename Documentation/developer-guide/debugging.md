# Debugging pychivalry

How to debug the extension's client, its language server, the engine and the tests, in the
Extension Development Host, in your main VS Code instance and against an installed VSIX; and
where each log goes. Issue #38 asked for this when the server was Python; the Python parts
(debugpy, the Python LSP process) are gone with 2.0.0: the server is a Node process
(`dist/server-main.js`) and is debugged with the Node inspector like everything else here.

Every configuration this page names is in [`.vscode/launch.json`](../../.vscode/launch.json),
and `task dev:launch-check` starts each of them once outside VS Code, the way the debugger
would (preLaunchTask, launch or attach, then a debugger session that evaluates in the target
process). Run it under `xvfb-run -a` on headless Linux.

## What runs where

| Part | Process | Source | Debugged with |
| --- | --- | --- | --- |
| Client (`extension.ts`, `client/`) | the VS Code extension host | `vscode-extension/dist/extension.js` (webpack, source maps to `src/`) | the extensionHost launch, or an attach to the extension host |
| Language server (`server/`, the providers, the plug-ins) | a Node child process of the extension host, started by `vscode-languageclient` | `vscode-extension/dist/server-main.js` | an attach to its inspector |
| Engine (`packages/engine`) | inside the language server (bundled), or the test/CLI process | `packages/engine/dist` (bundled into `server-main.js`) | the server attach, or the engine test launches |

## In the Extension Development Host

| Configuration | What it does |
| --- | --- |
| 🎯 Extension - Dev Mode | Task **Dev Mode** (engine `tsc --watch` + both bundles in `webpack --watch`, see [CONTRIBUTING](../../CONTRIBUTING.md#dev-mode-everything-current-while-you-edit)), then the host on `example mod/` once both builds finished |
| 🎯 Extension - Quick Compile | `npm: compile` (engine build + webpack once), then the host |
| 🎯 Extension - Full Rebuild | `npm ci` at the root, compile, compile the tests, then the host |
| 🔌 Attach to Language Server (Development Host) | Attaches to the server on port **6009**; `restart: true` re-attaches after **CK3: Restart Language Server** |
| 🎯 Extension + Server (Dev Mode) | Compound: Dev Mode and the server attach in one session (client and server breakpoints together) |

The server starts with `--nolazy --inspect=6009` whenever the extension host itself runs
under a debugger (`vscode-languageclient` uses the `debug` server options then; see
`client/server-controller.ts`). Set `CK3_SERVER_INSPECT_PORT` in the environment of VS Code to
use another port (two hosts at once). Client breakpoints in `vscode-extension/src` bind through
the bundle's source maps; server breakpoints bind once the attach is made, so a breakpoint in
start-up code (workspace initialization, the first index) needs a **CK3: Restart Language
Server** after attaching. After a rebuild, reload the host (**Developer: Reload Window**).

Useful scenarios:

- **Parser and diagnostics.** Breakpoints in `packages/engine/src` do not bind in the bundle
  (the server bundles `packages/engine/dist`, whose own source maps webpack does not follow);
  debug engine logic with the engine test launches below, and the server's use of it
  (`server/lsp/diagnostics.ts`, `server/plugins.ts`) with the server attach.
- **LSP traffic.** Set `ck3LanguageServer.trace.server` to `messages` or `verbose`: every
  request and notification between client and server goes to **CK3: Trace**.
- **Activation.** Breakpoints in `src/extension.ts` `activate()` bind in the Dev Mode launch;
  **Developer: Show Running Extensions** in the host shows whether the extension activated and
  how long it took.
- **Performance.** `ck3LanguageServer.logLevel` = `debug` adds **CK3: Debug** and
  **CK3: Performance**; for a CPU profile, attach to the server and use the debugger's profiler.

## In your main VS Code (through `task dev:link`)

`task dev:link` links the development build into your VS Code's extensions folder
([CONTRIBUTING](../../CONTRIBUTING.md#the-development-build-in-your-main-vs-code-task-devlink)).
That VS Code does not run the extension host under a debugger, so the server starts without
an inspector:

- **Server.** Open its inspector, then start **🔌 Attach to Language Server (main instance,
  9229)**. Find the process (`ps -eo pid,args | grep server-main.js`, on Windows Task Manager's
  `node` with `server-main.js` in its command line) and send it `SIGUSR1`
  (`kill -USR1 <pid>`); on Windows run `node -e "process._debugProcess(<pid>)"`. Node opens
  its inspector on 9229.
- **Client.** Start that VS Code with `code --inspect-extensions=5870` and use **🔌 Attach to
  Extension Host (main instance, 5870)**. The extension host then runs under an inspector, so
  the server also starts with its inspector on 6009 and the Development Host attach works
  too. Under WSL or SSH the extension runs on the remote server; `--inspect-extensions` on the
  Windows client does not reach it. The remote extension host is a Node process like the
  server: `kill -USR1` it and attach on 9229 (this remote case is documented, not covered by
  `dev:launch-check`).

## Against an installed VSIX

The same two routes as the main instance (the VSIX is an installed extension). Breakpoints in
`vscode-extension/src` bind only when the VSIX was built from your checkout at the same commit
(its source maps point at `src/` relative to its `dist/`); otherwise set them in the bundled
`dist/*.js` from the debugger's Loaded Scripts view. `task test:vsix` runs the smoke suite on a
freshly packaged VSIX; to debug a failure there, run `npm run test:vsix` with the smoke tests
changed to stop (`debugger;`) and attach on 5870 after starting it with
`--inspect-extensions`, or reproduce it with the linked build (`task test:dev-link`).

## Tests

| Configuration | What it runs |
| --- | --- |
| 🧪 Unit Tests - All | The extension's unit tests (`vscode-extension/out/test/unit`, mocha, no VS Code) after **Compile Tests** |
| 🧪 Unit Tests - Current File | The open unit test (`src/test/unit/<name>.test.ts` → `out/test/unit/<name>.test.js`) |
| 🧪 Example Mod Validation Tests | `example-mod-validation.test.js`: engine plus plug-ins over the example mod copy |
| 🧪 Integration Tests | The integration suite (`src/test/suite`) in an Extension Development Host on `test-workspace/`, other extensions disabled |
| 🧪 Engine Tests - All | The engine's unit, golden, corpus and CLI tests (`packages/engine/out/test`) after **Build Engine Tests** |
| 🧪 Engine Tests - Current File | The open engine test (`packages/engine/test/**/<name>.test.ts`) |
| 🧪 Corpus Suite - one mod (engine path) | `packages/engine/scripts/corpus-acceptance.js <corpus> <game> <slug>` (child processes are attached automatically); writes that mod's `engine` record |
| 🧪 Corpus Suite - one mod (editor path) | The editor-path corpus suite (`src/test/corpus`) with the mod as the workspace, in a profile of its own (`vscode-extension/.vscode-test/corpus-profile`, written by the task **Corpus Profile** with `ck3LanguageServer.gamePath`; your profile is not touched); writes that mod's `editor` record |

The two corpus configurations ask for the corpus folder, the mod and the game directory; their defaults are the paths on the box the records were made on
([real-mods README](../../packages/engine/test/corpus/real-mods/README.md)). They rewrite the
mod's record file; `git diff` shows what changed (timings always do).

## Where each log goes

| Channel (Output view) | What | Turned on by |
| --- | --- | --- |
| **CK3: Server** | Client lifecycle (start, stop, restarts, settings), the server's own log (`connection.console`, `server/utils/logger.ts`) and its stderr | always |
| **CK3: Index** | The server's indexing messages (`ck3/indexLog`): spec package, game data, workspace folders, files indexed, base game, localization, mods; and the rescan summary | always |
| **CK3: Commands** | Results of the `CK3:` commands | always |
| **CK3: Trace** | The LSP messages between client and server | `ck3LanguageServer.trace.server`: `messages` or `verbose` |
| **CK3: Debug**, **CK3: Performance** | Detailed client debug lines and timings | `ck3LanguageServer.logLevel`: `debug` |
| **CK3L: …** (Live Monitor, game.log, error.log, exceptions.log, system.log, setup.log, Script Errors) | The game's own log files, watched while the game runs | **CK3: Start Game Log Watcher** (or `logWatcher.autoStart`) |

The server process gets `LOG_LEVEL` from `ck3LanguageServer.logLevel`. **CK3: Show Output
Channel** opens the channels. The repository's `.vscode/settings.json` sets `logLevel` to
`debug` and the trace to `verbose`, so the Development Host shows everything.

## Traps

- **Running the VS Code test hosts from a VS Code terminal.** That terminal exports
  `ELECTRON_RUN_AS_NODE` and `VSCODE_*` variables; the downloaded VS Code then runs as Node
  and fails ("Cannot find module …/test-workspace"). Unset them first:
  `env -u ELECTRON_RUN_AS_NODE $(env | grep -oE '^VSCODE_[A-Z_]+' | sed 's/^/-u /') xvfb-run -a task test:integration`
  (the [real-mods README](../../packages/engine/test/corpus/real-mods/README.md) records this).
- **Headless Linux and WSL.** The integration, corpus, smoke and launch-check runs need a
  display: `xvfb-run -a`. The Linux `code` CLI asks under WSL whether to continue; the test
  runners set `DONT_PROMPT_WSL_INSTALL=1`.
- **The game directory on `/mnt/c`.** The first read of the base game from the Windows mount
  is cold and several times slower than later ones (15.9 s against about 3.5 s in the corpus
  budget); time a second run.
- **macOS socket paths.** A user-data folder under the checkout makes VS Code's IPC socket path
  longer than 104 bytes (`listen EINVAL`); the runners put it under the OS temp folder.
- **Port in use.** Two Development Hosts at once both want 6009 for their servers; set
  `CK3_SERVER_INSPECT_PORT` for one of them. 9229 is Node's default: only one process can have
  it open.

## Troubleshooting

| Symptom | Look at |
| --- | --- |
| The extension does not load | **Developer: Show Running Extensions**; the host's **Log (Extension Host)** channel; for a linked build `task dev:link:status` (a Marketplace copy in the same folder wins) |
| The server does not start | **CK3: Server** (spawn errors, crash restarts); `ck3LanguageServer.enable`; workspace trust (the server does not start in an untrusted workspace) |
| Breakpoints stay grey | Rebuild (the bundle is stale), check `outFiles`, reload the host; engine source breakpoints only bind in the engine test launches |
| Nothing in **CK3: Index** | The server sends during start-up and on **CK3: Rescan Workspace**; the integration test `index-channel.test.ts` checks both |
| Two servers running | **CK3: Restart Language Server** stops the old one first; a crashed host can leave one: find it with `ps` and end it |
