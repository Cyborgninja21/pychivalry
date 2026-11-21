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

## Check pairs

A check is tested on a pair of mods: one it fires on and one it is silent on.

```text
fixtures/mods/<check-name>-bad/
fixtures/mods/<check-name>-good/
```

The good mod differs from the bad one only in the defect. The check inventory
(`docs/checks.md`, build step 4) names the pair of every check.

## Carried over from release 2.3.0

The old tests' fixture mods are data and are carried over by the step that owns the behaviour,
rewritten to this layout. Where one is carried over, its README says which file under
`legacy/` it came from.

## The mods

| Mod | What it shows | Added by |
| --- | --- | --- |
| [encoding-windows-1252](encoding-windows-1252/README.md) | A file that is not valid UTF-8, read with and without the Windows-1252 fallback | Step 2 |
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
every `.txt` file here and compares each re-parse with a full parse.
