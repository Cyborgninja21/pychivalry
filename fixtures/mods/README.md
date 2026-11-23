# Fixture mods

Small hand-written mods, one behaviour each. One folder per mod, named for what it shows.

```text
fixtures/mods/<name>/
  README.md        what it shows, and what a correct tool reports on it
  descriptor.mod
  common/ events/ localization/ ...   the game's own layout
  expected.json    where a test compares whole output: the findings a correct tool reports
```

A parser fixture's `expected.json` maps each script file, by its path inside the mod, to the
findings a correct parser reports on it and, for most, its tree:

```json
{ "files": { "events/fixture_events.txt": {
    "findings": [ { "id": "syntax/missing-closing-brace", "severity": "error",
                    "line": 3, "column": 16, "message": "Expected } after arguments" } ],
    "tree": "namespace = fixture fixture.0001 = { ..." } } }
```

`line` and `column` count from 1, as an editor shows them. The message is rendered with the
committed spec's catalogue. The tree is the one-line summary of
`packages/core/src/syntax/testing.ts`: pairs as `key op value`, blocks as `{ ... }` (an open
block has no `}`), comments in parentheses, a name before a key as `<name>`, and a missing
operator or value as `<none>`.

An index fixture's `expected.json` (build step 3) says what a correct index answers. For the
override-rules mods, a list of `cases`: per name of a database, the rule of docs/overrides.md
that decides it, the `status` (`single`, `winner`, `all`, `statements`, `clash`, `not-read` or
`unknown`), the `winner` and every definition with its `layer`, `file`, `line` and `read`. A
case that holds on one platform only (letter case in paths, rule 9) names it in `platforms`. For
`index-definitions-and-uses`, every `definition` and every `use` of each defined name, with
`line` and `column`.

## Check pairs

A check is tested on a pair of mods: one it fires on and one it is silent on.

```text
fixtures/mods/<check-name>-bad/
fixtures/mods/<check-name>-good/
```

The good mod differs from the bad one only in the defect. The check inventory
(`docs/checks.md`, build step 4) names the pair of every check.

A bad mod's `expected.json` lists every finding of every engine check on the mod, so that it
shows its one behaviour only; the good mod has none, and no `expected.json`:

```json
{ "findings": [ { "file": "common/scripted_triggers/fixture_triggers.txt", "line": 16,
    "column": 2, "code": "names/unknown-trigger", "severity": "error",
    "message": "Unknown trigger 'fixture_made_up_trigger'",
    "data": { "name": "fixture_made_up_trigger" } } ] }
```

`message` is rendered with the committed spec's catalogue; `data` is the finding's data. The
check's test (`packages/core/src/check/<name>.test.ts`) indexes the mod on its own, with no
base game, so a name the mod calls must be defined in the mod.

## Carried over from release 2.3.0

The old tests' fixture mods are data and are carried over by the step that owns the behaviour,
rewritten to this layout. Where one is carried over, its README says which file under
`legacy/` it came from.

## The mods

| Mod | What it shows | Added by |
| --- | --- | --- |
| [encoding-windows-1252](encoding-windows-1252/README.md) | A file that is not valid UTF-8, read with and without the Windows-1252 fallback | Step 2 |
| [index-definitions-and-uses](index-definitions-and-uses/README.md) | One definition of every form, and every way a word is a use | Step 3 |
| [names-unknown-effect-bad](names-unknown-effect-bad/README.md), [-good](names-unknown-effect-good/README.md) | Keys in effect blocks that are no effect: made up, a trigger, an iterator over no list, removed, a scripted effect defined nowhere | Item 4.2 |
| [names-unknown-link-bad](names-unknown-link-bad/README.md), [-good](names-unknown-link-good/README.md) | Scope chains with a segment that is no link, as a key and as a value | Item 4.2 |
| [names-modifier-outside-use-area-bad](names-modifier-outside-use-area-bad/README.md), [-good](names-modifier-outside-use-area-good/README.md) | An era's character, county and province blocks, each with a modifier of another use area | Item 4.2 |
| [names-unknown-modifier-bad](names-unknown-modifier-bad/README.md), [-good](names-unknown-modifier-good/README.md) | A modifier block with a made-up and a removed modifier; a template and a marked-only name | Item 4.2 |
| [names-unknown-on-action-bad](names-unknown-on-action-bad/README.md), [-good](names-unknown-on-action-good/README.md) | On-actions named nowhere, in an on-action's lists and fallback and in `trigger_event` | Item 4.2 |
| [names-unknown-trigger-bad](names-unknown-trigger-bad/README.md), [-good](names-unknown-trigger-good/README.md) | Keys in trigger blocks that are no trigger: made up, an effect, an iterator over no list, removed, a scripted trigger defined nowhere | Item 4.2 |
| [override-rules](override-rules/README.md) | Every rule of docs/overrides.md one mod can exercise, over the stub `game/override-rules` | Step 3 |
| [override-rules-folder-case](override-rules-folder-case/README.md) | A folder spelled in upper case (rule 9) | Step 3 |
| [override-rules-replace-path](override-rules-replace-path/README.md) | `replace_path` in the descriptor (rule 8) | Step 3 |
| [parse-block-without-key](parse-block-without-key/README.md) | A block at the top level with no key | Step 2 |
| [parse-broken-syntax](parse-broken-syntax/README.md) | Five errors in one file; carried over from 2.3.0's `broken_syntax` | Step 2 |
| [parse-cut-off-mid-edit](parse-cut-off-mid-edit/README.md) | Text cut off at seven places in the middle of an edit | Step 2 |
| [parse-malformed-arithmetic](parse-malformed-arithmetic/README.md) | `@[ ... ]` malformed or unclosed | Step 2 |
| [parse-missing-closing-brace](parse-missing-closing-brace/README.md) | A block still open at the end of the file | Step 2 |
| [parse-missing-equals-before-block](parse-missing-equals-before-block/README.md) | `name { ... }` without its `=`, the base game's own defect | Step 2 |
| [parse-missing-operator](parse-missing-operator/README.md) | A top-level key with no operator, and a token not reported twice | Step 2 |
| [parse-missing-value](parse-missing-value/README.md) | An operator with no value after it | Step 2 |
| [parse-null-safe-after-value](parse-null-safe-after-value/README.md) | `?=` after a date | Step 2 |
| [parse-operator-without-key](parse-operator-without-key/README.md) | An operator with no key | Step 2 |
| [parse-unexpected-closing-brace](parse-unexpected-closing-brace/README.md) | A `}` with no block open | Step 2 |
| [parse-unterminated-string](parse-unterminated-string/README.md) | Quoted text without its closing quote | Step 2 |

The recovery test (`packages/core/src/syntax/recovery.test.ts`) reads every `parse-*` mod and
fails if a kind of parse finding has no mod of its own. The incremental re-parse test edits
every `.txt` file here and compares each re-parse with a full parse. The index's fixture test
(`packages/core/src/index/fixtures.test.ts`) reads the `override-rules*` mods and
`index-definitions-and-uses`.
