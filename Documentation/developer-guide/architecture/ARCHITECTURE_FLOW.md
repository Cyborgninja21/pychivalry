# Architecture and flow

pychivalry 2.2.0 is layered: a generated **spec package** describes CK3 1.20.0.2; the
**engine core** (`packages/engine`, `pychivalry-engine`) parses, indexes and checks scripts
against it; the **VS Code extension** (`vscode-extension`) is a thin client plus a language
server whose providers and plug-ins sit on the engine. The engine has no dependency on VS Code
or the LSP libraries and also runs as a CLI. The validation stages are in
[VALIDATION.md](VALIDATION.md); the package format in [the spec package](../spec-package.md).

```
 pdx-parser-re (game exe) ──► spec package ck3-spec-1.20.0.2.json (bundled, sha256-checked)
                                         │
                            packages/engine (pychivalry-engine)
                spec/ · syntax/ · index/ · check/ · diagnostics · messages · cli
                     │                                      │
          pychivalry-engine check <modDir>     vscode-extension/src/server
                                               lsp/ (17 providers) · plugins.ts · ck3/ · data/ · log/
                                                            │  LSP (stdio/IPC)
                                               vscode-extension/src (client)
                                               extension.ts · client/ · logger.ts · statusBar.ts
```

## Layers

### Spec package

One JSON file per game version, generated from the executable by pdx-parser-re: six keyword
buckets with the engine's documentation strings, modifier templates, iterator prefixes,
227 directories with 185 per-directory schemas, the 1,967-message error catalogue, the
retired-keyword table, and (format 3) the game's own scope documentation: `scope_validity`
per keyword and the 72 `scope_types`. The engine vendors it gzipped under
`packages/engine/spec/`; `spec.config.json` names it; the build verifies its sha256.

### Engine core (`packages/engine/src`)

| Module | Role |
| --- | --- |
| `spec/` | `loadSpec`/`defaultSpec` give a `Spec`: `has(name, bucket)`, `bucketsOf`, `doc`, `isIterator`, `listBase`, `isModifier`, `directoryOf`, `schemaOf`, `message(id, …args)`, `retired`, `scopeValidity`, `linkForms`, `listElementType`, `scopeTypes`, `version`; `withOverlay` layers extra names (mods) over it; `validateSpecPackage` checks a package against its JSON Schema |
| `syntax/` | `Lexer`, `CK3Parser`, `CachingParser` (bounded content cache), `IncrementalParser`, `parseExpression`; the AST (`ASTNode`, 0-based ranges, key/value kinds, scope chains) |
| `index/` | `Indexer` (symbols, events, namespaces, references, saved scopes, the names each file mentions and `dependentsOf(uri)`), `CallGraph` (events, scripted effects/triggers, on_actions), `Workspace` (mod roots, mod-relative paths, the spec and index of a workspace, the base game via `vanilla`/`useVanilla`), `WorkspaceValidator` (`scheduler.ts`: background validation), `LocalizationIndex`, mod descriptor parsing |
| `check/` | Registry, schema and scope checks plus the context tracker that decides trigger vs effect context |
| `diagnostics.ts` | `diagnose` / `diagnoseWorkspace`: parse → registry → schema → scope → plug-ins |
| `messages.ts` | The few package-local `PYCH-` messages |
| `cli.ts` | `pychivalry-engine check <modDir> [--spec] [--json] [--vanilla]` |

It has zero runtime dependencies; its tests (`packages/engine/test`) are unit tests, golden
tests against pdx-parser-re's test mods (exact game messages), corpus tests over
`example mod/` (expectations in `test/fixtures/corpus-expectations.json`) and CLI tests.

### Language server (`vscode-extension/src/server`)

- `server.ts` is wiring: the LSP connection, the open documents, one engine `Workspace` and a
  `LocalizationIndex`, one provider instance per feature; each handler hands the request to
  its provider and logs failures.
- `engine-host.ts` loads the spec package bundled into `dist/data/engine/` once and makes it
  the engine's default.
- `lsp/` holds the 17 providers. Each imports only `pychivalry-engine` and the LSP libraries
  (see the [feature matrix](../../user-guide/feature_matrix.md)).
- `plugins.ts` registers the surviving validators of `ck3/validation/` as engine plug-ins and
  exposes the localization validator; `ck3/localization/` holds that validator and the concept
  and icon lookups.
- `data/` reads optional game content from `data/` (trait lists, concepts, icons, animations)
  and runs the mod scanner, whose registry (`data/mods/`) turns discovered mods into spec
  overlays.
- `log/` watches the game's log files and publishes their errors as diagnostics.
- `background.ts` runs background validation: the engine's `WorkspaceValidator` with the
  diagnostics provider as its per-file step, publishing each result and its counts
  (`ck3/workspaceDiagnostics`) and reporting forced passes through `window/workDoneProgress`.
