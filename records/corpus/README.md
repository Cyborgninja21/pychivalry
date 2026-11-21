# The mod corpus

Five published Steam Workshop mods, the same five release 2.3.0 was measured on, used by the
real-mod suite (`task game:mods`), the benchmarks (`task game:bench`) and the 2.3.0 baselines.
The mods themselves are never committed; [MANIFEST.tsv](MANIFEST.tsv) pins them.

| Slug | Workshop id | Supported version (descriptor) |
| --- | --- | --- |
| `balance-of-power-ui` | 3157042775 | 1.\*.\* |
| `divine-intervention` | 2986538297 | 1.21.0.3 |
| `elf-destiny` | 3114064450 | 1.21.\* |
| `rice` | 2273832430 | 1.19.\* |
| `viet-events` | 2227658180 | 1.21.\* |

Copied on 2026-11-21 from the local Steam workshop cache (app 1158310), one folder per slug in
`<corpus dir>` (the folder `CK3_CORPUS` names), with each mod's top-level `music/` folder left
out, as for 2.3.0. Three mods have been updated since 2.3.0's copy of 2026-10-02: Divine
Intervention (then 1.20.0.2), Elf Destiny (then 1.20.\*) and VIET Events (then 1.19.\*) now
declare 1.21.

## MANIFEST.tsv

Tab-separated, LF line endings, one comment line, a header, one row per mod:

| Column | What it holds |
| --- | --- |
| `slug` | The folder name in `<corpus dir>` |
| `workshop_id` | `remote_file_id` from the mod's `descriptor.mod` |
| `name` | `name` from `descriptor.mod` |
| `supported_version` | `supported_version` from `descriptor.mod` |
| `files` | Every file in the copy (not only script files) |
| `sha256` | SHA-256 of the mod folder's file manifest, every file hashed (records/README.md, "A mod's hash") |

`task game:mods`, `task game:bench` and `task baseline:speed` recompute each mod's file count
and hash and fail (exit 1) when the copy on disk is not the pinned one. Every record made on
the corpus states the SHA-256 of this file, so a refresh fails `task records:check` until the
suites are re-run.

## Refreshing it

A refresh is a deliberate act that re-records the expected results, and only mods the owner
supplies are used (docs/MVP.md, "Test data"):

1. Copy each mod from `steamapps/workshop/content/1158310/<workshop id>` of a Steam library
   subscribed to it into `<corpus dir>/<slug>/`, without its top-level `music/` folder (for
   example `rsync -a --exclude=/music/ <source>/ <corpus dir>/<slug>/`), one mod at a time.
2. `CK3_CORPUS=<corpus dir> task corpus:manifest` writes this file, and a copy into
   `<corpus dir>/MANIFEST.tsv`, where release 2.3.0's corpus script reads it.
3. Re-run every suite that reads the corpus and commit the manifest with their records.
