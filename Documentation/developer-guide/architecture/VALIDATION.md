# Validation pipeline

How a CK3 script file becomes diagnostics in pychivalry 2.0.0. The same pipeline serves the
editor (the language server) and the command line (`pychivalry-engine check`). The code
reference for every id and code is the generated
[diagnostics reference](../../user-guide/diagnostics/README.md).

```
text ──► parse ──► index ──► registry ──► schema ──► scope ──► plug-ins ──► diagnostics
         (syntax/)  (index/)  (check/registry) (check/schema) (check/scope) (extension)
```

`diagnose(workspace, file, {text, uri, plugins})` in `packages/engine/src/diagnostics.ts` runs
the stages in that order and returns the diagnostics sorted by position. Every engine
diagnostic is `{file, range, severity, code, message, source: 'engine'}` with `code` an id of
the spec package's error catalogue (or a listed `PYCH-` id) and `message` the catalogue's
text with its placeholders filled. Plug-in diagnostics carry `source: 'plugin'`.

## 1. Parse

`syntax/lexer.ts` and `syntax/parser.ts` read the file the way the game's reader does: a
UTF-8 BOM, `#` comments, keys, operators (`=`, `?=`, `==`, `!=`, `<`, `<=`, `>`, `>=`),
strings, numbers, dates (`1066.1.1` stays a date), bare values in lists, `@name = value`
constants and `@name` references, `@[ … ]` arithmetic (`syntax/expression.ts`), and scope
chains (`scope:x.liege.primary_title` stays one chain). Newlines and comments may separate a
key, its operator and its value.

Parse errors use the game's messages:

| Id | When |
| --- | --- |
| `expected_between_block_name_and_body` | `key { … }` among statements (the `=` is missing) |
| `expected_between_equals_and_arguments` | an operator with no value |
| `expected_after_arguments` | a block still open at the end of the file (reported at its `{`) |
| `unexpected_token_expected_key` | a stray `}` or operator where a statement starts |
| `unexpected_token_X_found_at_X_expected` | a key without `=` at top level, `?=` after a number, date or string |
| `PYCH-P001`, `PYCH-P002` | an unterminated string; a malformed `@[ … ]` (the catalogue has no text for these) |

The parser always produces a tree, so the later stages run on files with parse errors.

## 2. Index

The file is (re)indexed with the text being checked (`index/indexer.ts`) before any check, so
lookups see the current content: events and namespaces, scripted effects and triggers,
scripted lists and modifiers, script values, saved scopes, on_actions, localization keys
(`index/localization.ts`) and the call graph (`index/call-graph.ts`). The `Workspace`
(`index/workspace.ts`) holds one spec and one index per mod root and maps a file to its
mod-relative path, which decides its script directory. With `--vanilla <game dir>` (CLI)
the base game's definitions are indexed too.

## 3. Registry check (`check/registry.ts`)

Every key is judged against the spec package's buckets **by name and context**:

- In a trigger block a key must be a trigger, in an effect block an effect. Names registered
  in both buckets are accepted in either; workspace (and vanilla) scripted triggers, effects,
  lists and script values are consulted before any verdict. Otherwise
  `unknown_trigger_X` / `unknown_effect_X` with the game's text. This also catches effects in
  trigger blocks and the reverse.
- Iterators: `any_` is a trigger-context prefix, `every_`/`random_`/`ordered_` effect-context;
  the base after the prefix must be in the `lists` bucket or a scripted list.
- Keys in modifier blocks must be in the modifier table or match one of its `%s` templates
  (`unknown_modifier_type_X_at_X`).
- Retired keywords get `PYCH-R001` with the replacement from the package's `retired` table,
  or `PYCH-R002` when there is none.

Where a trigger or effect context opens comes from the package's per-directory schema
(`trigger_block` / `effect_block` fields, record bodies, `holds: modifiers`), then from
`check/contexts.ts` for positions the schema does not cover (`limit`, `if`, iterator bodies,
`random_list`, …). The body of an unknown key is not read further. The short calibrated
tables in `check/structural.ts` (8 structural keys, 44 iterator parameters, 7 modifier-block
parameters) are the minimum vanilla 1.20.0.2 needs to check clean; `check/supplement.ts`
holds 21 names and 11 templates the 1.20.0.2 package lacks (temporary, see
[the spec package](../spec-package.md)).

