# Validation pipeline

How a CK3 script file becomes diagnostics in pychivalry 2.2.0. The same pipeline serves the
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
parameters) are the minimum vanilla 1.20.0.2 needs to check clean. Per-database keywords
(`has_relation_friend`, `add_diplomacy_lifestyle_xp`) are accepted through the package's
`keyword_templates` when the slot is a key of the template's database (see
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

**Scope validity** (2.1): `check/scope-types.ts` infers the scope type of every block (root
from the directory, an event's `scope = …` or an on_action's documented scope; iterators give
their list's element type, links and chains their output type; `scope:x` the type at its only
save site; anything else unknown) from the package's `scope_validity` and `scope_types`, the
game's own `script_docs` documentation. A trigger or effect whose supported scopes do not
include the current type is `wrong_scope_for_trigger_X_expected_X` /
`wrong_scope_for_effect_X_expected_X`; a link step outside its input scopes is
`trying_to_use_X_link_on_an_invalid_scope_X` (all errors). Nothing is reported when the
current type is unknown or the keyword's scopes are `none`. Vanilla 1.20.0.2 checks clean.

## 6. Plug-ins (the extension)

`diagnose` then runs the plug-ins the host passes. The VS Code extension registers its
surviving validators in one place, `vscode-extension/src/server/plugins.ts`; each receives the
parsed tree, the text, the URI, the spec and the index:

| Plug-in | What it encodes |
| --- | --- |
| scope-timing | Event evaluation order (trigger, immediate, the window, the chosen option, after): scopes read before they are saved, the localization half (desc/title texts) and the trigger guard |
| style-checks | Indentation, whitespace, line length, nesting, empty blocks (hints), brace balance |
| conventions | if/else ordering |
| localization-references | Literal text where a localization key belongs (`CK4101`, `CK4102`); keys defined neither in the workspace nor in the base game (`CK4100`) |
| events | Event type, letter sender, namespace declaration |
| paradox-checks | Event structure, title, portraits, theme and background overrides, ai_chance, after blocks, trigger_else, iterators without limit |
| variables | Variables read but set nowhere, set but read nowhere (across the workspace and the base game), namespace and list/value mix-ups |
| traits | Trait names against the base game's and the workspace's traits |
| scripted-blocks | Recursion |
| script-values | Script value ranges, conditionals, rounding |
| iterators | `ordered_` iterator parameters |
| switch | `switch` blocks and their trigger |
| graphics | Graphics files (`.dds`, `.png`, `.tga`) that exist in no workspace mod and not in the base game (`GFX001`, below) |

Since 2.2 a plug-in code is an error or a warning only with engine evidence (a message of the
spec package's error catalogue, a `required` schema field, an oracle entry or a reproduced
in-game error); without it the code is a convention at information or hint severity, and a
check that needs knowledge it does not have (the base game's localization, themes,
backgrounds, traits, the workspace index) reports nothing without it. The audit of every code
is [diagnostics-evidence.md](../diagnostics-evidence.md); the plug-ins read the base game
through `server/data/base-game.ts` (`BaseGameData`) and the workspace through
`PluginEnvironment.workspace`.

Their codes (CK3xxx, EVENT-, VALUE-, …) are listed in `data/diagnostics.yaml`; the generator
check (`npm run docs:diagnostics:check`, run in CI) fails when a plug-in emits a code that file
lacks. The extension maps engine severities to LSP severities, drops the style plug-in's brace
codes on a line where the engine already reports an unbalanced brace, and caps a file at 1,000
diagnostics: over the cap the most severe are kept (errors, then warnings, information, hints,
by position within a severity) and published in position order, for script and localization
files alike.

### Graphics files (GFX001)

A texture the game cannot find shows as a pink or black checkerboard. The `graphics` plug-in
(`ck3/validation/graphics.ts`, rebuilt from pychivalry PR #56's Python `gfx_validator.py`)
reports such a reference in the editor as `GFX001` (warning,
`Graphics file not found: "<path>"`). It is an extension plug-in, not an engine check, because
it reads the file system.

**Patterns.** The value of one of nine keys, wherever it appears:

```
icon = "gfx/interface/icons/my_icon.dds"
texture = "gfx/interface/textures/my_texture.dds"
sprite = "gfx/interface/sprites/my_sprite.dds"
background = "gfx/interface/backgrounds/my_background.dds"
portrait_texture = "gfx/portraits/my_texture.dds"
reference = "gfx/interface/illustrations/decisions/my_decision.dds"
activity_window_background = "gfx/interface/activities/my_activity.dds"
background_texture = "gfx/interface/my_background.dds"
icon_texture = "gfx/interface/icons/my_icon_texture.dds"
```

**Extensions.** `.dds` (DirectDraw Surface, the game's main format), `.png` and `.tga`, in any
case. Any other extension, or none, is not checked.

**What is not a path.** A value counts only when it looks like a content path: at least one
`/` (or `\`, read as `/`) and one of the three extensions. Skipped: bare names
(`icon = standard_character_event` is a key into another database), bare file names
(`icon = "death_unknown.dds"` is resolved by its database against a folder of its own),
values with `$VARIABLE$` placeholders or `[...]` expressions, absolute paths and paths with
`..` segments. A leading `./` is dropped. `gfx/portraits/...` paths are files like any other.

**Resolution order.** The game reads a path relative to a content root and searches the mods
of the playset, then the base game, whose roots are `game/` and every `game/dlc/<dlc>/` folder
(DLC graphics live under `game/dlc/dlc004_ep1/gfx/...`, not under `game/gfx/`). The plug-in
searches, in order:

1. the workspace folders (the mod roots of `Workspace.roots()`);
2. the base game's `game/` directory (`ck3LanguageServer.gamePath`, or the Steam default);
3. every `game/dlc/<dlc>/` folder, in name order.

The existence test is case-insensitive on every platform (CK3 runs on Windows, and most mods
are written there): each path segment is matched against a listing of its directory, read once
and cached. The server drops a directory's listing (and the listings above and below it) when
the file watcher reports a file created or deleted under it (the client watches
`**/*.{dds,png,tga}`), and re-validates the open documents.

**Without the base game nothing is reported.** A path missing from the workspace mods may be
the base game's, a DLC's, or another mod's of the player's playset; without the base game the
miss cannot be proven, so the check stays silent until `ck3LanguageServer.gamePath` (or a Steam
default) gives one. With it, a path found nowhere in the workspace mods, `game/` or `game/dlc/*`
is reported. Files only another mod of the playset provides are reported too: open that mod as
a second workspace folder to make them known.

**De-duplication.** One warning per distinct missing path per file (compared
case-insensitively), on the value of its first reference; later references of the same path
get none.

**Example.**

```
my_activity = {
    activity_window_background = "gfx/interface/activities/placeholder.dds"   # GFX001 if absent
    phases = {
        phase_1 = { icon = "gfx/interface/icons/activity_phase_1.dds" }        # found: nothing
    }
}

my_decision = {
    picture = { reference = "gfx/interface/illustrations/decisions/decision_misc.dds" }  # base game: nothing
}

my_event.0001 = {
    option = {
        icon = "gfx/interface/icons/missing_icon.dds"   # GFX001
        icon = "gfx/interface/icons/missing_icon.dds"   # same path again: no second warning
        icon = standard_character_event                 # a database key: not checked
    }
}
```

The setting `ck3LanguageServer.graphics.enabled` (default `true`) switches the check off. The
document-links provider still turns these paths into links; its "Target not found" tooltip
and `GFX001` now agree.

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
