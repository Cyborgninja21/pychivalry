# CK3 language server

The language server of the extension. It is wiring around the engine core
(`pychivalry-engine`, `packages/engine`): CK3 knowledge (keywords, directories, schemas, error
texts) comes from the engine's spec package, parsing and indexing from the engine, and
diagnostics from the engine's pipeline plus this folder's plug-ins.

| Path | Role |
| --- | --- |
| `server.ts` | Connection, documents, workspace; each handler delegates to a provider |
| `engine-host.ts` | Loads the spec package bundled into `dist/data/engine/` once |
| `lsp/` | The 17 LSP providers; each imports only `pychivalry-engine` and the LSP libraries |
| `plugins.ts` | Registers the validators of `ck3/validation/` as engine plug-ins, and the localization validator |
| `ck3/validation/` | The plug-ins (rules the spec package does not describe) |
| `ck3/localization/` | Localization text validator, concepts, icons |
| `data/` | Optional game content from the repository's `data/`, trait data, the mod scanner (spec overlays) |
| `log/` | Game log watcher, analyzer, log diagnostics |
| `commands.ts` | The `ck3.*` server commands |
| `utils/` | Logger, fuzzy matching, URI helpers |

## Adding a feature

1. A new editor feature is a provider in `lsp/` that reads the engine (`Spec`, parser,
   `Workspace` index); wire it in `server.ts` (capability and handler).
2. A new validation rule that the spec package cannot express is a plug-in in
   `ck3/validation/`, registered in `plugins.ts`; add its codes to `data/diagnostics.yaml`
   and run `npm run docs:diagnostics`.
3. Never add CK3 vocabulary (keyword lists, scope tables, schemas) here: it belongs in the
   spec package (pdx-parser-re).

See `Documentation/developer-guide/architecture/ARCHITECTURE_FLOW.md` and `VALIDATION.md`.
