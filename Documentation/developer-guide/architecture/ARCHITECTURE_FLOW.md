# Architecture and flow

pychivalry 2.0.0 is layered: a generated **spec package** describes CK3 1.20.0.2; the
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
retired-keyword table, and an empty `scope_validity` slot. The engine vendors it gzipped under
`packages/engine/spec/`; `spec.config.json` names it; the build verifies its sha256.

### Engine core (`packages/engine/src`)

| Module | Role |
| --- | --- |
| `spec/` | `loadSpec`/`defaultSpec` give a `Spec`: `has(name, bucket)`, `bucketsOf`, `doc`, `isIterator`, `listBase`, `isModifier`, `directoryOf`, `schemaOf`, `message(id, …args)`, `retired`, `scopeValidity`, `version`; `withOverlay` layers extra names (mods) over it; `validateSpecPackage` checks a package against its JSON Schema |
| `syntax/` | `Lexer`, `CK3Parser`, `CachingParser` (bounded content cache), `IncrementalParser`, `parseExpression`; the AST (`ASTNode`, 0-based ranges, key/value kinds, scope chains) |
| `index/` | `Indexer` (symbols, events, namespaces, references, saved scopes), `CallGraph` (events, scripted effects/triggers, on_actions), `Workspace` (mod roots, mod-relative paths, the spec and index of a workspace), `LocalizationIndex`, mod descriptor parsing |
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
- `commands.ts` implements the `ck3.*` server commands (validate or rescan the workspace,
  statistics, namespace events, localization stubs, orphaned localization, rename event, …).

### Client (`vscode-extension/src`)

`extension.ts` starts the server (`client/server-controller.ts`), registers the
`ck3LanguageServer.*` commands (`client/commands.ts`), routes server notifications to output
channels (`client/log-channels.ts`, `logger.ts`) and shows the server state in the status bar
(`statusBar.ts`).

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
   the diagnostics then read. Progress goes to the **CK3: Index** channel.

### Editing a document

- **Open / save:** index the text, run the diagnostics provider, publish.
- **Change:** re-index at once (completion, hover and navigation read the index), diagnose
  after a 300 ms debounce.
- **Close:** drop the document from the index and clear its diagnostics.

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
