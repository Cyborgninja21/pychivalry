# The spec package

pychivalry takes its CK3 vocabulary only from the spec package that `pdx-parser-re` derives
from the game (docs/MVP.md, "The spec package"). The built package is committed here as it
was built, with its checksums and its schema. Nothing here is edited by hand.

| File | What it is |
| --- | --- |
| `ck3-spec-1.21.0.3.json.gz` | The package file for game 1.21.0.3, package format 9, gzipped. It also holds the override rules table (part D1, below) |
| `ck3-spec-1.21.0.3.info.json.gz` | Companion C1: Paradox's 214 `.info` documentation files, facts and full text (`info_docs`) |
| `ck3-spec-1.21.0.3.gui.json.gz` | Companion C2: the GUI vocabulary measured from the base game's `.gui` files (`gui`) |
| `ck3-spec-1.21.0.3.data_types.json.gz` | Companion C3: the game's own data-types dump (`data_types`) |
| `ck3-spec-1.21.0.3.sha256`, `.info.sha256`, `.gui.sha256`, `.data_types.sha256` | SHA-256 of each file's **uncompressed** JSON, in `sha256sum` form |
| `schema.format9.json` | The JSON Schema (draft 2020-12) of the package file and the three companions, from `pdx-parser-re` (`spec/package/schema.format9.json`) |
| `legacy/ck3-spec-1.21.0.3.format4.json.gz`, `legacy/ck3-spec-1.21.0.3.format4.sha256` | The same game version in package format 4, as the format 8 pass built it. It exists only so that release 2.3.0 can be run for the baselines; nothing in the new code reads it. It is not the copy the format 9 pass built ([below](#the-format-4-copy)) |

The package file holds every part a tool needs to start; each companion holds one heavy part
and is opened only when that part is needed. The package file names each companion in
`manifest.companions` (its file, part, key, SHA-256 and size) and records it again under its
own key (`info_docs`, `gui`, `data_types`).

The package carries Paradox's full `.info` text (`manifest.info_text` is `full`) and is
committed as `pdx-parser-re` built it (docs/decisions.md, 2026-11-22). Format 7 is format 5
with eight parts added (D1 to D8, docs/references/spec-package.md), nothing removed or
reshaped; the stand-in override rules table this folder held until then is retired. Format 8
(adopted 2026-11-23, `pdx-parser-re` merge `b0da0b0`) is format 7 plus keys inside D1, D2 and
D3 that answer the five faults of docs/decisions.md row 67: the scope of a nested name
(`name_scope`), a decision about whole files as data (`file_condition`), what a container's
children are (`entries`), and an alias line (`alias`, `replayed`).

Format 9 (adopted 2026-11-25, `pdx-parser-re` merge `e3ced9c`) answers the seventeen items of
the request of 2026-11-25 (docs/decisions.md): it is format 8 plus three parts, D9
(`localization_forms`, the bracket forms of localization text that name something), O1
(`saved_from_code`, the 409 names the game's own code saves as scopes) and O2
(`not_scope_types`, the scope values that are no scope type: `none`); keys on `directories`
(`files`: which files are script; `root_scope_rule`), on `schema` (`root_scope_rule`,
`open_keys`, `key_of`) and on `scope_types` (`listed_in`, `named_by_keywords`; `court_position`
is a scope type now, 87 in all); and keys inside C4 (`save_keys` with `saves` and `name_in` as a
list, the new table `variables`), D1 (`key_identity`, `on_replace`, `within`, `merge` and the
file-layer fields), D4 (`combination`, `child_always_true`, `child_always_false`, `holds_with`,
`fails_with`), D5 (`buckets.modifiers`: a modifier's localization key) and D6 (`miss_values`,
`sentinels`, the status `not-a-key`). Nothing is removed or reshaped; the top level and the rows
of format 8 are closed in its schema, hence the new number. The error catalogue has 2,671
messages (the 2,023 of format 8, byte for byte but two subjects, and 648 more). The package
file is 28,597,973 bytes uncompressed (1.75 MB gzipped); the three companions changed by one
header value each (`package_format`).

## Compression

Every JSON file here is committed gzipped (docs/decisions.md, 2026-11-22): 3.14 MB for the four
files of the package instead of 55.4 MB, and 0.64 MB for the format 4 copy instead of 8.6 MB.
The checksums are of the uncompressed bytes, so a file can be checked against the `.sha256`
that `pdx-parser-re` wrote beside it.

The compression is deterministic, so the same JSON always gives the same committed bytes:

```bash
gzip -n -9 -c ck3-spec-1.21.0.3.json > ck3-spec-1.21.0.3.json.gz
```

`-n` keeps the file name and the time out of the gzip header; `-9` is the highest level. The
committed files were made this way with GNU gzip 1.14. `.gitattributes` marks them binary, so
no platform rewrites their bytes, and keeps `schema.format9.json` byte for byte as well.

## The check

`task spec:check` (part of `task ci`) fails unless:

- the folder holds exactly one `ck3-spec-<version>.json.gz`, and its `.sha256` equals the
  SHA-256 of the uncompressed bytes and names the uncompressed file;
- the package's `package_format` is 9, the only format the rebuild reads (a format 5, 7 or 8
  package is refused: the index and the checks read keys only format 9 carries), and its
  `manifest.version` is the version in the file name;
- `schema.format9.json` declares `package_format` 9;
- every companion `manifest.companions` lists is here, gzipped, with the SHA-256 and the size
  the package states, its own `.sha256` agreeing, the same record under the package's key for
  it, and a header (`companion`, `package`, `version`, `package_format`) naming this package;
  a companion that is missing, altered or of another package fails;
- no other `ck3-spec-*.json[.gz]` file sits beside them;
- the package file and every companion are valid against `schema.format9.json` (each
  companion against the `$defs` entry for its `companion` name). The validation runs in CI.
  The schema is written for a draft 2020-12 validator rather than for Ajv's strict authoring
  rules, so the check relaxes those rules except the one that refuses an unknown keyword;
- every gzip header stores no file name, comment, extra field or time;
- `legacy/` holds exactly one `ck3-spec-<version>.format4.json.gz` whose `.format4.sha256`
  agrees, whose `package_format` is 4 and whose game version is the package's;
- the package's override rules (part D1) read with the core's own reader (`rulesFromSpec` in
  `packages/core/src/index/rules.ts`), which also refuses two rows that answer the same
  question on one platform.

## What the rebuild reads today

The core's typed spec reader (`packages/core/src/spec/`, item 4.2 of docs/PLAN.md) reads the
package file: it checks the SHA-256 of the uncompressed bytes against the `.sha256` beside it,
package format 9 and the version, and the shape of the keys it reads (the eleven parts, the
scope every nested row of D3 states, every directory's `files`, the root rules, `save_keys`'
`name_in` lists, O1's names and O2's values), and exposes the package as typed data, read once
per process (`Spec.part` gives a part's data, each row with its `status` and `evidence`). It opens a companion only when a feature asks
for it, checked against the SHA-256, size and header the package file records; the data-types
companion answers every lookup with a list. The hand-kept tables (`tables`) are read by a
written trust rule (docs/decisions.md, "Awaiting confirmation", item 4.2). The tools' suites
read the package through the same reader; `task spec:check` keeps its own fuller check (every
companion, the JSON Schema, the gzip headers, the format 4 copy).

What the engine checks read today: the buckets, `multi_bucket`, `iterator_prefixes`,
`keyword_templates`, `modifier_templates`, `modifier_template_marks` and
`modifier_template_tags`, `retired`, `scope_validity.links` and the `takes` of triggers,
`directories` and `schema` (`record_body`, each field's `kind`, `holds` and `fields`, the
placeholder fields `<date>` and `<number>`, the value groups of `value_type`), `errors`, the
tables `structural`, `containers`, `random_list_entry`, `opens_context`, `iterator_params`,
`block_params`, `modifier_block_params`, `value_block_keys`, `value_fields`,
`vanilla_indexed_dirs` and `scope_heads`, and of the eight new parts D6 (`field_references`,
the fields and parameters that name an on-action) and D7 (`modifier_block_areas`, the use
areas a modifier block accepts). The index reads the folder list and record schemas, which
files of each folder are script (format 9, `directories[].files`: `sound/GUIDs.txt` and
`gfx/models/buildings/naming.txt` are not), D1 (the override rules), D2 (`declarations`) and
D3 (`definitions`, with the scope of each nested name since format 8), and the table
`save_keys`, each entry with what it saves and where its name is written (format 9), with the
link its evidence names (the saves and reads of a scope, item 4.6), and O1 (names the game saves
from its own code). D4 (`keyword_roles`) states no
context the tables do not (a test holds the two to each other); it is read, through one reader
(`check/keyword-roles.ts`), for the keywords the structural checks of item 4.5 and the advice
checks of item 4.7 test (confirmed roles only for an error or a warning), and for the keyword
that sets an event's scope (item 4.4). D5 (`implicit_loc_keys`) is read by
`localization/missing-key` and `localization/unused-key`, with each field's `loc_key` and
`info_type`. D8 (`iterator_kinds`) gives the scope checks of item 4.4 the kind of each iterator
prefix. The scope checks also read `scope_types`, O2 (`not_scope_types`: a keyword whose scope data
names `none` declares no requirement), `scope_validity` (the scopes each trigger, effect, link
and on-action takes), the schema's `root_scope` with its rule (format 9: judged only when
`fixed`, and not on a root only the wiki-era seed gives), each field's `scope` and `info_scope`,
and the tables `root_scope_contradicted`, `fields_outside_root` and `same_scope_structural`. The advice checks read the schema's `record_usage` and observed
`values`, D6 for the database a portrait animation names, and the tables `event_types` and
`save_keys`. `references/unknown-key` reads D6's confirmed rows with their `sentinels` and `miss_values`
(format 9), and `fields/unknown-field` the schema's `open_keys` (an ethnicity's keys are
genes). Lookup (item 4.8) reads every part a name can be in: the buckets with their
descriptions and scopes, D2, D4, D5 (a modifier's localization keys, `MOD_<NAME>` from
`buckets.modifiers` since format 9), D6, D7, D8,
`scope_types`, `noise_dropped`, the schema's fields, the tables of part C4 with what the trust
rule does with them, and the data-types companion when it is asked for.

What format 9 added for checks that waited on it is read by those checks (pull request #161,
and decision 158 for the last): D9 (`localizationFormsOf`), whose forms that read a saved scope
the index records for each localization entry, by `scope/title-text-reads-scope-saved-late` (its
`game_concept` forms by no check yet: a concept's aliases are not defined, docs/decisions.md row
151); the table `variables` (`Tables.variables`), with which the index records every variable
set and every variable statement's name, by `variables/read-without-set`; and of D4's new keys,
read through `check/keyword-roles.ts`, `holds_with` with `child_always_true` (the role
`constant_condition` of `always`, the role `combines_conditions`) by `style/redundant-condition`,
`fails_with` with `child_always_false` by `style/redundant-false-condition`, and the role
`ai_weight` of `ai_chance` and `ai_will_select` by `style/option-without-ai-weight`;
`combination` is read with each row and decides no check. The catalogue's four "Unterminated
..." messages are read by `localization/unbalanced-brackets` (the opener a text leaves open), and
its `triggered_desc` message, with D4's `closed_body` and `allows_only`, by
`structure/triggered-desc-other-field`.

## The format 4 copy

`legacy/ck3-spec-1.21.0.3.format4.json.gz` is the 1.21.0.3 package as `pdx-parser-re` also
builds it in format 4, the only format release 2.3.0 reads. `task baseline:prepare` points the
export of `legacy/` at it, and every 2.3.0 baseline record names it as its spec
([records/README.md](../records/README.md#baselines)). The rebuild never reads it.

It is the copy the format 7 and format 8 passes built (SHA-256 `72f843cf...c724`), kept when
format 9 was adopted (docs/decisions.md, 2026-11-25). The format 9 pass builds a format 4 copy
too (`078e6cb4...6beb6`), and release 2.3.0 refuses it: 132 of its catalogue rows have the
`since` value `<=1.21.0.3`, which 2.3.0's `SINCE_VALUES` lacks, and `legacy/` is not changed.
That copy differs from the committed one by the 648 catalogue rows more, the roots of
`common/laws`, `history/titles` and `common/scripted_modifiers`, the scope of `can_title_have`,
the scope type `court_position` and its manifest's input checksums; none of it is a fact a
2.3.0 baseline measures against, and the baselines were made with the committed copy.

## The override rules table

Which definition is in force when the same thing is defined more than once is data, never code
(docs/MVP.md, "Override rules"; docs/PLAN.md, item 3.1a). The table is part D1 of the package,
`override_rules.data.rules`: 95 rows read out of the Windows executable (and, for its
localization reader, the Linux one) by the spec work, each with its evidence, its `status`
(`settled` 70, `partial` 15, `open` 7, `derived` 3), the platforms it holds on and what it rests
on per platform (`platform_basis`: `read`, `derived`, `derived-not-read`, or
`assumed-same-engine` by the owner's decision that the engine is the same on both). It retired
the stand-in table this folder held until then, `override-rules.json` with its schema
(docs/decisions.md, 2026-11-22). [docs/overrides.md](../docs/overrides.md) says, rule by rule,
which row decides it or that it is still open.

The core reads the table through a parameter and holds no rule of its own. 40 rows are of
pychivalry's own nine kinds, one per kind of question overrides.md asks:

| Kind | What a row says |
| --- | --- |
| `file-replace` | A file in one layer replaces, whole, the file at the same path in others |
| `file-identity` | A file is identified by its whole relative path |
| `path-case` | Paths that differ only in letter case are the same path, or two |
| `pack-layer` | Where the DLC packs are and how their files sit in the game's tree |
| `replace-path` | What `replace_path` in a mod's descriptor hides |
| `file-order` | The order files are read in |
| `key-resolution` | What is in force when a key of a database is defined again: by priority, the later or the earlier, all of them, or the folder is not keyed |
| `containers` | Top-level keys whose entries are the definitions, and that add up |
| `folder-wins` | A definition under a named folder wins over every other |

The other 55 rows are of eight kinds the spec work added (`override_rules.data.extensions`).
The index applies `listing-depth` (whether a folder is read with its subfolders) and reads the
other seven without applying them: `mount-order`, `mount-dependencies`, `key-identity`,
`field-outcomes`, `path-case-mechanism`, `duplicate-message` and `open-question`; each one's
reason is `SKIPPED_KINDS` in `rules.ts` and docs/decisions.md. The one `key-identity` row that
folds letter case, `key-identity-gui-types`, is for GUI type names, and the index reads no
`.gui` file.

Format 8 adds fields that say a decision as data, and the index applies each where its row
decides:

| Field | Row | What the index does |
| --- | --- | --- |
| `file_condition` | `msg-localization-missing-bom` (Linux and Windows), a `duplicate-message` row | A localization `.yml` file whose bytes do not start with the UTF-8 byte-order mark adds no keys (`IndexedFile.noDefinitions` names the row). Applied whatever the row's kind; text an editor hands in has no bytes to test and is read as written |
| `entries` | `gene-group-containers`, `special-genes-container`, `age-presets-container` | A container's children are its definitions, or (`special_genes`) containers again; definitions of one `key_space` are one map, known by their name and the parts of the key the folder's key-resolution row lists (`details.key.parts`: the `portrait_group` line in force). `decal-atlases-container` is partial and decides nothing |
| `details.type_mismatch`, `details.key_spaces` | `gene-database-later-wins` | A later gene of another type is refused and the earlier stays; a gene after a refused one in its block is "winner not known" (the row's `open`) |
| `alias` | `coat-of-arms-alias` | The folder's top-level statements are replayed in read order: a line `key = other_key` points the key to the object of a name already read, else does nothing; a later block for any name on an object fills it for all of them. `replayed` is derived and only checked against |
| `details.statements`, `details.stores` | `province-terrain-statements` | Each kind of statement is a store of its own (the terrain line, the winter block); within one, the later is in force, the block field by field |

Format 9 adds fields to 38 rows that say as data what format 8 said in words, and the index
reads them where it read those words:

| Field | Rows | What the index does |
| --- | --- | --- |
| `key_identity` (in `details.statements.<kind>`) | `province-terrain-statements` | A province id is compared as an integer: `007` and `7` are one key of the terrain store and of the winter store (`compare: integer`); a default is a keyword. On the other rows `key_identity` says bytes or a hash of them, as the index already compares; the kind `key-identity` stays read and not applied |
| `on_replace` (on a row, or in `details.key_spaces.<space>`) | `gene-database-later-wins` and 12 more | A nested definition written in a definition a later one replaced: `dropped` (a gene's templates) is in force nowhere, and one the later definition writes again is the later's; `unknown` leaves the name "winner not known"; `kept` and `not-applicable` change nothing |
| `within` | `defines-later-wins-per-define`, `events-by-override-priority`, `localization-replace-folder-wins` and more | Read in place of `details.within_one_block` (scope `same-block`) and `details.among_segment` (`same-segment`); on a priority tie (`same-priority`) the clash stays an error and names the definition the game keeps, the first read |
| `merge` | the add-up rows (`on-action-declarations-add-up`, title and province history) | Given with the answer "every definition counts": how they add up (appended, by date then read order) |
| `path_match` | `localization-replace-folder-wins`, `replace-path-hides-lower-layers-in-listings` | The text `/replace/` anywhere in the path, byte for byte; the listed folder byte for byte. A test the index does not know makes the row decide nothing |
| `compare_unit` | `file-read-order` | The order compares one path component at a time |
| `pack` | `dlc-packs-layout` | A pack's descriptor is looked for at any depth below `dlc/` |

`among` (a skipped kind), `hides_scope` (one mod is read at a time) and `read_first` (a partial
row) are read and decide nothing here.

Part D3's `name_scope` (format 8) says whether a nested name is known by itself or with its
parent (`scope_parent`); the index reads it in place of the format 7 reading that every name
found by its place is local to its parent. A scope that is `measured-only` or `unknown` decides
nothing: the same name under two parents is "winner not known" (reason `name-scope`).

A row decides when its status is `settled` or `derived` and its kind is one the index
applies; a `partial` or `open` row decides nothing, and the question it would answer stays
"defined more than once, winner not known" (docs/decisions.md, "Awaiting confirmation"). A
row's `details` are read where the kind cannot say what the game does: `within_one_block`
(defines), `among_segment` (two files under `replace`), and the byte-for-byte match of a
folder's name (`replace`, `replace_path`).

A layer is `clausewitz`, `jomini`, `game` (the install's three folders), `dlc` (every DLC pack)
or `mod`. A database is a folder of the spec's list (`common/traits`), or `localization` for
every language. The table's digest (the canonical JSON of its format, game build and rows) is
part of the index cache's key and of every `game:index` record, so a changed table rebuilds the
cache and fails a record made on the old one.

## How a new package arrives

1. `pdx-parser-re` derives it for a game build and writes the package file, its companions, the
   format 4 copy, a `.sha256` for each and the schema.
2. Each JSON file is checked against its `.sha256`, gzipped as above and put in place of the
   old one; the format 4 copy goes in `legacy/` when release 2.3.0 can read it, the schema
   replaces `schema.format9.json`. `task spec:check` verifies the lot.
3. Every committed record made on the old package now fails `task records:check`, so the
   suites that need game files are re-run, and the 2.3.0 baselines on the new format 4 copy,
   and their records are committed with the package.
