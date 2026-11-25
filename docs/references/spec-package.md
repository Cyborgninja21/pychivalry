# Reference: the spec package

The spec package is the one source of CK3 vocabulary in pychivalry. It is derived from the game
by a separate, private project, `pdx-parser-re`, and committed here as a built file with its
checksums ([spec/README.md](../../spec/README.md)). The core holds no keyword lists of its own.

## What is committed today

The package for game 1.21.0.3 in package format 9, adopted on 2026-11-25 (format 5 adopted in
PLAN.md item 1.6, format 7 replacing it on 2026-11-22, format 8 on 2026-11-23 and format 9 on
2026-11-25, each on the owner's go): one package file and three companion files, each gzipped
with the SHA-256 of its uncompressed bytes, and the JSON Schema of all four
(`schema.format9.json`). Beside them, in `spec/legacy/`, the same game version in format 4, which
only release 2.3.0 reads, for the baselines: the copy the format 8 pass built, kept because 2.3.0
cannot read the one the format 9 pass built (docs/decisions.md, 2026-11-25). Facts measured from
the committed files:

| Part | What it holds |
| --- | --- |
| Names | 1,598 triggers, 1,105 effects, 361 links, 436 lists, 233 on-actions, 778 modifiers: 4,511 rows, 4,331 distinct names, 146 of them in more than one bucket; 13 keyword templates, 123 modifier templates, 198 modifier template tags |
| Descriptions | The executable's own text for 1,563 triggers, 1,028 effects, 359 links and 436 lists; none for modifiers or on-actions. A bucket's `doc` is now its own registration text, and a `.info` description wins over the wiki everywhere |
| What a keyword takes | A structured reading of the usage line for 2,075 of the 2,703 triggers and effects (`takes`) |
| Scope data | From the game's own `script_docs` output: 2,163 trigger and 2,399 effect entries. 63 triggers and 118 effects of the buckets have no entry; 181 and 363 entries have `none` as their supported scope |
| Modifier use areas | For all 778 modifiers (`use_areas`) and the 198 template tags |
| Record schemas | A field list for 198 of the 239 folders the package lists (five religion folders left the list in format 7): 8,179 fields and 14,685 sub-fields, each with a measured value type, how often vanilla sets it, the values where there are at most 20, and for 372 that it holds a localization key. 3 fields are marked required. Nothing for `gui`, `gfx` or `localization`. 47 field kinds changed in format 7, 14 of them marked `kind suspect:` in their `note`; `config` of `common/pool_character_selectors` is now a block. Format 9: the root rule of 36 folders (25 `fixed`), `open_keys` on 6 blocks whose keys are names (an ethnicity's are genes), `key_of` on the 104 gene fields of `common/ethnicities` |
| Folders | Format 9: which files of each of the 239 folders are script (`directories[].files`): the script extensions, whether sub-folders are read, the files present that are not script (`sound/GUIDs.txt`, `gfx/models/buildings/naming.txt`, `*.info` and the like); 197 confirmed by the reader's listing call, 18 partial, 24 measured only |
| Scope types | 87 (format 9 adds `court_position`, which the game's own list of scope types names and no keyword does); `none` is no scope type (part O2) |
| Error catalogue | 2,671 messages from the executable (2,023 until format 8; the 648 more are the script-facing and cited ones of a sweep of the Linux executable), each with a script-facing mark: 826 yes, 874 no, 971 unknown; and a finer subject (35 values). 132 carry `since: <=1.21.0.3` (first version not known) |
| Tables | The 19 tables release 2.3.0 kept in code, with their evidence and candidates kept apart, and since format 9 a twentieth, `variables` (75 keywords that set, change, test, read or iterate variables); format 7 adds `court_event` to `event_types` and ten keys to `value_block_keys` (18 now); format 9 adds the four keys that save a value under a name to `save_keys` (6 entries, each saying what it saves and where its name is written) and the lists the game documents to five `iterator_params` entries |
| Companions | Paradox's 214 `.info` files with their full text (C1), the GUI vocabulary measured from the base game's GUI files (C2), the game's data-types dump (C3) |

The four files are 57.4 MB uncompressed and 3.32 MB gzipped; the package file alone is 28.6 MB
and 1.75 MB. The package's evidence items quote the executable's own source paths (455 strings
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
a format 7 package. Format 8 adds no part: it adds keys inside D1, D2 and D3 (below). The
core's typed reader exposes every part (`Spec.part`); the counts below are read from the
committed package.

| Part | Key | What it holds, in 1.21.0.3 |
| --- | --- | --- |
| D1 | `override_rules` | The override rules: 95 rows, 70 `settled`, 15 `partial`, 7 `open`, 3 `derived`, read in the Windows executable (and, for the localization reader, the Linux one); 40 of pychivalry's nine kinds and 55 of eight kinds the spec work added (`extensions`, each with its reason); `platform_basis` per platform; `coverage` of all 239 folders (187 generic, 19 with a rule of their own, 32 unknown, 1 open); `stand_in` (row by row against the stand-in it retired); `measured_cases` (each duplicate case of docs/overrides.md mapped to the row that decides it) |
| D2 | `declarations` | Declarations that are not records: 62 rows (60 in 33 folders and 2 that hold in every folder), 22 `confirmed`, 28 `measured-only`, 12 `unknown`. `namespace` in an event file declares a namespace for its file; an `@name` constant holds for its file; all six top-level keys of `common/genes` are containers; a coat of arms line `key = value` is an alias (`alias`, format 8) |
| D3 | `definitions` | Nested definitions, 41 rows in 24 folders (33 confirmed; 27,111 names), each with the scope of its name (format 8: 19 `global`, 20 `parent`, 2 `unknown`; 28 of them `confirmed`, 11 `measured-only`, 2 `unknown`), among them a landed title at any depth below another; 10 nested keys that are fields or references; file-named folders, 6 rows: `history/cultures` names its records by the file's stem, `history/situations` and `history/struggles` by none |
| D4 | `keyword_roles` | What a structural keyword does: 68 rows for 59 keywords, 47 `confirmed`, 19 `measured-only`, 2 `stated-elsewhere` (61 rows, 35 confirmed, until format 9); 105 roles added (82 confirmed); every context a row states is stated as an existing table entry. Format 9: how `AND`, `OR`, `NOT`, `NOR`, `NAND` and four kin combine their conditions (`combination`, `child_always_true`, `child_always_false`), `always` (`holds_with: yes`), `ai_chance` and `ai_will_select` (`ai_weight`) |
| D5 | `implicit_loc_keys` | Localization keys a record has by its name: 710 rows in 160 folders; requirement `required` 12, `optional` 17, `always-present-in-base-game` 227 (a measurement, not a game rule), `unknown` 454. Format 9: `buckets.modifiers`, a modifier's key, `MOD_` and its name in upper case (confirmed; 119 literal keys of another word) and a template's `<name>` (measured only) |
| D6 | `field_references` | The database a value names: 925 rows (144 confirmed, 659 measured-only, 121 unknown, 1 `not-a-key`), 148 of 269 databases named; 13 rows name on-actions (11 confirmed: 5 fields of `common/council_tasks` and `common/on_action`, 6 effect parameters such as `trigger_event.on_action`). Format 9: what the base game writes there that is no key (`miss_values`, with why), the words accepted there (`sentinels`: `none`, `auto`, `0`); a row with an undefined value is confirmed only by rank 1 or 2 evidence |
| D7 | `modifier_block_areas` | The use areas a modifier block accepts: 208 rows (167 confirmed, 24 measured-only, 17 unknown), for a record body, a field or sub-field, a family of them, or a block at depth 3 or deeper by its key; `engine_check` quotes the executable's own message for a modifier outside its block's area |
| D8 | `iterator_kinds` | `any_` a trigger, `every_`, `random_` and `ordered_` effects, each confirmed by the game's own documentation output; the documented forms of all 436 lists; 146 departures (17 confirmed); `limit` of an effect block is a trigger context |

## Format 9: three parts, and keys on the folders, the schema and inside C4, D1, D4, D5 and D6

Format 9 (`pdx-parser-re` merge `e3ced9c`, adopted 2026-11-25) answers the seventeen items
pychivalry sent back on 2026-11-25 (docs/decisions.md, rows 147 to 150). It is format 8 plus
additions; nothing is removed or reshaped. The top level of format 8, its directories, schema
entries, fields, scope types and the rows of C4, D4, D5 and D6 are closed in
`schema.format8.json`, so the number changes.

| Where | Key | What it says |
| --- | --- | --- |
| Part D9 | `localization_forms` | The bracket forms of localization text that name something by a name: 36 forms (4 confirmed: the game concept `[key\|E]`, `Concept`, `ConceptByKey` and the head of a chain; 6 measured-only, `TopScope.sC` among them; 26 unknown), 36 formatting suffixes (2 confirmed) |
| Part O1 | `saved_from_code` | The 409 names the game's own code saves as scopes for script with no script statement (`scope:actor`, `scope:recipient`, `scope:duel_value`), from its own documentation of event targets |
| Part O2 | `not_scope_types` | The scope values the package names that are no scope type: `none`, "no scope requirement" (181 triggers, 363 effects, 71 lists and 437 on-actions carry it), and the rule that every scope value is a key of `scope_types` or of O2 |
| `directories[]` | `files` | Which files of the folder are script: `script.extensions`, `script.recursive`, `not_script` |
| `directories[]`, `schema.<dir>` | `root_scope_rule`, `root_scope_from`, `root_scope_evidence` | What the root of a record is: `fixed`, `caller`, `record-field`, `per-record`, `no-script`; absent, not examined (36 folders examined). `common/laws` roots at a character, `history/titles` at a landed title, `common/scripted_modifiers` has no root |
| `schema.<dir>`, fields | `open_keys`, `key_of` | A block whose keys are names of another database (an ethnicity's keys are genes; five more blocks); a "field" that is such a name |
| `scope_types.<type>` | `listed_in`, `named_by_keywords` | Where the game's own list of scope types names the type, and whether a keyword does (`court_position`: no) |
| C4 | `save_keys` entries' `saves`, `source`, `name_in` (a list), `temporary`, `parameter_of`; the table `variables` | What each save key saves and where its name is written; 75 keywords of variables, each with what it does, on what, in which namespace, where the name is written and the duration keys |
| D1 rows | `key_identity`, `on_replace`, `within`, `merge`, `path_match`, `compare_unit`, `hides_scope`, `among`, `pack`, `read_first` | What makes two keys one key (a province id compares as an integer), what a replacement takes with it (a gene's templates), how ties and merges go, the file layer; `about.text_only` lists the 25 rows whose rule is still words only |
| D4 rows | `combination`, `child_always_true`, `child_always_false`, `holds_with`, `fails_with` | How a logical operator combines its conditions, what a constant child does to it, the value that makes a condition hold or fail |
| D5 | `buckets.modifiers` | A modifier's localization key (`MOD_<name>`, `transform: upper`, `literal_keys`) and a template's (`<name>`) |
| D6 rows | `miss_values`, `sentinels`, `value_is`, `contradicted`, `named_by_evidence`; the status `not-a-key` | The values that are no key and why, the words accepted there, a value that is no key of any database |
| `errors[]` | 648 more rows; `since: <=1.21.0.3` | The localization reader's "Unterminated ..." messages, "The body of triggered_desc can only take desc and/or trigger. %s" and 646 more; two rows of format 8 have the subject `game_object` now (`invalid_court_position`, `attempt_to_destroy_an_court_position_that_is_already_invalid`), which nothing in pychivalry reads |

**Still open in format 9, and not built on as facts:** the listing calls of the 18 partial and
24 measured-only folders (which files are script); the 6 roots only the wiki-era seed gives
(`wiki-only`: `common/bookmark_portraits`, `common/dynasties`, `common/dynasty_houses`,
`common/nicknames`, `common/opinion_modifiers`, `common/terrain_types`), and the folders no root
rule covers; 26 of D9's 36 forms and 34 of its 36 suffixes; what an empty `AND` or `OR` block
evaluates to; a template modifier's localization key (`<name>`, measured only); which key texts
the lexer gives the province id token; the colour gene's destructor; D6's 659 measured-only and
121 unknown rows; the candidates of `save_keys` (effects that save under a fixed name) and of
`iterator_params`.

## Format 8: keys inside D1, D2 and D3

Format 8 (`pdx-parser-re` merge `b0da0b0`, adopted 2026-11-23) answers the five points
pychivalry sent back on adopting format 7 (docs/decisions.md, row 67). It adds no part and no
top-level key; the rows of D2 and D3 are closed in the format 7 schema, so the number changes.

| Where | Key | What it says |
| --- | --- | --- |
| D3, every `nested` row | `name_scope`, `scope_parent`, `name_scope_status`, `name_scope_evidence`, `name_scope_basis`, `name_scope_qualifier` | Whether a nested name is known by itself (`global`) or only with a parent (`parent`: the record, the container key, or a leading part of the row's path), and how sure that is. A gene is `global` with a qualifier, its portrait group |
| D2, a `value` row that declares a record | `alias` `{of, rule}` | The line makes its key another name of the record its value names; the D1 row says how |
| D1, a containers row | `entries` | What the children of its keys are (definitions, or containers again) and the key space the definitions are resolved in |
| D1, a key-resolution row of an alias line | `alias`, `replayed` | The alias rule as data, and the base game's 21 names it decides (derived by replaying it over the game files, not observed in the game) |
| D1, a row that decides some files add nothing | `file_condition` | Which files, the condition and its effect: `msg-localization-missing-bom`, now on Linux and Windows |

Also new in D1: the containers rows of `common/genes` (`gene-group-containers`,
`special-genes-container`, `age-presets-container` settled, `decal-atlases-container` partial),
`coat-of-arms-alias`, `key-identity-gui-types` (a GUI type name is lower-cased), the gene and
coat of arms messages, and `province-terrain-statements` settled from the folder's own reader
(a statement written again is overwritten by the later read; a winter block merges field by
field; the terrain line and the block are separate stores). `msg-duplicate-modifier` is now
about `common/buildings`. In D7 the three `*_potential_trade_good_modifier` blocks of
`common/buildings` are confirmed province, `market_rite_modifier` trade market and
`market_faith_modifier` unknown. The index applies every one of these where its row decides
([spec/README.md](../../spec/README.md#the-override-rules-table)).

**Still open in the package, and not built on as facts:** the 15 partial and 7 open D1 rows
(among them `decal-atlases-container` and `name = value` inside a coat of arms `template` or
`template_lists`, `coat-of-arms-value-entries-in-other-readers`); the 11 measured-only and 2
unknown name scopes of D3; the 14 suspect field kinds; D8's 13 `random_`/`random_list` blocks
read as sitting in a script value; D5's required-against-optional for most patterns; and D8's
own first `not_settled` item, that no game message ties the unknown-trigger or unknown-effect
message to an iterator of the wrong kind.

## What the rebuild reads of it

Read by the typed reader (`packages/core/src/spec/`) and used by the index and the engine
checks, measured where it says so on the 1.21.0.3 base game.

| Question | What the package gives, and what reads it |
| --- | --- |
| Which definition is in force | D1, read by the index (docs/overrides.md says which row decides each rule). A settled or derived row of an applied kind decides; a partial or open row does not |
| What a definition is | D2 (a top-level form that declares no name; a constant's scope) and D3 (nested and file-named definitions, and since format 8 the scope of each nested name), confirmed rows only, read by the folder table of the index |
| Which blocks hold triggers or effects | A record body for 3 folders (`record_body`); otherwise each field's measured `kind`; the tables `opens_context`, `structural`, `containers`, `iterator_params`. D4 replaces none of it |
| Which blocks hold modifiers | The 38 fields marked `holds: modifiers`, and the blocks a confirmed D7 row describes, with the keys D7 measures there as no modifier (`structural_keys`, `other_keys`) as their parameters |
| Which use area a modifier block is | D7, confirmed rows: read by `names/modifier-outside-use-area` |
| Which fields name an on-action | D6, confirmed rows whose database is the on-actions' (the one D6's vocabulary adds the on-actions bucket to): read by `names/unknown-on-action` |
| Which iterator prefix belongs in a trigger block and which in an effect block | D8. Read by the scope checks of item 4.4 for the scope an iterator's block runs in. Not used to report an iterator of the wrong kind: no game message is tied to that case (a question for the owner, docs/decisions.md) |
| Which scope a block runs in | The schema's `root_scope` (3,057 base-game uses rest on a root that is no scope type, `title` or `none`), an event's `scope` (the D4 role `sets_root_scope`), an on-action's documented scope (`scope_validity.on_actions`), each field's `scope`, `fields_outside_root` and `.info` scope note, and the scopes `scope_validity` gives each link and list: read by the scope checks of item 4.4, which judge 178,395 of the base game's 610,898 keyword uses |
| What a structural keyword does | D4, through one reader for items 4.5 and 4.7 (`check/keyword-roles.ts`); an error or warning reads only roles the part confirms |
| What a name is, for lookup | Every part a name can be in: the buckets, D2, D4, D5, D6, D7, D8, `scope_types`, `noise_dropped`, the schema's fields, the C4 tables; the base game names 646 of the 778 modifiers' localization `MOD_<NAME>`, a rule the package does not carry (decision 73) |
| Whether the game's readers tell letter cases apart | D1's `path-case-engine-folds-nothing`: the engine folds no case; each platform's file system decides (`path-case-windows`, `path-case-linux`, both `derived`) |
| Which names a mod may call | `vanilla_indexed_dirs` (7 folders) and the keyword templates' `keys` |
| Where a scope chain is walked from, and what may end it | `scope_heads` and the links' own forms; a chain ending in a value is the A5 `takes` form `comparison` of a trigger |
| Where a scope is saved, and which link reads it | The table `save_keys` (`save_scope_as`, `save_temporary_scope_as`), and the link its `.info` evidence names beside them, `scope`: read by the index, for `scope/undefined-event-target`. The table leaves out the effects that save a value under a name (`save_scope_value_as`), so a name any file writes is taken as possibly saved |
| Which fields hold a localization key | B3 `loc_key` (372 fields), less those whose measured value type admits free text, whose `.info` type is no key, or whose key is a trigger and no effect: read by `localization/missing-key` (358 fields) |
| Which keys a record has by its name | D5: a `required` row that is `confirmed` is a warning of `localization/missing-key` (8 rows), an `always-present-in-base-game` row advice (226); every row, its patterns set aside and its two-name patterns are uses for `localization/unused-key` |

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
   checksums of the uncompressed bytes, format 8, every companion the package lists, the JSON
   Schema, the format 4 copy and the override rules.
3. Every committed record made on the old package now fails `task records:check`, so the
   suites that need game files and the 2.3.0 baselines are re-run and their records committed
   with the package.

After 1.21 the spec is re-derived on the owner's word. Until then pychivalry reports a mismatch
between the spec's game build and the installed one once, and keeps working.
