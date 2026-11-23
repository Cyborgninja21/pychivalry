# Reference: the spec package

The spec package is the one source of CK3 vocabulary in pychivalry. It is derived from the game
by a separate, private project, `pdx-parser-re`, and committed here as a built file with its
checksums ([spec/README.md](../../spec/README.md)). The core holds no keyword lists of its own.

## What is committed today

The package for game 1.21.0.3 in package format 7, adopted on 2026-11-22 (format 5 adopted in
PLAN.md item 1.6, format 7 replacing it the same day on the owner's go): one package file and
three companion files, each gzipped with the SHA-256 of its uncompressed bytes, and the JSON
Schema of all four (`schema.format7.json`). Beside them, in `spec/legacy/`, the same game
version in format 4, which only release 2.3.0 reads, for the baselines. Facts measured from the
committed files:

| Part | What it holds |
| --- | --- |
| Names | 1,598 triggers, 1,105 effects, 361 links, 436 lists, 233 on-actions, 778 modifiers: 4,511 rows, 4,331 distinct names, 146 of them in more than one bucket; 13 keyword templates, 123 modifier templates, 198 modifier template tags |
| Descriptions | The executable's own text for 1,563 triggers, 1,028 effects, 359 links and 436 lists; none for modifiers or on-actions. A bucket's `doc` is now its own registration text, and a `.info` description wins over the wiki everywhere |
| What a keyword takes | A structured reading of the usage line for 2,075 of the 2,703 triggers and effects (`takes`) |
| Scope data | From the game's own `script_docs` output: 2,163 trigger and 2,399 effect entries. 63 triggers and 118 effects of the buckets have no entry; 181 and 363 entries have `none` as their supported scope |
| Modifier use areas | For all 778 modifiers (`use_areas`) and the 198 template tags |
| Record schemas | A field list for 198 of the 239 folders the package lists (five religion folders left the list in format 7): 8,179 fields and 14,685 sub-fields, each with a measured value type, how often vanilla sets it, the values where there are at most 20, and for 372 that it holds a localization key. 3 fields are marked required. Nothing for `gui`, `gfx` or `localization`. 47 field kinds changed in format 7, 14 of them marked `kind suspect:` in their `note`; `config` of `common/pool_character_selectors` is now a block |
| Error catalogue | 2,023 messages from the executable, each with a script-facing mark: 257 yes, 874 no, 892 unknown; and a finer subject (34 values) |
| Tables | The 19 tables release 2.3.0 kept in code, with their evidence and candidates kept apart; format 7 adds `court_event` to `event_types` and ten keys to `value_block_keys` (18 now) |
| Companions | Paradox's 214 `.info` files with their full text (C1), the GUI vocabulary measured from the base game's GUI files (C2), the game's data-types dump (C3) |

The four files are 55.4 MB uncompressed and 3.14 MB gzipped; the package file alone is 26.6 MB
and 1.57 MB. The package's evidence items quote the executable's own source paths (455 strings
of the form `/mnt/gsg/ck3/...`, the game's build tree, kept in its strings); no path of this
machine and no person is named.

## Format 5: twelve parts

Format 5 is format 4 with twelve parts added, nothing removed or reshaped:

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

## Formats 6 and 7: eight parts more

Format 6 adds D1 to D5 and format 7 adds D6 to D8, each a top-level key `{"status": "built",
"data": {...}}` whose `data` is the part tool's output, whole: `about`, `vocabulary`, `counts`,
`not_settled` and rows that each carry a `status` and their `evidence` (an item's `rank`: 1 the
executable, 2 the game's own output and the catalogue, 3 Paradox's `.info` files, 4 measured
base-game use). Each closed schema refuses the next format's keys, so a format 5 reader refuses
a format 7 package. The core's typed reader exposes every part (`Spec.part`); the counts below
are read from the committed package.

| Part | Key | What it holds, in 1.21.0.3 |
| --- | --- | --- |
| D1 | `override_rules` | The override rules: 82 rows, 60 `settled`, 12 `partial`, 7 `open`, 3 `derived`, read in the Windows executable (and, for the localization reader, the Linux one); 35 of pychivalry's nine kinds and 47 of eight kinds the spec work added (`extensions`, each with its reason); `platform_basis` per platform; `coverage` of all 239 folders (187 generic, 19 with a rule of their own, 32 unknown, 1 open); `stand_in` (row by row against the stand-in it retired); `measured_cases` (each duplicate case of docs/overrides.md mapped to the row that decides it) |
| D2 | `declarations` | Declarations that are not records: 62 rows (60 in 33 folders and 2 that hold in every folder), 15 `confirmed`, 34 `measured-only`, 13 `unknown`. `namespace` in an event file declares a namespace for its file; an `@name` constant holds for its file |
| D3 | `definitions` | Nested definitions, 40 rows in 24 folders (29 confirmed; 27,111 names), among them a landed title at any depth below another; 10 nested keys that are fields or references; file-named folders, 6 rows: `history/cultures` names its records by the file's stem, `history/situations` and `history/struggles` by none |
| D4 | `keyword_roles` | What a structural keyword does: 61 rows for 52 keywords, 35 `confirmed`, 19 `measured-only`, 7 `stated-elsewhere`; 90 roles added (67 confirmed, 23 measured-only); every context a row states is stated as an existing table entry |
| D5 | `implicit_loc_keys` | Localization keys a record has by its name: 710 rows in 160 folders; requirement `required` 12, `optional` 17, `always-present-in-base-game` 227 (a measurement, not a game rule), `unknown` 454 |
| D6 | `field_references` | The database a value names: 922 rows (144 confirmed, 656 measured-only, 122 unknown), 147 databases named; 13 rows name on-actions (11 confirmed: 5 fields of `common/council_tasks` and `common/on_action`, 6 effect parameters such as `trigger_event.on_action`) |
| D7 | `modifier_block_areas` | The use areas a modifier block accepts: 208 rows (167 confirmed, 24 measured-only, 17 unknown), for a record body, a field or sub-field, a family of them, or a block at depth 3 or deeper by its key; `engine_check` quotes the executable's own message for a modifier outside its block's area |
| D8 | `iterator_kinds` | `any_` a trigger, `every_`, `random_` and `ordered_` effects, each confirmed by the game's own documentation output; the documented forms of all 436 lists; 146 departures (17 confirmed); `limit` of an effect block is a trigger context |

**Still open in the package, and not built on as facts:** the 12 partial and 7 open D1 rows;
the 14 suspect field kinds; D8's 13 `random_`/`random_list` blocks read as sitting in a script
value; D5's required-against-optional for most patterns; and D8's own first `not_settled` item,
that no game message ties the unknown-trigger or unknown-effect message to an iterator of the
wrong kind. Five points were sent back to the spec work on adoption (docs/decisions.md, row
67), among them a D7 row marked `confirmed` whose own note says it is not settled.

## What the rebuild reads of it

Read by the typed reader (`packages/core/src/spec/`) and used by the index and the engine
checks, measured where it says so on the 1.21.0.3 base game.

| Question | What the package gives, and what reads it |
| --- | --- |
| Which definition is in force | D1, read by the index (docs/overrides.md says which row decides each rule). A settled or derived row of an applied kind decides; a partial or open row does not |
| What a definition is | D2 (a top-level form that declares no name; a constant's scope) and D3 (nested and file-named definitions), confirmed rows only, read by the folder table of the index |
| Which blocks hold triggers or effects | A record body for 3 folders (`record_body`); otherwise each field's measured `kind`; the tables `opens_context`, `structural`, `containers`, `iterator_params`. D4 replaces none of it |
| Which blocks hold modifiers | The 38 fields marked `holds: modifiers`, and the blocks a confirmed D7 row describes, with the keys D7 measures there as no modifier (`structural_keys`, `other_keys`) as their parameters |
| Which use area a modifier block is | D7, confirmed rows: read by `names/modifier-outside-use-area` |
| Which fields name an on-action | D6, confirmed rows whose database is the on-actions' (the one D6's vocabulary adds the on-actions bucket to): read by `names/unknown-on-action` |
| Which iterator prefix belongs in a trigger block and which in an effect block | D8. Not used to report an iterator of the wrong kind: no game message is tied to that case (a question for the owner, docs/decisions.md) |
| Whether the game's readers tell letter cases apart | D1's `path-case-engine-folds-nothing`: the engine folds no case; each platform's file system decides (`path-case-windows`, `path-case-linux`, both `derived`) |
| Which names a mod may call | `vanilla_indexed_dirs` (7 folders) and the keyword templates' `keys` |
| Where a scope chain is walked from, and what may end it | `scope_heads` and the links' own forms; a chain ending in a value is the A5 `takes` form `comparison` of a trigger |

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
   checksums of the uncompressed bytes, format 7, every companion the package lists, the JSON
   Schema, the format 4 copy and the override rules.
3. Every committed record made on the old package now fails `task records:check`, so the
   suites that need game files and the 2.3.0 baselines are re-run and their records committed
   with the package.

After 1.21 the spec is re-derived on the owner's word. Until then pychivalry reports a mismatch
between the spec's game build and the installed one once, and keeps working.
