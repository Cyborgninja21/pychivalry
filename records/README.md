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
| `game/index.json` | `task game:index` |
| `game/check.json` | `task game:check` |
| `game/mods.json` | `task game:mods` |
| `game/bench.json` | `task game:bench` |
| `baseline-2.3.0/speed-mods.json`, `speed-base-game.json`, `speed-editor.json` | `task baseline:speed` |
| `baseline-2.3.0/results-base-game.json`, `results-mods.json` | `task baseline:results` |
| `scored/agent-use.json` | `task scored:agent-use`, a scored test run in test sessions of the developer's own Claude Code ([below](#scored-records-scoredagent-use)) |
| `corpus/MANIFEST.tsv` | `task corpus:manifest`; the pinned corpus, not a record ([corpus/README.md](corpus/README.md)) |

Each run overwrites its suite's record; the history is git's. Records are written only by the
tasks, never by hand.

## The format

Every record is one JSON object, four-space indented, with a final newline.

| Field | What it states |
| --- | --- |
| `record_format` | The version of this format: `1`. |
| `suite` | Which suite: `game:parse`, `game:index`, `game:check`, `game:mods`, `game:bench`, `baseline:speed`, `baseline:results` or `scored:agent-use`. |
| `command` | The command that made it, with `<game dir>`, `<corpus dir>` and `<legacy build>` for local paths. |
| `made_at` | When it was made, ISO 8601 in UTC. |
| `tool` | The build that made it: `name` (`pychivalry`), `version`, the git `commit`, and `dirty`, true when tracked files outside `records/` differed from that commit. A 2.3.0 baseline names release 2.3.0 and the commit that last changed `legacy/`; its `dirty` is true when the build copy differs from `legacy/` in a file other than those the baseline writes on purpose (the export's `spec.config.json`, and the records 2.3.0's own tools write into their tree). |
| `machine` | The machine, generically: `os` (family), `arch`, `logical_cpus`, `memory_gib`, `node`. Nothing that identifies it or its owner. |
| `game` | The installed game: `build` (from the launcher's settings file, `rawVersion`), `manifest_sha256` (below), `files`, `content_hashed_files`. |
| `spec` | The spec package the run used: `version`, `sha256` (of the uncompressed bytes), `package_format`. For a 2.3.0 baseline, the format 4 copy it ran on ([Baselines](#baselines)). |
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
   record made on another spec fails**, so a spec change forces the suites to be re-run. A
   2.3.0 baseline is tied to the committed format 4 copy instead, by the rule in
   [Baselines](#baselines). A scored record is not tied to it at all
   ([Scored records](#scored-records-scoredagent-use)).
3. If it read the corpus, its `corpus.manifest_sha256` is the SHA-256 of the committed
   `corpus/MANIFEST.tsv`, so a corpus refresh forces them to be re-run too.
4. No string in it is an absolute or home-relative path.
5. A speed record's statistics agree with its own values.
6. A parse record's totals agree with its folders, its error count with its error list, and
   `passed` with its failures; a passing parse record holds only errors classified
   `game-defect`.
7. An index record was made on the committed rules table (`results.rules.sha256` is the core's
   digest of the spec package's override rules, part D1), so a changed table forces the suite to
   be re-run; its
   base-game totals agree with its layers; `passed` agrees with its failures; and its mods are
   the corpus slugs it names.
8. A results baseline's counts agree with each other: the parse's files with its folders and
   its errors with its error list; per check and per mod, the totals by severity with the
   counts by code, and the error count with the error list and the total of errors; and its
   mods are the corpus slugs it names.
9. A check record (`game:check`, and each mod of `game:mods`) agrees with itself: the totals by
   severity with the counts by code, the error and warning counts with their lists and their
   severity's total, the findings the per-file cap dropped with their codes, `passed` with its
   failures, the base game's files with its layers, and a `game:mods` record's mods with the
   corpus slugs it names; a passing record holds no finding classified `unclassified` or
   `pychivalry-fault`.
10. A scored record agrees with itself: each trial's `passed` with its graders and its harness
    problems, its graders the five in order, each grader's `passed` with its problems, the
    trials numbered from 1, and each task's trial and pass counts, pass rate and target with
    the trials.

## Baselines

The 2.3.0 baselines (`baseline:speed`, `baseline:results`) are made by release 2.3.0, which
reads only package format 4. They cannot be made on the committed package, which is format 5,
so they are tied to the committed **format 4 copy of the same game version**,
`spec/legacy/ck3-spec-<version>.format4.json.gz` ([spec/README.md](../spec/README.md#the-format-4-copy)).
`task records:check` fails a baseline unless:

- its `spec` is that copy: the same version, the same SHA-256 of the uncompressed bytes, and
  `package_format` 4;
- its `game.build` is that copy's game version, which `task spec:check` makes the package's
  too: the baseline read the game build the spec was derived for;
- its `corpus`, if it read the corpus, is the committed `corpus/MANIFEST.tsv` (check 3, as for
  every record).

A new package or a new corpus therefore fails the baselines too, until they are re-run. The
tests are in `tools/src/records-check.test.ts`.

`task baseline:prepare` makes the run use that copy: it exports `legacy/` to a folder outside
the repository, copies the format 4 copy and its checksum into the export's
`packages/engine/spec/`, rewrites the export's `packages/engine/spec.config.json` (the one
place 2.3.0 reads to know which package to bundle) to name them, and builds the export. Each
baseline task then checks that the spec the build bundles, in the engine and in the
extension, is that copy byte for byte before it runs anything.

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

## Result baselines (`baseline:results`)

`task baseline:results` runs release 2.3.0's own tools once each, from the same build as the
speed baselines, and records what 2.3.0 found. Messages are 2.3.0's own, as it wrote them.

`results-base-game.json` (method `vanilla-acceptance`, `corpus` null): `results.base_game` has

| Field | What it states |
| --- | --- |
| `parse` | `files` (every `.txt` under `common/`, `events/`, `history/`), `by_folder`, `files_with_bom`, `errors` and `error_list` (`file`, `line`, `column`, `code`, `message`) |
| `check` | The same tree loaded and run through 2.3.0's registry, schema and scope checks: `by_severity`, `by_code` (`code`, `severity`, `count`, most first within a severity), `errors` and `error_list` (`file`, `line`, `code`, `message`) |
| `scope` | How much the scope check could judge: `keyword_uses`, `keyword_uses_known_scope`, `keyword_uses_judged`, `link_steps_judged`, `findings`, and the known uses by scope type |

`results-mods.json` (method `corpus-acceptance`): `results.mods` has per mod `slug`, `files`
(script files checked), `by_severity`, `by_code`, `errors` and `error_list` (`file` relative
to the mod, `line`, `code`, `message`, and `classification`, what 2.3.0's own classification
file says of the error, with its `reason` where it gives one). That file was written for the
corpus copy and spec of 2026-10, so `unclassified` means only that it does not cover the
error. `results.context` states the load average before each run and the exit codes.

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
| `round_trip` | The formatter's round trip over every file parsed (build step 8, item 8.3; [docs/formatting.md](../docs/formatting.md)): the `rules` used; `files`, `formatted`, `left` (each with a parse error: `file`, `id`, `line`), `changed`; `trees_equal`, `tokens_equal`, `second_format_unchanged`; `comments_before`, `comments_after`, `comments_moved`; `lines_before`, `lines_after`, `lines_changed` (the lines its edits touch); `blocks_written_on_one_line_broken` and `blocks` (by kind: one simple pair, plain values, empty, other; written on one line or several, laid out on one or several); `by_rule` (each `style/` hint's `files`, `places` and `lines`); `width` (the 120-column rule: lines over it before, formatted without it and with it, and the files it changes alone); `format_ms` and the `largest_file`; its `failures` |
| `round_trip_localization` | The same over the game's `localization/` `.yml` files, their reading by the index's localization reader compared |

The run passes when every folder holds the files expected, every file yields a tree, every
file formatted keeps its tree, tokens and comments (none moved) and a second format changes
nothing, and every
error matches an entry of `tools/data/parse-classifications.json` (by file, finding and line)
classified `game-defect`. An error without an entry, an entry without an error, and a
`pychivalry-fault` each fail it. A failed run still writes its record, and exits 1.

## Index records (`game:index`)

`task game:index` (build step 3) indexes the whole base game with the committed spec and its
override rules (part D1), saves the index to a cache in a temporary folder, reloads it, and indexes
each corpus mod over the base game. The fresh build, the reload and each mod run one at a time,
each in a fresh process, so the time and peak memory each reports are its own. Its `notes` are
required, and state the load average before the run. `results`:

| Field | What it states |
| --- | --- |
| `passed`, `failures` | Whether the run passed: the reloaded index answers as the fresh one (equal digests) and came from the cache, and every mod indexed |
| `platform`, `rules.sha256` | The platform whose rules applied, and the digest of the rules table used |
| `base_game.layers` | Per layer (`clausewitz`, `jomini`, `game`, `dlc`): files, definitions, uses, and the uses of a name something in the index defines |
| `base_game.files`, `lines`, `definitions`, `uses`, `uses_of_defined_names`, `names` | Totals over the layers; `names` counts every distinct string the index holds |
| `base_game.definitions_by_form` | Definitions by how they are written: `record`, `value`, `prefixed`, `constant`, `container`, `entry`, `key`, `file` |
| `base_game.folders` | Per folder of the spec that holds a file: its files, definitions, definitions by form, and the spec's own count of its files and records in the base game it was derived from |
| `base_game.spec_folders_without_files`, `not_described`, `not_read` | The spec's folders that hold no file read; the `.txt` and `.yml` files in folders the spec does not describe, by folder (`beside_spec_folders` when its first folder also holds listed ones); every other file, by extension |
| `base_game.defined_more_than_once` | The names of a database defined more than once: their count, how each resolves (`all`, `statements`, `clash`, `winner`, `single`, `not-read`, `unknown`), the unknown ones by the open rule of docs/overrides.md that leaves each open (a name can count under more than one), by reason (`unknown_by_reason`: `no-rule`, `not-settled:<row>` for a partial or open row, `no-order`, `file-unknown:<question>`) and by database |
| `base_game.time_ms`, `peak_rss_kib`, `heap_used_after_build_mib` | Listing, building, saving and reporting times; the build process's peak resident memory, read right after the build and the save; its heap in use then |
| `base_game.cache` | The cache file's bytes, the reload's time and peak memory, and whether the reloaded index answers as the fresh one |
| `mods` | Per corpus mod indexed over the base game: its files, definitions, uses, `replace_path` values, the game files it replaces or hides or makes uncertain, its own files whose read status is unknown, its files not described or not read, the names defined more than once that it takes part in, its times and peak memory |

A definition is a top-level key of a file in a folder the spec lists, a key whose text is a name,
a whole number or an `@constant`, less the top-level forms the package's part D2 confirms declare
no name (`namespace`, settings), and with the nested definitions and file-named records its part
D3 confirms; a use is a word written anywhere else, or a `$name$` in a localization entry
([packages/core/src/index/extract.ts](../packages/core/src/index/extract.ts)).

## Check records (`game:check`, `game:mods`)

`task game:check` (item 4.10) runs every check on the base game's own files and `task
game:mods` on each corpus mod over the base game, both through the core's one runner,
`checkWorkspace`, the code path of the command line's `check`, so a record holds what the
command line reports. Each check runs in a fresh process: `game:check` builds the base game's
index in it; `game:mods` builds the index once into a cache in a temporary folder, deleted after
the run, and checks each mod in a process that loads it. Their `notes` are required and state the
load average before the run. `results` of `game:check`:

| Field | What it states |
| --- | --- |
| `passed`, `failures` | Whether the run passed: every error and warning has a classification, none is a pychivalry fault, and every classification matches a finding |
| `files`, `files_by_layer` | The files checked (the `.txt` and `.yml` files of the folders the spec lists), by layer (`game`, `jomini`, `clausewitz`, `dlc`) |
| `by_severity`, `by_code` | Every finding the run reports, by severity and by code and severity, most first within a severity |
| `errors`, `error_list`, `warnings`, `warning_list` | Every error and every warning: `file` (inside its layer), `layer`, `line` and `column` (from 1), `code`, `message`, and its `classification` (`game-defect`, `spec-package-fault`, `pychivalry-fault` or `unclassified`) with the `reason`, from `tools/data/check-classifications.json` |
| `classified` | How many errors and warnings have each classification |
| `capped` | The per-file cap: `max_per_file`, the `files` it shortened, the findings it `dropped`, and those `dropped_by_code` |
| `scope` | What the scope checks judged: `keyword_uses` (triggers, effects and iterators in trigger and effect blocks), `keyword_uses_known_scope`, `keyword_uses_judged`, `findings`, the uses not judged by why (`unjudged_by_reason`), `link_steps_judged` and `link_findings` |
| `baseline_2_3_0` | Release 2.3.0 on the same game, from `baseline-2.3.0/results-base-game.json`: its errors, how many are at a file and line this run also reports an error at, how many only one of the two reports, and its scope check's `keyword_uses` and `keyword_uses_judged` |
| `time_ms`, `peak_rss_kib` | Listing the files, building the index, checking every file, in all; the process's peak resident memory |

`results` of `game:mods`: `passed`, `failures`, `base_game_cache` (the build's time and peak
memory) and per mod `slug`, `files`, `not_checked` (files in folders the spec does not list, by
folder), `by_severity`, `by_code`, `errors` and `error_list` (each classified, from
`tools/data/mods-classifications.json`: `real-defect`, `spec-package-fault`, `pychivalry-fault` or
`unclassified`, with the reason), `warnings` and `warning_list`, `classified`, `capped`, `scope`,
`baseline_2_3_0` (release 2.3.0's files, counts and errors on the mod from
`baseline-2.3.0/results-mods.json`, compared by file and line; null for a mod it did not run), and
`time_ms` (`load_base`: listing the base game and loading its index from the cache; `check`:
indexing and checking the mod; `total`) with the process's `peak_rss_kib`.

The `style/` family (build step 8, [docs/formatting.md](../docs/formatting.md)) rests on
pychivalry's own formatting rules, not on the game: its findings are counted in `by_severity` and
`by_code` and never listed or classified; `warnings` and `warning_list` are the other warnings,
so `warnings` is `by_severity.warning` less the `style/` warnings.

A run passes when every finding it must classify has an entry, every entry matches a finding,
none is a pychivalry fault, and, for the mods, none is `unclassified`. A failed run still writes
its record, and exits 1.

## Scored records (`scored:agent-use`)

`task scored:agent-use` (build step 6, items 6.8 and 6.10) is a developer's test script, never
run by CI. pychivalry holds no key and makes no model call: the script starts the Claude Code
already installed on the developer's machine once per trial, as a separate test session confined
to pychivalry's agent server plus file read and edit, asks it to fix the planted-defect mod
`fixtures/defects/mod/`, and grades each result in code
([tools/scored-run/README.md](../tools/scored-run/README.md)). Each test session counts against
the developer's own Claude plan, so a run is started only on the owner's word.

Its `game` is the game stub the agent server and the graders read
(`fixtures/game/planted-defects`), not an installed game; its `corpus` is null; its `notes` are
required. **It is not tied to the committed spec**: it states the spec it was made on, and a
later spec does not fail it, because making it again means new test sessions, which start only
on the owner's word. `results`:

| Field | What it states |
| --- | --- |
| `task` | The task: `name` (`agent-use`), the `prompt_file` and its `prompt_sha256`, the `fixture` and its `manifest_sha256`, the `game` stub, the numbers of `defects` and `look_alikes`, and the `graders` |
| `harness` | `name` (`claude-code`) and `version`, from `claude --version` |
| `model` | The model, by its full name |
| `session_limit`, `timeout_minutes` | The session limit each test session was given (`SCORED_SESSION_LIMIT`, at which Claude Code ends the session), and the time limit after which the run stops one |
| `arguments` | Claude Code's arguments, with the prompt file and the agent-server configuration named instead of given |
| `server` | The agent server's `entry` point, from the repository root, and its `arguments` with `<trial mod>` and `<game stub>` |
| `trials` | Per trial: `task`, `trial` (from 1), `passed`, `stopped` (`finished`, `session-limit`, `turns`, `error`, `timeout`, `no-result`), `harness_problems`, the five `graders` each with `passed` and its `problems`, `tool_calls` (per tool: `calls` and `errors`), `tool_errors` (the tool and its text, folders named, no other path), `permission_denials`, `session` (what the session was offered: the harness version, the model, the permission mode, the tools, the agent servers with their status, the skills, and the plugins by their source, of which only Claude Code's own, `<name>@builtin`, may be there; null when the stream had no start), `turns`, `duration_ms`, `exit_code`, and `findings_left` (what the checker still reports, by severity) |
| `tasks` | Per task: `trials`, `passed`, `pass_rate` (passed / trials, to 4 places), and `target`, the owner's target and whether the run met it (decision 82): `run` (`release` for 10 trials or more, else `development`), `needs` (the trials that must pass: all of them) and `met`. A record made before the target was set, item 6.11's, has none |

A trial passes when all five graders pass and it has no harness problem. Nothing from the
session is kept beyond these fields: not its text, not the tools' inputs or results, not its id,
no figure Claude Code reports about the session's use of the developer's plan, nothing about how
Claude Code is signed in.

A record may hold the trials of more than one run: `SCORED_CONTINUE=true` adds a run's trials
to the record already written, numbered after its own, only when that record was made at the
same commit with the same task, Claude Code version, model, session limit, time limit, arguments
and agent server, and a note says which trials each run added. The first record, of item 6.11,
is one session and then four more, made that way.