## 4. Schema check (`check/schema.ts`)

The file's directory (from its path, `Spec.directoryOf`) selects a record schema
(`Spec.schemaOf`). Each top-level record is checked:

- a field the schema does not list: `unknown_X_in_X` (warning);
- a bare value directly in a record body: `unexpected_token_X_found_at_X_expected`;
- a missing required field, only where the package marks it required with engine evidence
  (three fields in 1.20.0.2), reported with the catalogue text the package cites; `PYCH-S002`
  if a cited text were missing;
- event content (`namespace = …`) in a directory that does not load events: `PYCH-S003`.

## 5. Scope check (`check/scope.ts`)

Chains that start at `root`, `this`, `prev` or `scope:x` are walked link by link against the
`links` bucket (`failed_to_parse_data_for_event_target_link_link_X_location_X`). A `scope:name`
that no `save_scope_as`, `save_temporary_scope_as` or `save_scope_value_as` in the file or the
index defines is `undefined_event_target_X` (information), reported only when a base game is
loaded (otherwise vanilla-provided scopes would be false positives).

**Not checked:** whether a trigger or effect is valid in the scope it is used in. The spec
package's `scope_validity` is empty until a `script_docs` oracle run fills it; the check slot
(`scopeValidity`) exists.

## 6. Plug-ins (the extension)

`diagnose` then runs the plug-ins the host passes. The VS Code extension registers its
surviving validators in one place, `vscode-extension/src/server/plugins.ts`; each receives the
parsed tree, the text, the URI, the spec and the index:

| Plug-in | What it encodes |
| --- | --- |
| scope-timing | Event evaluation order: scopes and variables created in `immediate` are not available in `trigger` or `desc` |
| style-checks | Indentation, whitespace, line length, nesting, empty blocks, brace balance |
| conventions | Events with options need type, title, desc; option names; if/else ordering |
| localization-references | Literal text where a localization key belongs; keys missing from the workspace (`CK4100`) |
| events | Event type, theme, portraits, options, namespaces |
| paradox-checks | Paradox conventions and pitfalls: ai_chance, trigger_else, after blocks, iterators without limit, `this =` comparisons |
| variables | Variables used but never set, set but never used, local/global and list/value mix-ups |
| traits | Trait names, only when the optional trait data in `data/traits/` is present |
| scripted-blocks | Calls to undefined scripted effects and triggers; recursion |
| script-values | Script value formulas |
| iterators | `ordered_` iterator parameters |
| switch | `switch` blocks and their trigger |

Their codes (CK3xxx, EVENT-, VALUE-, …) are listed in `data/diagnostics.yaml`; the generator
check (`npm run docs:diagnostics:check`, run in CI) fails when a plug-in emits a code that file
lacks. The extension maps engine severities to LSP severities, drops the style plug-in's brace
codes on a line where the engine already reports an unbalanced brace, and caps a file at 1,000
diagnostics.

## Localization files

`.yml` files are not CK3 script and skip the engine pipeline. The extension indexes them
(`LocalizationIndex`) and runs the localization validator
(`ck3/localization/validator.ts`): key format (`LOC-001`), character functions, formatting
codes, `@icon!` and `£icon£` references, concept links, bracket balance and `$VARIABLE$`
substitutions.

## When validation runs (editor)

On open and save a document is indexed and diagnosed at once; on change it is indexed at once
(completions and hover need the current index) and diagnosed after a 300 ms debounce. On
start the server indexes every workspace file so that definitions in unopened files
resolve, but it diagnoses only open documents; `CK3: Validate Workspace`
(`ck3.validateWorkspace`) diagnoses all files on demand. A configuration change re-validates
the open documents.

## Game log (runtime)

While the game runs, the log watcher (`server/log/`) reads new lines of the game's logs
(`error.log`, `game.log`, `exceptions.log`, `system.log`, `setup.log`), classifies them (`log/analyzer.ts`) and publishes them as diagnostics on the file
and line they name (`log/diagnostics.ts`, source `ck3-game-log`), next to the static ones.
Because engine diagnostics use the same catalogue texts, an `error.log` line and the
diagnostic for the same defect read alike; `src/test/unit/log-oracle.test.ts` checks that every
recorded `error.log` line naming a corpus file maps to an engine diagnostic with the same id.
