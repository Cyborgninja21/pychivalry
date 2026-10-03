# Real-mod corpus records

Acceptance records of pychivalry on five published CK3 mods (post-2.0 Phase 1, step 1.5). One
file per mod, `<slug>.counts.json`, with two records of the same shape:

- `engine`: the engine alone (no plug-ins) over every script file of the mod, with the
  1.20.0.2 game directory as the base game: the CLI's `check <mod> --vanilla <game>`.
- `editor`: what the Extension Development Host shows once background validation has
  finished its first full pass, read from `vscode.languages.getDiagnostics()` and restricted to
  the sources `ck3-engine` and `ck3-plugin` (localization validator findings,
  `ck3-localization`, are not counted).

Each record has `mod` (slug, workshop id, name, supported version), the spec package version
and sha256 (engine), the command, the file count, the timing, the peak memory, the longest
single-file diagnosis, `bySeverity`, `counts` (`"<code>": { severity, count }`) and `errors`:
every error-severity finding (file relative to the mod, 1-based line, code, message) with its
classification (`real-defect` or `false-positive` with the GitHub issue), from
[`classifications.json`](classifications.json), explained in [FINDINGS.md](FINDINGS.md).

## The corpus

Never committed. Five Steam Workshop mods copied on 2026-10-02 from the local workshop cache
(app 1158310) with `music/` excluded, one folder per slug, plus `MANIFEST.tsv`
(slug, workshop id, name, supported version, file counts). On the box the records were made on
it lives at `/home/cwallace/ck3-corpus/`.

| Slug | Workshop id | Name | Supported version | Script files |
| --- | --- | --- | --- | --- |
| `balance-of-power-ui` | 3157042775 | Balance of Power UI | 1.\*.\* | 5 (+ `gui/`) |
| `divine-intervention` | 2986538297 | Divine Intervention Cheat Menu | 1.20.0.2 | 80 |
| `elf-destiny` | 3114064450 | Elf Destiny (total conversion) | 1.20.\* | 553 |
| `rice` | 2273832430 | Regional Immersion and Cultural Enrichment (RICE) | 1.19.\* | 1,313 |
| `viet-events` | 2227658180 | VIET Events - A Flavor and Immersion Event Mod | 1.19.\* | 67 |

RICE and VIET Events declare 1.19: findings on names retired or renamed in 1.20 are real
defects against 1.20.0.2, not false positives.

**Refreshing it.** `steamcmd +login <user> +workshop_download_item 1158310 <id> +quit` (or copy
`steamapps/workshop/content/1158310/<id>` from a Steam install that is subscribed), into
`<corpus>/<slug>/` without `music/`, and update `MANIFEST.tsv`. (Before the fix of issue #90
the folder name mattered: the slug `viet-events` turned every file of that mod into an event
file. Files are now classified by their path inside the mod.)

## Commands

Engine path (writes the `engine` record, keeps the `editor` one; each mod runs in a child
process of its own so its peak RSS is its own; exits 1 if a finding is not classified):

```
npm run build -w packages/engine
node packages/engine/scripts/corpus-acceptance.js /home/cwallace/ck3-corpus "<CK3>/game" [slug ...]
```

Editor path (the integration suite, then one Extension Development Host per mod with the mod as
the workspace folder, `ck3LanguageServer.gamePath` = `CK3_GAME_PATH` and every other setting
at its shipped default; writes the `editor` record and fails if a finding is not classified or
if the editor's own engine errors differ from the engine path outside the files the provider
caps):

```
cd vscode-extension
CK3_CORPUS=/home/cwallace/ck3-corpus CK3_GAME_PATH="<CK3>/game" xvfb-run -a task test:integration
```

When launched from a VS Code terminal, run the integration and corpus suites with
`ELECTRON_RUN_AS_NODE` and every `VSCODE_*` variable unset (for example
`env -u ELECTRON_RUN_AS_NODE $(env | grep -oE '^VSCODE_[A-Z_]+' | sed 's/^/-u /') xvfb-run -a task test:integration`);
otherwise the downloaded VS Code runs as Node and fails with "Cannot find module
.../test-workspace". `CK3_CORPUS_SLUGS=rice,viet-events` restricts the run. Without `CK3_CORPUS`, or with a folder
that does not exist, the corpus suite is skipped, so CI is unaffected. The record files are
checked by `packages/engine/test/corpus/real-mods.test.ts` (part of `task engine:test`).

