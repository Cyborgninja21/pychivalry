# Feature matrix

The language server's providers in pychivalry 2.3.0 and what each one does. There are 20 provider modules in `vscode-extension/src/server/lsp/`;
every one imports only `pychivalry-engine` (spec package, parser, index, diagnostics) and the
LSP libraries (the colour provider also reads its generated key list,
`server/data/color-keys.json`).
`keyword-docs.ts` and `snippets.ts` in the same folder are shared helpers, not providers.

Status: **engine** = reads CK3 knowledge from the engine's spec package and index;
**parser** = works on the engine's parse tree alone; **limited** = works, with the limitation
named.

| # | Provider (`lsp/`) | LSP requests | What it does | Status |
| --- | --- | --- | --- | --- |
| 1 | `diagnostics.ts` | publishDiagnostics | Script files: the engine pipeline (parse, registry, schema, scope; since 2.3 the scope check also knows the record fields the game evaluates in another scope than the record, from the spec package) then the extension's plug-ins; `.yml` files: the localization validator. Plug-in errors and warnings need engine evidence, the rest are conventions at information or hint (2.2, [evidence rule](../developer-guide/diagnostics-evidence.md)). See the [diagnostics reference](diagnostics/README.md). | engine; **limited**: the plug-in checks that need the base game (localization keys, themes, backgrounds, traits, variables across the mod) are silent without `ck3LanguageServer.gamePath` |
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
| 15 | `formatting.ts` | formatting, rangeFormatting | Paradox style: tabs by default, block indentation, operator spacing. Indentation from `formatting.insertSpaces`/`tabSize` (2.3). | parser |
| 16 | `folding.ts` | foldingRange | Blocks, comment runs, multi-line lists. | parser |
| 17 | `selection-range.ts` | selectionRange | Smart expand/shrink through value, assignment, block contents, block. | parser |
| 18 | `color-provider.ts` (2.3, #79) | documentColor, colorPresentation | Swatches and the colour picker on colour values: bare 0..1 and 0..255 lists, `rgb`, `hsv`, `hsv360`, `hex { }` and named colours; written back in the value's own notation first. Notations, ranges and colour keys from the [evidence scan](../developer-guide/color-notations.md). | parser (tree; the engine lexer's tokens for files with parse errors such as GUI files); **limited**: values outside the notation ranges (HSV light intensities, overbright lists) get no swatch |
| 19 | `on-type-formatting.ts` (2.3, #80) | onTypeFormatting (`\n`, `}`, `=`) | Enter indents to the block depth, `}` aligns with its opener, `=` padded after a key; agrees with `formatting.ts`; nothing inside strings or comments. | engine lexer |
| 20 | `mod-structure.ts` (2.3, #83) | `ck3/modStructure` (custom request) | The CK3 Explorer view's data: categories with counts, events by namespace, localization by language, each item with its definition's location; one level per request. | engine (index, localization index) |

Whole-mod features (2.1), outside the per-request providers:

| Feature | Where | What it does | Status |
| --- | --- | --- | --- |
| Background diagnostics (#86) | `server/background.ts` + the engine's `WorkspaceValidator` | Every script and localization file validated after start-up, on change on disk, and with its dependents on save; published through the same diagnostics provider as open files; **CK3: Validate Workspace** forces a pass with progress and cancel | engine; **limited**: `.gui`/`.gfx`/`.asset` not validated; above `backgroundValidation.fileLimit` only open files unless forced |
| Explorer file decorations (#87) | `client/file-decorations.ts` | Badge with the count of a file's worst severity (`9+` above nine), error or warning colour, folder roll-up | engine (diagnostics stream) |
| Status-bar health summary (#84) | `statusBar.ts` (`CK3HealthStatusBar`) | Workspace error and warning totals, spinner with `done/total` during a pass, tooltip with information count, files affected and last full pass; click opens the Problems panel | engine (diagnostics stream); **limited**: the Problems panel opens unfiltered (no public API for its filter) |

Editor features (2.3), outside the per-request providers:

| Feature | Where | What it does | Status |
| --- | --- | --- | --- |
| CK3 Explorer view (#83) | `client/mod-explorer.ts` (view `ck3.modExplorer` in the Explorer) | Events by namespace with their type, decisions, character interactions, scripted effects and triggers, script values, on-actions, localization keys per language; counts; empty categories hidden; click reveals the definition; refresh on index change, after a background pass and from the title bar | engine (index through `ck3/modStructure`) |

## Not provided

Every request the post-2.0 triage kept is answered: colour swatches (#79), on-type
formatting (#80) and the mod-structure tree view (#83) arrive in 2.3 (above); diagnostic
counts in the status bar (#84), workspace-wide background diagnostics (#86) and Explorer file
decorations (#87) arrived in 2.1. The issue #83's secondary views (event chains, a problems
summary) are not part of 2.3: the call hierarchy (`call-hierarchy.ts`) and the status bar
cover them.

## File types

| Files | Treated as | Features |
| --- | --- | --- |
| `.txt` under a script directory of the spec package (`common/…`, `events/`, `history/`, …) | CK3 script | All providers; the schema check uses the directory's schema |
| `.txt` elsewhere in a mod, `.gui`, `.gfx`, `.asset` | CK3 script | All providers; no directory schema |
| `localization/**/*_l_<language>.yml` (and any `.yml`) | Localization | Localization validator, index, hover and navigation for keys |
