# Capturing the game's logs, and the in-game load

The procedure for build step 11's captures (item 11.1 of [PLAN.md](PLAN.md)) and for the
authoring run's third grade, the in-game load (item 11.8), with the tooling that runs them.
**Prepared, not run.** Both launch the game, which happens only on the analysis machine and only
on the owner's word (AGENTS.md, rule 9); the owner has not given it for step 11 (decision 194).
The tooling refuses to start without it, and its tests run a stand-in, never the game.

The procedure is the one the spec work used for its documentation dumps (`pdx-parser-re`,
`research/oracle/1.21.0.3/README.md`, which launched the game twice on the analysis machine on
2026-11-21), adapted to a mod list and to keeping the logs.

## The guard

Every command here reads the variable `PYCHIVALRY_OWNERS_WORD` before anything else: it must be
`decision <n>`, and row `<n>` of [decisions.md](decisions.md) must be a decision of the area
`Game launch` whose text opens with "On the owner's word" and holds the words the guard asks for
(`LAUNCH_WORDS` in `tools/src/game-log/guard.ts`: his word for a launch of the game, on the
analysis machine). No variable, a value of another form, a number with no row, a row of another
area or one that only describes the guard (decisions 194 and 199 among them), and the command
stops with exit code 2 before it reads a folder, writes a file or starts a program. Recording the word is the owner's, or done on his word, as for
every decision.

## Before a launch

On the analysis machine, as the spec work's launches had it:

1. The owner's word is recorded (above), for the launches named.
2. Steam is running and signed in; the desktop session is unlocked by the owner (no agent types a
   password); the machine is kept awake for the run.
3. The game build is the spec package's (1.21.0.3): the capture records the launcher's
   `rawVersion` and the executable's SHA-256, and a capture of another build is not compared with
   one of this.
4. The repository is checked out there and built (`task build`), with Node 22. *Whether Node is
   installed on the analysis machine is not known here; the spec work drove its launches with
   PowerShell.*
5. The launch runs in the logged-on user's desktop session, as the spec work's did: started over
   SSH through a one-shot scheduled task with interactive logon, so the game opens its window on
   that desktop.

## One capture

`task game:capture-log` (`tools/src/game-log/capture.ts`), every folder named, none assumed:

| Variable | Meaning |
| --- | --- |
| `PYCHIVALRY_OWNERS_WORD` | The guard, above |
| `CK3_INSTALL_PATH` | The game's install folder, holding `binaries/` and `launcher/` |
| `CK3_USER_PATH` | The user's game folder, holding `dlc_load.json`, `logs/` and `mod/` |
| `CAPTURE_MODS` | The mod folders to load, comma-separated, in order; empty for the base game alone |
| `CAPTURE_OPTIONS` | The launch options, space-separated: `-debug_mode` or none |
| `CAPTURE_OUT` | A new folder for the logs kept and the record |

1. **The mod list.** `dlc_load.json` is backed up byte for byte, with its time. Each mod gets a
   descriptor of its own in the user's `mod/` folder, `pychivalry_capture_<n>.mod`, whose `path`
   is the mod's folder; a file of that name already there stops the capture, unchanged.
   `enabled_mods` is set to those descriptors, the file's other keys kept.
2. **The launch.** `binaries/ck3.exe` (`binaries/ck3` elsewhere) started directly with the options,
   not through the launcher.
3. **The main menu** is taken as reached when the logs go quiet: none of `error.log`, `debug.log`
   and `game.log` changes for 30 seconds after the first change since the launch, the measure of
   the spec work's 1.20.0.2 launch. The game ending by itself ends the wait too. After 480 seconds
   the capture stops and records that it timed out.
4. **The game is stopped**, and every log it wrote or changed since the launch is copied out, each
   folder of the machine in it written as a placeholder (`<user dir>`, `<game dir>`, `<mod n>`,
   `<home>`), so that what is kept may be committed: no home folder, no absolute path (AGENTS.md).
5. **The mod list is put back**, whatever happened: the descriptors removed, `dlc_load.json`
   written back with its time, its SHA-256 compared with the original's. A capture whose list is
   not byte for byte the original fails.
6. **The record**, `capture.json`: the owner's decision, the game build, the executable's SHA-256,
   the options, the mods by name, how the wait ended and after how long, the exit code, each log's
   size, SHA-256 and lines, and the mod list restored. It names no folder of the machine.

## The captures of item 11.1

Each a capture as above, kept under `fixtures/logs/captured/<name>/` with its record:

| Name | Mods | Options | For |
| --- | --- | --- | --- |
| `base-game` | none | `-debug_mode` | The base game's own lines: what every other capture is read against |
| `base-game-no-debug` | none | none | What debug mode adds (MVP.md, open question 3) |
| `planted-defects` | the planted-defect mod, `fixtures/defects/mod/` | `-debug_mode` | Which of its 37 planted defects the game reports at load, at which line, in which message (item 11.5, open question 2) |
| `corpus-<slug>` | each of the five test mods of the corpus, one capture each | `-debug_mode` | Real mods' messages, matched and tied, the unmatched counted |

Then docs/game-log.md is written again from them (item 11.2): every question of its list
"What only a capture can settle" answered from what the logs show, and the matcher's line prefix
and place format set if the logs show one. "Done when" 1 of step 11 is read off the captures:
every message tied to a file and line or listed as unmatched, the unmatched count on record.

## The in-game load

The authoring run's third grade (MVP.md, "AI first": "loads in the game"),
`task scored:in-game-load` (`tools/src/game-log/in-game-load.ts`), for one result the authoring run
kept (`SCORED_KEEP`):

| Variable | Meaning |
| --- | --- |
| `PYCHIVALRY_OWNERS_WORD`, `CK3_INSTALL_PATH`, `CK3_USER_PATH`, `CAPTURE_OPTIONS`, `CAPTURE_OUT` | As for one capture |
| `SCORED_BASE` | The result's base mod (`fixtures/requests/base/<base>/`) |
| `SCORED_RESULT` | The result: the trial's mod folder as the run kept it |

1. The guard, then a capture of the base mod alone (`without/`), then of the result (`with/`):
   the same build, the same options.
2. **The content's files**: the result's files that are new or changed against its base mod.
3. **The grade holds when the result's `error.log` adds no line that names one of them**: for each
   file, the lines of the result's log naming it (its path inside the mod, either separator, any
   letter case) less the lines of the base mod's log naming it. A file at a path the base mod or
   the base game also has is named in both, and only the lines more count.
4. Each added line is read against the catalogue, to say which message it is.

What the grade proves is "no new error at load that names the content's files". Whether the game
reports at load a defect in content that never runs is what the planted-defect capture shows
(item 11.5); the measure is named for that answer when it is in. The grade is not yet written into
the authoring record: its place there (a third measure beside validity and the match to the
request) is set when the first in-game load has been run on the owner's word, so that its record
shape rests on a real run ("Done when" 3 of step 11).

## Tested on a stand-in only

`tools/src/game-log/capture.test.ts` runs the whole procedure on a stand-in for the game
(`stand-in-game.ts`: a script that reads the mod list it was given and writes logs from catalogue
templates), in a temporary user folder: the guard refusing before anything is touched, a capture
ending on quiet logs and one ending by itself, the mod list put back byte for byte with its time,
no descriptor left, a descriptor of the same name refused, the logs kept naming no folder of the
machine, and the in-game load failing a result whose log names its file and passing one whose log
does not. Both commands are refused through the tools' own command line without the owner's word.