## The budget (recorded 2026-10-02)

Linux (WSL2) box, Node 22, VS Code 1.140.0 under xvfb, the game directory on the Windows mount
`/mnt/c` (warm file cache: the first, cold read of the base game took 15.9 s instead of about
3.5 s). Engine path = load + base game + every file, in one process; editor path = activation
to the server's first full background pass (spec package, game data, indexing, base game,
localization, every script and localization file) under the shipped defaults
(`backgroundValidation.fileLimit` 3000), and the server process's peak RSS
(`process.resourceUsage().maxRSS`, equal to `/proc/<pid>/status` VmHWM in every run). The two
longest columns are the longest single-file diagnosis of a script and of a localization file
in the editor (from the server's idle event): the longest the background pass holds the
server's event loop.

| Mod | Engine files | Engine ms | Engine peak RSS | Editor files validated | Editor time to first full result | Server peak RSS | Longest script file | Longest localization file |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| balance-of-power-ui | 5 | 3,907 | 205 MB | 12 | 4.2 s | 213 MB | 7.7 ms | 0.3 ms |
| divine-intervention | 80 | 4,513 | 428 MB | 170 | 4.9 s | 372 MB | 197.3 ms | 1.3 ms |
| elf-destiny | 553 | 5,034 | 446 MB | 906 | 10.0 s | 309 MB | 53.6 ms | 258.6 ms |
| rice | 1,313 | 8,255 | 884 MB | 2,090 | 20.6 s | 704 MB | 71.9 ms | 172.2 ms |
| viet-events | 67 | 4,582 | 397 MB | 211 | 12.3 s | 363 MB | 141.8 ms | 7.6 ms |

The exit criterion is measured against RICE: first full result in 20.6 s at 704 MB server peak
RSS, with every one of its 2,090 files validated under the default limit; no file took longer
than 172.3 ms. Before the localization validator's suggestion work was bounded, the same pass
took 92.7 s and one file (`localization/polish/rice_north_atlantic_l_polish.yml`, 1,962
findings) took 4.6 to 9.0 s; measured alone, that file's diagnosis went from 6,883 ms to 104 ms.

**Re-recorded for 2.1 (scope check).** The records now in this folder were made with the 2.1
engine on the same box later the same day, when it was markedly slower: the 2.0 engine
(`2cc5efa`), re-measured back to back on the vanilla files, took 75.8 s and 78.5 s for the checks
that the budget run above measured at 27.2 s. Against that control the 2.1 engine took 82.4 s
(the scope check shares the registry's block reading; about 6 to 8 % more), and the corpus
timings in the records scale the same way (RICE first full result 58.1 s). Counts per code and
errors are identical to the Phase 1 records on both paths.

**Re-recorded for the graphics check (Phase 3).** The `editor` records were made again on
2026-10-03 with the `graphics` plug-in (GFX001); counts per code, `bySeverity` and every error
are identical to the 2.1 records except RICE's 3 `GFX001` warnings (classified in
[FINDINGS.md](FINDINGS.md)); only the timing fields differ otherwise.

**Re-recorded for 2.2 (Phase 4, the evidence audit).** The `editor` records were made again on
2026-10-03 after each step of Phase 4 that changes what the plug-ins report; the `engine`
records are unchanged. The error-severity editor findings are now exactly the engine path's
real defects, and the changes per code are explained in [FINDINGS.md](FINDINGS.md) and in the
audit table of `Documentation/developer-guide/diagnostics-evidence.md`.

**The 1000-per-file cap.** The diagnostics provider publishes at most 1000 diagnostics per file
(sorted by position), and with the plug-ins several big files reach it (14 files in Divine
Intervention, 22 in Elf Destiny, 25 in RICE, 4 in VIET Events: `filesAtCap`). Outside those
files the editor's `ck3-engine` error findings are identical, file, line and code, to the engine
path's (asserted by the corpus suite).