- `game-path.ts` resolves the base game directory (setting, then Steam defaults).
- `commands.ts` implements the `ck3.*` server commands (validate or rescan the workspace,
  statistics, namespace events, localization stubs, orphaned localization, rename event, …).

### Client (`vscode-extension/src`)

`extension.ts` starts the server (`client/server-controller.ts`), registers the
`ck3LanguageServer.*` commands (`client/commands.ts`), routes server notifications to output
channels (`client/log-channels.ts`, `logger.ts`) and shows the server state in the status bar
(`statusBar.ts`). `client/workspace-health.ts` keeps the per-file counts and pass state from
`ck3/workspaceDiagnostics`; the Explorer decorations (`client/file-decorations.ts`) and the
health status-bar item (`statusBar.ts` `CK3HealthStatusBar`) read it.

## Flows

### Start-up

1. The client starts the server bundle (`dist/server-main.js`).
2. `initialize`: the server records the workspace folders and advertises its capabilities
   (completion with resolve, hover, definition/declaration/type definition/implementation,
   references, document and workspace symbols, formatting and range formatting, rename with
   prepare, folding, semantic tokens (full and range), code actions, code lens, document
   links, document highlight, signature help, inlay hints, call hierarchy, selection ranges,
   execute command).
3. `initialized`: the spec package is loaded, the optional game data is read, each workspace
   folder is added to the engine `Workspace`, every script file is indexed (definitions in
   unopened files resolve), localization files are indexed, and the mod scanner looks for
   known mods; found mods become a spec overlay (`Spec.withOverlay`) that every provider and
   the diagnostics then read. Between indexing and localization the base game is read
   (`gamePath` or the Steam defaults, `Workspace.useVanilla`, asynchronous). Progress goes to
   the **CK3: Index** channel.
4. Background validation starts: every script and localization file is diagnosed (see below).

### Editing a document

- **Open:** index the text, run the diagnostics provider, publish.
- **Save:** the same, then the files that depend on it are queued for background validation.
- **Change:** re-index at once (completion, hover and navigation read the index), diagnose
  after a 300 ms debounce.
- **Close:** re-read the file from disk into the index and queue it; its last diagnostics stay
  until then.
- **On disk** (`workspace/didChangeWatchedFiles`): created or changed files are re-indexed and
  queued with their dependents; deleted files leave the index and their diagnostics are
  cleared.

### Background validation

`WorkspaceValidator` (`packages/engine/src/index/scheduler.ts`) holds a queue of files. After
`start()` it queues every file once; `invalidate(file)` re-queues one file and
`invalidateWithDependents(file)` also queues every file that mentions a name the file defines
now or defined at its last validation (`Indexer.dependentsOf`); invalidations go ahead of the
rest of a running pass. It reads `concurrency` files ahead, then diagnoses them one at a time
with a `setImmediate` yield after each, so the server answers requests between files;
`cancel()` stops before the next file and `start()` resumes. Above `fileLimit` files only open
files are queued unless a pass is forced. The server's `background.ts` gives it the
diagnostics provider as its per-file step (open files use the editor's text), publishes every
result with `sendDiagnostics` and sends `ck3/workspaceDiagnostics` with the file's counts and
the pass state (`running`/`idle`, `done`/`total`, duration, peak memory), which the client's
decorations and status bar read.

The diagnostics provider sends script files through the engine's `diagnose` with the
extension's plug-ins and maps the results to LSP diagnostics (source `ck3-engine` or
`ck3-plugin`); `.yml` files go to the localization validator instead.

### A request

Every request follows the same path: `server.ts` looks up the open document, calls the
provider, and the provider reads the engine. For example, hover on a keyword asks
`Spec.bucketsOf(name)` and shows the engine's documentation string verbatim with the bucket
(both buckets for a name that is a trigger and an effect); inside a record it shows the
directory schema's field entry; on an event id or scripted effect it shows the index entry.
Completion uses the engine's context tracker to offer triggers plus `any_` iterators in a
trigger block, effects plus `every_`/`random_`/`ordered_` iterators in an effect block, and the
directory schema's fields inside a record. Navigation, references, rename, call hierarchy and
code lens read the index and call graph.

### Game log

`CK3: Start Game Log Watcher` (or `logWatcher.autoStart`) tails the game's log directory; new
lines are analysed in batches and published as diagnostics with source `ck3-game-log`, kept
apart from the static diagnostics.

## Build outputs

| Output | Made by | Content |
| --- | --- | --- |
| `packages/engine/dist/` | `npm run build` (tsc + `scripts/copy-spec.js`) | The engine, its CLI, `data/ck3-spec.json.gz` |
| `vscode-extension/dist/extension.js` | webpack | The client |
| `vscode-extension/dist/server-main.js` | webpack | The server with the engine bundled in |
| `vscode-extension/dist/data/` | webpack copy | `data/` (optional game content) and `data/engine/` (the spec package) |
| `vscode-extension/out/` | `tsc -p .` | Compiled tests |
| `*.vsix` | `vsce package` | The installable extension |
