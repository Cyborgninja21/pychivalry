# Feature matrix

The language server's providers in pychivalry 2.2.0 and what each one does. There are 17
provider modules in `vscode-extension/src/server/lsp/`; every one imports only
`pychivalry-engine` (spec package, parser, index, diagnostics) and the LSP libraries.
`keyword-docs.ts` and `snippets.ts` in the same folder are shared helpers, not providers.

Status: **engine** = reads CK3 knowledge from the engine's spec package and index;
**parser** = works on the engine's parse tree alone; **limited** = works, with the limitation
named.

| # | Provider (`lsp/`) | LSP requests | What it does | Status |
| --- | --- | --- | --- | --- |
| 1 | `diagnostics.ts` | publishDiagnostics | Script files: the engine pipeline (parse, registry, schema, scope) then the extension's plug-ins; `.yml` files: the localization validator. Plug-in errors and warnings need engine evidence, the rest are conventions at information or hint (2.2, [evidence rule](../developer-guide/diagnostics-evidence.md)). See the [diagnostics reference](diagnostics/README.md). | engine; **limited**: the plug-in checks that need the base game (localization keys, themes, backgrounds, traits, variables across the mod) are silent without `ck3LanguageServer.gamePath` |
| 2 | `completions.ts` | completion, completionItem/resolve | Trigger block: triggers, `any_` iterators, structural keys; effect block: effects, `every_`/`random_`/`ordered_` iterators, structural keys; inside a record: the directory schema's fields; workspace symbols (events, scripted effects/triggers, saved scopes); documentation is the engine's doc string. | engine |
| 3 | `hover.ts` | hover | Keywords: the engine doc string verbatim with its bucket (both buckets for the names that are trigger and effect); iterators: their list; record fields: the directory schema entry; events, scripted effects/triggers, saved scopes and localization keys: the index entry. | engine |
| 4 | `signature-help.ts` | signatureHelp | Parameters of block-form keywords, from the usage example in the engine doc string. | engine; **limited**: only keywords whose doc string has a usage example |
| 5 | `inlay-hints.ts` | inlayHint, inlayHint/resolve | Scope types from the engine resolver: after each chain step, on iterators and on `save_scope_as`; where a `scope:x` reference was saved, from the index. | engine (`resolveScopes`) |
| 6 | `semantic-tokens.ts` | semanticTokens/full, semanticTokens/range | Keys classified by bucket (effects, triggers, links, iterators, structural operators), with trigger/effect context from the engine. | engine |
| 7 | `navigation.ts` | definition, declaration, typeDefinition, implementation, references | Definitions and references of events, scripted effects and triggers, saved scopes and localization keys, across files. | engine (index) |
| 8 | `symbols.ts` | documentSymbol, workspace/symbol | Document outline by record type; fuzzy workspace symbol search. | engine (index) |
| 9 | `call-hierarchy.ts` | prepareCallHierarchy, incomingCalls, outgoingCalls | Event chains and scripted effect/trigger calls from the engine's call graph. | engine (call graph) |
| 10 | `code-lens.ts` | codeLens, codeLens/resolve | Reference counts, complexity indicators and event-chain information above records. | engine (index, call graph) |
| 11 | `code-actions.ts` | codeAction | Quick fixes keyed by engine and plug-in codes: retired keyword to its replacement (`PYCH-R001`), create a missing scripted effect or trigger (`unknown_effect_X`, `unknown_trigger_X`), localization stub (`CK4100`, `CK4101`, `CK4102`), localization key format (`LOC-001`), indentation to tabs (`CK3303`, `CK3301`), operator spacing (`CK3306`), trailing whitespace (`CK3304`), remove an empty block (`CK3314`), add `ai_chance` (`CK3613`); extract-to-scripted-effect/trigger refactorings that judge keys by bucket. | engine; **limited**: quick fixes where a mechanical fix exists (the ten most frequent plug-in codes on the real-mod corpus were measured for 2.2, issue #85) |
| 12 | `rename.ts` | prepareRename, rename | Events, scripted effects and triggers, variables and localization keys across files. | engine (index) |
| 13 | `document-links.ts` | documentLink, documentLink/resolve | Clickable file paths (GFX, GUI, localization) and event ids. | parser + index |
| 14 | `document-highlight.ts` | documentHighlight | Occurrences of the symbol under the cursor, read and write. | parser |
| 15 | `formatting.ts` | formatting, rangeFormatting | Paradox style: tabs by default, block indentation, operator spacing. | parser |
| 16 | `folding.ts` | foldingRange | Blocks, comment runs, multi-line lists. | parser |
| 17 | `selection-range.ts` | selectionRange | Smart expand/shrink through value, assignment, block contents, block. | parser |

Whole-mod features (2.1), outside the per-request providers:

| Feature | Where | What it does | Status |
| --- | --- | --- | --- |
| Background diagnostics (#86) | `server/background.ts` + the engine's `WorkspaceValidator` | Every script and localization file validated after start-up, on change on disk, and with its dependents on save; published through the same diagnostics provider as open files; **CK3: Validate Workspace** forces a pass with progress and cancel | engine; **limited**: `.gui`/`.gfx`/`.asset` not validated; above `backgroundValidation.fileLimit` only open files unless forced |
| Explorer file decorations (#87) | `client/file-decorations.ts` | Badge with the count of a file's worst severity (`9+` above nine), error or warning colour, folder roll-up | engine (diagnostics stream) |
| Status-bar health summary (#84) | `statusBar.ts` (`CK3HealthStatusBar`) | Workspace error and warning totals, spinner with `done/total` during a pass, tooltip with information count, files affected and last full pass; click opens the Problems panel | engine (diagnostics stream); **limited**: the Problems panel opens unfiltered (no public API for its filter) |

## Not provided

Requests a modder might expect that the server does not answer, all tracked as issues kept
for after 2.0.0: color swatches for GUI colors (#79), on-type formatting (#80) and a
mod-structure tree view (#83). Diagnostic counts in the status bar (#84), workspace-wide
background diagnostics (#86) and Explorer file decorations (#87) arrive in 2.1 (above).

## File types

| Files | Treated as | Features |
| --- | --- | --- |
| `.txt` under a script directory of the spec package (`common/…`, `events/`, `history/`, …) | CK3 script | All providers; the schema check uses the directory's schema |
| `.txt` elsewhere in a mod, `.gui`, `.gfx`, `.asset` | CK3 script | All providers; no directory schema |
| `localization/**/*_l_<language>.yml` (and any `.yml`) | Localization | Localization validator, index, hover and navigation for keys |
