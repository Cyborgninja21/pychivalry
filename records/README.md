# Records

A record is the committed result of one run of a suite that needs game files: the base-game
suites, the real-mod suite, the benchmarks and the 2.3.0 baselines. Those suites run on a
machine that has the game and the mod corpus, never in public CI. Their records are committed,
and public CI checks them (`task records:check`, part of `task ci`).

The machine-readable form of this format is [record.schema.json](record.schema.json) (JSON
Schema 2020-12). Where this page and the schema disagree, the schema is what the check
enforces and this page is fixed.

## Where records live

| File | Written by |
| --- | --- |
| `game/parse.json` | `task game:parse` |
| `game/check.json` | `task game:check` |
| `game/mods.json` | `task game:mods` |
| `game/bench.json` | `task game:bench` |
| `baseline-2.3.0/speed-mods.json`, `speed-base-game.json`, `speed-editor.json` | `task baseline:speed` |
| `corpus/MANIFEST.tsv` | `task corpus:manifest`; the pinned corpus, not a record ([corpus/README.md](corpus/README.md)) |

Each run overwrites its suite's record; the history is git's. Records are written only by the
tasks, never by hand.

## The format

Every record is one JSON object, four-space indented, with a final newline.

| Field | What it states |
| --- | --- |
| `record_format` | The version of this format: `1`. |
| `suite` | Which suite: `game:parse`, `game:check`, `game:mods`, `game:bench` or `baseline:speed`. |
| `command` | The command that made it, with `<game dir>`, `<corpus dir>` and `<legacy build>` for local paths. |
| `made_at` | When it was made, ISO 8601 in UTC. |
| `tool` | The build that made it: `name` (`pychivalry`), `version`, the git `commit`, and `dirty`, true when tracked files outside `records/` differed from that commit. A 2.3.0 baseline names release 2.3.0 and the commit of the tag `v2.3.0`. |
| `machine` | The machine, generically: `os` (family), `arch`, `logical_cpus`, `memory_gib`, `node`. Nothing that identifies it or its owner. |
| `game` | The installed game: `build` (from the launcher's settings file, `rawVersion`), `manifest_sha256` (below), `files`, `content_hashed_files`. |
| `spec` | The spec package the run used: `version`, `sha256` (of the uncompressed bytes), `package_format`. |
| `corpus` | `null` for a suite that reads no mods; otherwise `manifest_sha256`, the SHA-256 of `corpus/MANIFEST.tsv` as committed, and `slugs`, the mods it read. |
| `notes` | Optional sentences a reader needs to interpret the results. Required on a speed record. |
| `results` | The results. Each suite's shape is defined, in the schema and here, by the step that builds the suite. A step 1 stub writes `{}`. |

### The game's file manifest

`game.manifest_sha256` identifies the game files a run read, so that a patch that changes
script files without changing the executable still changes the record (docs/MVP.md, "Speed").

The manifest lists every regular file under `<game dir>`, one line each:
`<path> TAB <size in bytes> TAB <sha256 or ->`, LF line endings, the path relative to the game
folder with `/`, the lines sorted by the UTF-8 bytes of the path. The content hash is taken for
the files the game itself checksums, as its `checksum_manifest.txt` lists them (in 1.21:
`common`, `events`, `history`, `map_data`, `gui`, `localization`, `data_binding`,
`gfx/court_scene/scene_settings` and `paths_checksummed.settings`); every other file is listed
with its size and `-`. `manifest_sha256` is the SHA-256 of that text. A change to a file outside
the checksummed folders that keeps its size is not seen; hashing the whole 20 GB install on
every run is the price that would avoid it.

### A mod's hash

The same manifest of the mod's folder, with every file hashed. The corpus manifest states it
per mod; a suite that reads the corpus recomputes it and fails (exit 1) when a mod on disk is
not the pinned copy.

## What `task records:check` enforces

For every `*.json` under `records/` except the `*.schema.json` files:

1. It is valid against [record.schema.json](record.schema.json): every field present, nothing
   unknown.
2. Its `spec` is the committed spec: the same version and the same SHA-256 as `spec/`. **A
   record made on another spec fails**, so a spec change forces the suites to be re-run.
3. If it read the corpus, its `corpus.manifest_sha256` is the SHA-256 of the committed
   `corpus/MANIFEST.tsv`, so a corpus refresh forces them to be re-run too.
4. No string in it is an absolute or home-relative path.
5. A speed record's statistics agree with its own values.
6. A parse record's totals agree with its folders, its error count with its error list, and
   `passed` with its failures; a passing parse record holds only errors classified
   `game-defect`.

## Speed records (`baseline:speed`)

`results.series` is a list of series. A series is repeated runs of one measurement on one input:

| Field | What it states |
| --- | --- |
| `name` | What was measured, in words. |
| `method` | How (below). |
| `mod` | The corpus slug, or `null` for the base game alone. |
| `runs` | How many runs were made, the first included: at least 6. |
| `measures` | Per measure: `unit` (`ms` or `KiB`), `first`, and `later`. |
| `context` | Facts that are not measures: file counts, the editor version, the load average before each run, exit codes. |

`first` is the first run of the series, made in a fresh process. **It is not a cold start**: the
operating system's file cache cannot be dropped without administrator rights, and earlier work
had usually read the same files, so they were most likely cached. `later` gives, for the runs
after the first, `n` (at least 5), `median` (of an even count, the mean of the middle two),
`min`, `max`, `spread` (max minus min) and every value in order.

The methods, each a tool of release 2.3.0 run unchanged from a build outside the repository:

| Method | What one run is |
| --- | --- |
| `corpus-acceptance` | `packages/engine/scripts/corpus-acceptance.js <corpus dir> <game dir> <slug>`: `load_ms`, the workspace load (the mod and the base game) before any mod file is checked; `whole_mod_check_ms`, the load plus the check of every script file; `peak_rss_kib`, the peak resident memory of the process that did both. |
| `vanilla-acceptance` | `packages/engine/scripts/vanilla-acceptance.js <game dir> <out>`: `parse_ms`, every `.txt` under `common/`, `events/`, `history/` parsed; `check_ms`, the same tree loaded and checked; `peak_rss_kib` of the whole process, read at exit. A heap limit set with `BASELINE_NODE_HEAP` is stated in `context.node_flags` and the record's notes. |
| `editor` | The extension's integration harness under `xvfb-run`, a real VS Code per mod: `time_to_first_full_result_ms`, from activation to the language server's first full background pass; `server_peak_rss_kib`, the language server's peak memory. |

## Parse records (`game:parse`)

`task game:parse` (build step 2) parses every script file of the base game in an explicit list
of folders and extensions, and measures the encoding of every text file of the game
([docs/encoding.md](../docs/encoding.md)). Its `notes` are required. `results`:

| Field | What it states |
| --- | --- |
| `passed`, `failures` | Whether the run passed, and each failed pass condition in words |
| `files`, `trees`, `parse_ms` | Script files read, files that yielded a tree, and the time to decode and parse them all, in one process |
| `folders` | Per folder and extension: `expected_files` and `files`, `trees`, `bom`, `not_utf8`, `errors`, `parse_ms`, `why` (the evidence it holds script), and the `excluded` files with why |
| `errors` | Every parse error: `file`, `line` and `column` (from 1), the finding's `id`, its `catalogue` entry, the `message`, and its `classification` (`game-defect`, `pychivalry-fault` or `unclassified`) with the `reason` |
| `notes` | Every information finding, such as a file that is not valid UTF-8 |
| `not_read` | The text files the suite does not parse, and why |
| `encoding` | Over every text file of the game: `files`, `bom`, `utf16_bom`, `not_utf8`, `line_endings`, the same `by_folder`, and per file that is not valid UTF-8 its `invalid_bytes`, `first_line`, where the bytes sit (`in_comments`, `in_strings`, `elsewhere`) and its `valid_multibyte_sequences` |

The run passes when every folder holds the files expected, every file yields a tree, and every
error matches an entry of `tools/data/parse-classifications.json` (by file, finding and line)
classified `game-defect`. An error without an entry, an entry without an error, and a
`pychivalry-fault` each fail it. A failed run still writes its record, and exits 1.

### Baselines and the format 5 spec

The 2.3.0 baselines are made with the spec 2.3.0 can read, format 4. They pass check 2 today
because the committed stand-in is that same package. When the format 5 package replaces it, no
2.3.0 run can carry its checksum, so check 2 will fail them by design; how baselines are
checked from then on is decided with that change (docs/PLAN.md, item 1.6).
