# Reference: the spec package

The spec package is the one source of CK3 vocabulary in pychivalry. It is derived from the game
by a separate, private project, `pdx-parser-re`, and committed here as a built file with its
checksums ([spec/README.md](../../spec/README.md)). The core holds no keyword lists of its own.

## What is committed today

The package for game 1.21.0.3 in package format 5, adopted on 2026-11-22 (PLAN.md, item 1.6):
one package file and three companion files, each gzipped with the SHA-256 of its uncompressed
bytes, and the JSON Schema of all four. Beside them, in `spec/legacy/`, the same game version
in format 4, which only release 2.3.0 reads, for the baselines. Facts measured from the
committed files:

| Part | What it holds |
| --- | --- |
| Names | 1,598 triggers, 1,105 effects, 361 links, 436 lists, 233 on-actions, 778 modifiers: 4,511 rows, 4,331 distinct names, 146 of them in more than one bucket; 13 keyword templates, 123 modifier templates |
| Descriptions | The executable's own text for 1,563 triggers, 1,028 effects, 359 links and 436 lists; none for modifiers or on-actions |
| What a keyword takes | A structured reading of the usage line for 2,075 of the 2,703 triggers and effects (`takes`) |
| Scope data | From the game's own `script_docs` output: 2,163 trigger and 2,399 effect entries. 63 triggers and 118 effects of the buckets have no entry; 181 and 363 entries have `none` as their supported scope |
| Modifier use areas | For all 778 modifiers (`use_areas`) |
| Record schemas | A field list for 198 of the 244 folders the package lists: 8,179 fields and 14,685 sub-fields, each with a measured value type, how often vanilla sets it, the values where there are at most 20, and for 372 that it holds a localization key. 3 fields are marked required. Nothing for `gui`, `gfx` or `localization` |
| Error catalogue | 2,023 messages from the executable, each with a script-facing mark: 257 yes, 874 no, 892 unknown; and a finer subject (34 values) |
| Tables | The 19 tables release 2.3.0 kept in code, 166 entries with their evidence (143 confirmed, 15 contradicted, 8 with none) and 65 candidates kept apart |
| Companions | Paradox's 214 `.info` files with their full text (C1), the GUI vocabulary measured from the base game's GUI files (C2), the game's data-types dump (C3) |

The four files are 50.4 MB uncompressed and 2.75 MB gzipped; the package file alone is 21.6 MB
and 1.18 MB.

## What format 5 adds, as built

Format 5 is format 4 with twelve parts added, nothing removed or reshaped. The package's
`parts` list says, for 1.21.0.3, that all twelve are built:

| Part | What |
| --- | --- |
| A1 | Where each modifier may be used, and the template tags and marks of the game's modifier log |
| A2 | How often each field is set, per record |
| A3 | Every matching wiki description, marked as wiki |
| A4 | The cleaned error catalogue: script-facing or not, with the rule that decided, and a finer subject |
| A5 | What each trigger and effect takes |
| B1 | A value type per field, measured, with the wiki's type beside it as a hint |
| B2 | Observed values, where the set is small |
| B3 | Which fields hold a localization key |
| C1 | Paradox's own `.info` documentation files (companion) |
| C2 | A measured GUI vocabulary (companion) |
| C3 | Functions usable in localization and GUI: the data-types dump (companion) |
| C4 | The tables release 2.3.0 kept in code, each entry with its evidence |

The thirteenth addition the plan asks for, **the override rules table**, is not in the
package, nor are the other requests held in docs/decisions.md (declarations that are not
records, nested and file-named definitions, keyword roles, implicit localization keys). The
index keeps its stand-in rules table, `spec/override-rules.json`, until a package carries the
table.

Every fact in format 5 records which source it came from, so a check can tell game evidence
from a hint: the executable, the game's own output, the `.info` files, the base game's files,
and the wiki-era seeds, in that order of trust.

## What item 4.2 found the package does and does not carry

Read by the typed reader (`packages/core/src/spec/`) and used by the first engine checks, on
2026-11-22. Each point is a fact of the committed files, measured by the checks' own run over
the 1.21.0.3 base game where it says so.

| Question a check asks | What the package gives |
| --- | --- |
| Which blocks hold triggers or effects | A record body for 3 folders (`record_body`: scripted effects, rules and triggers); otherwise each field's measured `kind` (225 `trigger_block`, 279 `effect_block`); the tables `opens_context`, `structural`, `containers`, `iterator_params`. Measured kinds are mostly right; two are wrong on the base game's own files: `history/titles` `<date>` and `<number>` are `effect_block` with no sub-fields, though they hold the title history's fields, and `common/pool_character_selectors` `config` is `trigger_block`, though its `.info` file documents a block of `background` and `age`. The schema of `common/script_values` records 19 links (`faith`, `liege`, ...) as effect blocks |
| Which blocks hold modifiers | The 38 fields marked `holds: modifiers`. No record body is marked a modifier block (`common/modifiers` and `common/traits` list their modifiers as fields) |
| Which use area a modifier block is | Nothing. The use areas are on the 778 modifiers (`use_areas`) and the 198 template tags, not on blocks |
| Which fields name an on-action, or a key of another database | Nothing in the B1 value types, which give value groups (`word`, `list`, `script_value`, ...), never a database. The `.info` companion's field facts carry `refers_to` on 83 values, one of them an on-action (`trigger_event`'s `on_action` inside an activity locale's `on_enter_locale`) |
| Which iterator prefix belongs in a trigger block and which in an effect block | Nothing: `iterator_prefixes` lists the four, `scope_validity.lists` the four iterator names of each list |
| Whether the game's readers tell letter cases apart | Nothing directly; the tables `structural` and `same_scope_structural` read their names in any case, and the base game writes 133 keys in judged blocks in another case than the bucket's (`ROOT` 47 times, `THIS` 34, `IF` 11, `NOt` once) |
| Which names a mod may call | `vanilla_indexed_dirs` (7 folders) and the keyword templates' `keys`; `record_body` says which of the 7 hold triggers and which effects, nothing which hold lists or values |
| Where a scope chain is walked from, and what may end it | `scope_heads` (its reason contradicted, its role standing) and the links' own forms (`global_link`, `requires_data`); a chain ending in a value is the A5 `takes` form `comparison` of a trigger, which the base game does 9,772 times |
| Table entries a check may trust | 143 confirmed, 15 contradicted with the game's own evidence, 8 with none; 65 candidates apart, 29 of which (in the tables the checks read) the game's output or its `.info` files document |

## What no derivation can supply

- Scope data for the triggers and effects the game does not document.
- Descriptions for on-actions.
- A GUI vocabulary derived from the executable. The one collected is measured from the base
  game's files and is labelled so.

These stay documented gaps. Lookup says what the spec says; where the spec has nothing, it says
so and does not guess.

## How a new package arrives

1. `pdx-parser-re` derives it for a game build and writes the package file, its companions, the
   format 4 copy, a `.sha256` for each, and the schema.
2. The files replace the ones in `spec/`, gzipped deterministically
   ([spec/README.md](../../spec/README.md#compression)). `task spec:check` verifies the
   checksums of the uncompressed bytes, format 5, every companion the package lists, the JSON
   Schema, and the format 4 copy.
3. Every committed record made on the old package now fails `task records:check`, so the
   suites that need game files and the 2.3.0 baselines are re-run and their records committed
   with the package.

After 1.21 the spec is re-derived on the owner's word. Until then pychivalry reports a mismatch
between the spec's game build and the installed one once, and keeps working.
