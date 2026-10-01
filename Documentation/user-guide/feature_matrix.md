# Feature matrix

The language server's providers in pychivalry 2.0.0 and what each one does. There are 17
provider modules in `vscode-extension/src/server/lsp/`; every one imports only
`pychivalry-engine` (spec package, parser, index, diagnostics) and the LSP libraries.
`keyword-docs.ts` and `snippets.ts` in the same folder are shared helpers, not providers.

Status: **engine** = reads CK3 knowledge from the engine's spec package and index;
**parser** = works on the engine's parse tree alone; **limited** = works, with the limitation
named.

| # | Provider (`lsp/`) | LSP requests | What it does | Status |
| --- | --- | --- | --- | --- |
| 1 | `diagnostics.ts` | publishDiagnostics | Script files: the engine pipeline (parse, registry, schema, scope) then the extension's plug-ins; `.yml` files: the localization validator. See the [diagnostics reference](diagnostics/README.md). | engine; **limited**: no per-keyword scope validity |
| 2 | `completions.ts` | completion, completionItem/resolve | Trigger block: triggers, `any_` iterators, structural keys; effect block: effects, `every_`/`random_`/`ordered_` iterators, structural keys; inside a record: the directory schema's fields; workspace symbols (events, scripted effects/triggers, saved scopes); documentation is the engine's doc string. | engine |
| 3 | `hover.ts` | hover | Keywords: the engine doc string verbatim with its bucket (both buckets for the names that are trigger and effect); iterators: their list; record fields: the directory schema entry; events, scripted effects/triggers, saved scopes and localization keys: the index entry. | engine |
| 4 | `signature-help.ts` | signatureHelp | Parameters of block-form keywords, from the usage example in the engine doc string. | engine; **limited**: only keywords whose doc string has a usage example |
| 5 | `inlay-hints.ts` | inlayHint, inlayHint/resolve | Saved scopes (`save_scope_as`) and where a `scope:x` reference was saved, from the index. | engine; **limited**: no scope types (the package's `scope_validity` is empty) |
| 6 | `semantic-tokens.ts` | semanticTokens/full, semanticTokens/range | Keys classified by bucket (effects, triggers, links, iterators, structural operators), with trigger/effect context from the engine. | engine |
| 7 | `navigation.ts` | definition, declaration, typeDefinition, implementation, references | Definitions and references of events, scripted effects and triggers, saved scopes and localization keys, across files. | engine (index) |
| 8 | `symbols.ts` | documentSymbol, workspace/symbol | Document outline by record type; fuzzy workspace symbol search. | engine (index) |
| 9 | `call-hierarchy.ts` | prepareCallHierarchy, incomingCalls, outgoingCalls | Event chains and scripted effect/trigger calls from the engine's call graph. | engine (call graph) |
| 10 | `code-lens.ts` | codeLens, codeLens/resolve | Reference counts, complexity indicators and event-chain information above records. | engine (index, call graph) |
| 11 | `code-actions.ts` | codeAction | Quick fixes keyed by engine and plug-in codes (retired keyword to its replacement, create a missing scripted effect or trigger, localization stub for `CK4100`, style fixes); extract-to-scripted-effect/trigger refactorings that judge keys by bucket. | engine; **limited**: quick fixes for a subset of codes (issue #85) |
| 12 | `rename.ts` | prepareRename, rename | Events, scripted effects and triggers, variables and localization keys across files. | engine (index) |
| 13 | `document-links.ts` | documentLink, documentLink/resolve | Clickable file paths (GFX, GUI, localization) and event ids. | parser + index |
| 14 | `document-highlight.ts` | documentHighlight | Occurrences of the symbol under the cursor, read and write. | parser |
| 15 | `formatting.ts` | formatting, rangeFormatting | Paradox style: tabs by default, block indentation, operator spacing. | parser |
| 16 | `folding.ts` | foldingRange | Blocks, comment runs, multi-line lists. | parser |
| 17 | `selection-range.ts` | selectionRange | Smart expand/shrink through value, assignment, block contents, block. | parser |

## Not provided

Requests a modder might expect that the server does not answer, all tracked as issues kept
for after 2.0.0: color swatches for GUI colors (#79), on-type formatting (#80), a mod-structure
tree view (#83), diagnostic counts in the status bar (#84), workspace-wide background
diagnostics (#86, today `CK3: Validate Workspace` runs them on demand), and Explorer file
decorations (#87).

## File types

| Files | Treated as | Features |
| --- | --- | --- |
| `.txt` under a script directory of the spec package (`common/…`, `events/`, `history/`, …) | CK3 script | All providers; the schema check uses the directory's schema |
| `.txt` elsewhere in a mod, `.gui`, `.gfx`, `.asset` | CK3 script | All providers; no directory schema |
| `localization/**/*_l_<language>.yml` (and any `.yml`) | Localization | Localization validator, index, hover and navigation for keys |
