# The spec package

pychivalry takes its CK3 vocabulary only from the spec package that `pdx-parser-re` derives
from the game (docs/MVP.md, "The spec package"). The built package is committed here as it
was built, with its checksums and its schema. Nothing here is edited by hand.

| File | What it is |
| --- | --- |
| `ck3-spec-1.21.0.3.json.gz` | The package file for game 1.21.0.3, package format 8, gzipped. It also holds the override rules table (part D1, below) |
| `ck3-spec-1.21.0.3.info.json.gz` | Companion C1: Paradox's 214 `.info` documentation files, facts and full text (`info_docs`) |
| `ck3-spec-1.21.0.3.gui.json.gz` | Companion C2: the GUI vocabulary measured from the base game's `.gui` files (`gui`) |
| `ck3-spec-1.21.0.3.data_types.json.gz` | Companion C3: the game's own data-types dump (`data_types`) |
| `ck3-spec-1.21.0.3.sha256`, `.info.sha256`, `.gui.sha256`, `.data_types.sha256` | SHA-256 of each file's **uncompressed** JSON, in `sha256sum` form |
| `schema.format8.json` | The JSON Schema (draft 2020-12) of the package file and the three companions, from `pdx-parser-re` (`spec/package/schema.format8.json`) |
| `legacy/ck3-spec-1.21.0.3.format4.json.gz`, `legacy/ck3-spec-1.21.0.3.format4.sha256` | The same game version in package format 4. It exists only so that release 2.3.0 can be run for the baselines; nothing in the new code reads it |

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
children are (`entries`), and an alias line (`alias`, `replayed`). No part and no top-level key
is added; the rows of D2 and D3 are closed in the format 7 schema, hence the new number. The
package file grew to 26,939,337 bytes uncompressed (1.61 MB gzipped); the three companions
changed by one header value each; the format 4 copy is byte-identical.

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
no platform rewrites their bytes, and keeps `schema.format8.json` byte for byte as well.

## The check

`task spec:check` (part of `task ci`) fails unless:

- the folder holds exactly one `ck3-spec-<version>.json.gz`, and its `.sha256` equals the
  SHA-256 of the uncompressed bytes and names the uncompressed file;
- the package's `package_format` is 8, the only format the rebuild reads (a format 5 or 7
  package is refused: the index reads keys only format 8 carries), and its
  `manifest.version` is the version in the file name;
- `schema.format8.json` declares `package_format` 8;
- every companion `manifest.companions` lists is here, gzipped, with the SHA-256 and the size
  the package states, its own `.sha256` agreeing, the same record under the package's key for
  it, and a header (`companion`, `package`, `version`, `package_format`) naming this package;
  a companion that is missing, altered or of another package fails;
- no other `ck3-spec-*.json[.gz]` file sits beside them;
- the package file and every companion are valid against `schema.format8.json` (each
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
package format 8 and the version, and the shape of the keys it reads, the eight parts and the
scope every nested row of D3 states among them, and exposes the package as typed data, read once per process (`Spec.part` gives a part's
data, each row with its `status` and `evidence`). It opens a companion only when a feature asks
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
areas a modifier block accepts). The index reads the folder list and record schemas, D1 (the
override rules), D2 (`declarations`) and D3 (`definitions`, with the scope of each nested name
since format 8), and the table `save_keys` with the link its evidence names (the saves and
reads of a scope, item 4.6). D4 (`keyword_roles`) states no
context the tables do not (a test holds the two to each other). D5 (`implicit_loc_keys`) is read
by `localization/missing-key` and `localization/unused-key`, with each field's `loc_key` and
`info_type`; D8 is read by no check yet.

## The format 4 copy

`legacy/ck3-spec-1.21.0.3.format4.json.gz` is the 1.21.0.3 package as `pdx-parser-re` also
builds it in format 4, the only format release 2.3.0 reads. `task baseline:prepare` points the
export of `legacy/` at it, and every 2.3.0 baseline record names it as its spec
([records/README.md](../records/README.md#baselines)). The rebuild never reads it.

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
   old one; the format 4 copy goes in `legacy/`, the schema replaces `schema.format8.json`.
   `task spec:check` verifies the lot.
3. Every committed record made on the old package now fails `task records:check`, so the
   suites that need game files are re-run, and the 2.3.0 baselines on the new format 4 copy,
   and their records are committed with the package.
