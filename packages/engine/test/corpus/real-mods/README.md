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
`<corpus>/<slug>/` without `music/`, and update `MANIFEST.tsv`. The folder name matters: the
mod is checked from `<corpus>/<slug>`, and the slug `viet-events` triggers issue #90.

## Commands

Engine path (writes the `engine` record, keeps the `editor` one; each mod runs in a child
process of its own so its peak RSS is its own; exits 1 if a finding is not classified):

```
npm run build -w packages/engine
node packages/engine/scripts/corpus-acceptance.js /home/cwallace/ck3-corpus "<CK3>/game" [slug ...]
```

Editor path (the integration suite, then one Extension Development Host per mod with the mod as
the workspace folder, `ck3LanguageServer.gamePath` = `CK3_GAME_PATH` and
`backgroundValidation.fileLimit` = 100000; writes the `editor` record and fails if a finding is
not classified or if the editor's own engine errors differ from the engine path outside the
files the provider caps):

```
cd vscode-extension
CK3_CORPUS=/home/cwallace/ck3-corpus CK3_GAME_PATH="<CK3>/game" xvfb-run -a task test:integration
```

`CK3_CORPUS_SLUGS=rice,viet-events` restricts the run. Without `CK3_CORPUS`, or with a folder
that does not exist, the corpus suite is skipped, so CI is unaffected. The record files are
checked by `packages/engine/test/corpus/real-mods.test.ts` (part of `task engine:test`).

## The budget (recorded 2026-10-02)

Linux (WSL2) box, Node 22, VS Code 1.140.0 under xvfb, the game directory on the Windows mount
`/mnt/c` (warm file cache: the first, cold read of the base game took 15.9 s instead of about
3.5 s). Engine path = load + base game + every file, in one process; editor path = activation
to the server's first full background pass (spec package, game data, indexing, base game,
localization, every script and localization file), and the server process's peak RSS
(`process.resourceUsage().maxRSS`, equal to `/proc/<pid>/status` VmHWM in every run).

| Mod | Engine files | Engine ms | Engine peak RSS | Editor files validated | Editor time to first full result | Server peak RSS | Longest script file (editor) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| balance-of-power-ui | 5 | 3,690 | 213 MB | 12 | 3.7 s | 212 MB | 8.2 ms |
| divine-intervention | 80 | 4,679 | 424 MB | 170 | 5.0 s | 368 MB | 194.9 ms |
| elf-destiny | 553 | 4,931 | 507 MB | 906 | 9.5 s | 353 MB | 50.0 ms |
| rice | 1,313 | 7,918 | 884 MB | 2,090 | 92.7 s | 687 MB | 67.7 ms |
| viet-events | 67 | 4,548 | 404 MB | 211 | 8.4 s | 437 MB | 119.1 ms |

The exit criterion is measured against RICE: first full result in 92.7 s at 687 MB server
peak RSS (an earlier run of the same build: 96.8 s, 691 MB). RICE's pass is dominated by its
777 localization files: the localization validator took up to 4,561 ms on one file
(`localization/polish/rice_north_atlantic_l_polish.yml`; 8,954 ms on an earlier run), which is
the longest single-file diagnosis, and so the longest the server's event loop is held by
background validation; the longest script file took 67.7 ms. RICE has 2,090 validatable files,
above the default `backgroundValidation.fileLimit` of 2000, so by default only its open files
are validated until the user runs **CK3: Validate Workspace** or raises the limit.

**The 1000-per-file cap.** The diagnostics provider publishes at most 1000 diagnostics per file
(sorted by position), and with the plug-ins several big files reach it (14 files in Divine
Intervention, 22 in Elf Destiny, 25 in RICE, 5 in VIET Events: `filesAtCap`). Outside those
files the editor's `ck3-engine` error findings are identical, file, line and code, to the engine
path's (asserted by the corpus suite); in VIET Events the capped files hold 1,217 of the engine
path's errors, which is why the editor shows 1,090 engine errors there instead of 1,751.
