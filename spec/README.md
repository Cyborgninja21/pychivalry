# The spec package

pychivalry takes its CK3 vocabulary only from the spec package that `pdx-parser-re` derives
from the game (docs/MVP.md, "The spec package"). The built package is committed here as it
was built, with its checksums and its schema. Nothing here is edited by hand.

| File | What it is |
| --- | --- |
| `ck3-spec-1.21.0.3.json.gz` | The package file for game 1.21.0.3, package format 5, gzipped |
| `ck3-spec-1.21.0.3.info.json.gz` | Companion C1: Paradox's 214 `.info` documentation files, facts and full text (`info_docs`) |
| `ck3-spec-1.21.0.3.gui.json.gz` | Companion C2: the GUI vocabulary measured from the base game's `.gui` files (`gui`) |
| `ck3-spec-1.21.0.3.data_types.json.gz` | Companion C3: the game's own data-types dump (`data_types`) |
| `ck3-spec-1.21.0.3.sha256`, `.info.sha256`, `.gui.sha256`, `.data_types.sha256` | SHA-256 of each file's **uncompressed** JSON, in `sha256sum` form |
| `schema.format5.json` | The JSON Schema (draft 2020-12) of the package file and the three companions, from `pdx-parser-re` (`spec/package/schema.format5.json`) |
| `legacy/ck3-spec-1.21.0.3.format4.json.gz`, `legacy/ck3-spec-1.21.0.3.format4.sha256` | The same game version in package format 4. It exists only so that release 2.3.0 can be run for the baselines; nothing in the new code reads it |
| `override-rules.json` | The override rules table, a stand-in the spec package does not yet replace ([below](#the-override-rules-table)) |
| `override-rules.schema.json` | The table's JSON Schema |

The package file holds every part a tool needs to start; each companion holds one heavy part
and is opened only when that part is needed. The package file names each companion in
`manifest.companions` (its file, part, key, SHA-256 and size) and records it again under its
own key (`info_docs`, `gui`, `data_types`).

The package carries Paradox's full `.info` text (`manifest.info_text` is `full`) and is
committed as `pdx-parser-re` built it (docs/decisions.md, 2026-11-22).

## Compression

Every JSON file here is committed gzipped (docs/decisions.md, 2026-11-22): 2.75 MB for the four
files of the package instead of 50.4 MB, and 0.64 MB for the format 4 copy instead of 8.6 MB.
The checksums are of the uncompressed bytes, so a file can be checked against the `.sha256`
that `pdx-parser-re` wrote beside it.

The compression is deterministic, so the same JSON always gives the same committed bytes:

```bash
gzip -n -9 -c ck3-spec-1.21.0.3.json > ck3-spec-1.21.0.3.json.gz
```

`-n` keeps the file name and the time out of the gzip header; `-9` is the highest level. The
committed files were made this way with GNU gzip 1.14. `.gitattributes` marks them binary, so
no platform rewrites their bytes, and keeps `schema.format5.json` byte for byte as well.

## The check

`task spec:check` (part of `task ci`) fails unless:

- the folder holds exactly one `ck3-spec-<version>.json.gz`, and its `.sha256` equals the
  SHA-256 of the uncompressed bytes and names the uncompressed file;
- the package's `package_format` is 5, the only format the rebuild reads, and its
  `manifest.version` is the version in the file name;
- `schema.format5.json` declares `package_format` 5;
- every companion `manifest.companions` lists is here, gzipped, with the SHA-256 and the size
  the package states, its own `.sha256` agreeing, the same record under the package's key for
  it, and a header (`companion`, `package`, `version`, `package_format`) naming this package;
  a companion that is missing, altered or of another package fails;
- no other `ck3-spec-*.json[.gz]` file sits beside them;
- the package file and every companion are valid against `schema.format5.json` (each
  companion against the `$defs` entry for its `companion` name). The validation runs in CI:
  the whole spec check takes under a second. The schema is written for a draft 2020-12
  validator rather than for Ajv's strict authoring rules, so the check relaxes those rules
  except the one that refuses an unknown keyword;
- every gzip header stores no file name, comment, extra field or time;
- `legacy/` holds exactly one `ck3-spec-<version>.format4.json.gz` whose `.format4.sha256`
  agrees, whose `package_format` is 4 and whose game version is the package's;
- `override-rules.json` is valid against `override-rules.schema.json`, and the core's own reader
  (`readRulesTable` in `packages/core/src/index/rules.ts`) accepts it: it also refuses two rows
  that answer the same question on one platform.

## What the rebuild reads today

The core's typed spec reader (`packages/core/src/spec/`, item 4.2 of docs/PLAN.md) reads the
package file: it checks the SHA-256 of the uncompressed bytes against the `.sha256` beside it,
package format 5 and the version, and exposes the package as typed data, read once per
process. It opens a companion only when a feature asks for it, checked against the SHA-256,
size and header the package file records; the data-types companion answers every lookup with
a list. The hand-kept tables (`tables`) are read by a written trust rule (docs/decisions.md,
"Awaiting confirmation", item 4.2). The tools' suites read the package through the same
reader; `task spec:check` keeps its own fuller check (every companion, the JSON Schema, the
gzip headers, the format 4 copy).

What the engine checks read today: the buckets, `multi_bucket`, `iterator_prefixes`,
`keyword_templates`, `modifier_templates` and `modifier_template_marks`, `retired`,
`scope_validity.links` and the `takes` of triggers, `directories` and `schema` (`record_body`,
each field's `kind`, `holds` and `fields`, the placeholder fields `<date>` and `<number>`, the
value groups of `value_type`), `errors`, and the tables `structural`, `containers`,
`random_list_entry`, `opens_context`, `iterator_params`, `block_params`,
`modifier_block_params`, `value_block_keys`, `value_fields`, `vanilla_indexed_dirs` and
`scope_heads`. The index reads the folder list and record schemas as before.

## The format 4 copy

`legacy/ck3-spec-1.21.0.3.format4.json.gz` is the 1.21.0.3 package as `pdx-parser-re` also
builds it in format 4, the only format release 2.3.0 reads. `task baseline:prepare` points the
export of `legacy/` at it, and every 2.3.0 baseline record names it as its spec
([records/README.md](../records/README.md#baselines)). The rebuild never reads it.

## The override rules table

Which definition is in force when the same thing is defined more than once is data, never code
(docs/MVP.md, "Override rules"; docs/PLAN.md, item 3.1a). The table is to come in the spec
package, read out of the Windows and Linux executables by the spec work. The 1.21.0.3 package
does not carry it: the override rules are the thirteenth addition, and the twelve the package
carries are the others (docs/MVP.md, "The spec package"). So
**`override-rules.json` stays a stand-in that carries only the rules
[docs/overrides.md](../docs/overrides.md) marks settled**: rules 1, 2 and 10, and the settled
parts of rule 6 (events and character history by their override priority, on-actions, define
groups and container keys adding up, province terrain not keyed). Every row names the rule's
number in overrides.md, the folders (databases) it holds for, what it decides, its evidence with
its rank, and the platforms it holds on. The open rules have no row, so the index names no winner
for what they decide. The other requests to the spec work that the package does not carry
either (declarations that are not records, nested and file-named definitions, keyword roles,
implicit localization keys) are held (docs/decisions.md).

The core reads the table through a parameter and holds no rule of its own. Each kind of row is a
kind of question overrides.md asks, settled or open, so that a rule the spec work adds is a new
row and no code changes:

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

A layer is `clausewitz`, `jomini`, `game` (the install's three folders), `dlc` (every DLC pack)
or `mod`. A database is a folder of the spec's list (`common/traits`), or `localization` for
every language. `rules_format` is the table's own format, 1. Its digest is part of the index
cache's key and of every `game:index` record, so a changed table rebuilds the cache and fails a
record made on the old one.

## How a new package arrives

1. `pdx-parser-re` derives it for a game build and writes the package file, its companions, the
   format 4 copy, a `.sha256` for each and the schema.
2. Each JSON file is checked against its `.sha256`, gzipped as above and put in place of the
   old one; the format 4 copy goes in `legacy/`, the schema replaces `schema.format5.json`.
   `task spec:check` verifies the lot.
3. Every committed record made on the old package now fails `task records:check`, so the
   suites that need game files are re-run, and the 2.3.0 baselines on the new format 4 copy,
   and their records are committed with the package.
