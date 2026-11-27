# Capturing the game's logs, and the in-game load

The procedure for build step 11's captures (item 11.1 of [PLAN.md](PLAN.md)) and for the
authoring run's third grade, the in-game load (item 11.8), with the tooling that runs them.
Both launch the game, which happens only on the analysis machine and only on the owner's word
(AGENTS.md, rule 9). **The owner has given it for the eight captures of item 11.1** (decision 200,
2026-11-27), and for nothing else: **not for the in-game load of item 11.8**, which waits on a word
of its own. None has been run yet. The tooling refuses to start without a recorded word, and its
tests run a stand-in, never the game.

The procedure is the one the spec work used for its documentation dumps (`pdx-parser-re`,
`research/oracle/1.21.0.3/README.md`, which launched the game twice on the analysis machine on
2026-11-21), adapted to a mod list and to keeping the logs.

## The guard

Every command here reads the variable `PYCHIVALRY_OWNERS_WORD` before anything else: it must be
`decision <n>`, and row `<n>` of [decisions.md](decisions.md) must be a decision of the area
`Game launch` whose text opens with "On the owner's word", holds the words the guard asks for
(`LAUNCH_WORDS` in `tools/src/game-log/guard.ts`: his word for a launch of the game, on the
analysis machine), and **names the command being started**, its task with the variable set to that
very row: `task game:capture-log` with `PYCHIVALRY_OWNERS_WORD=decision <n>`, or the same for
`task scored:in-game-load` (`launchNaming`; decision 205). A row that mentions a command only to
leave it out, or names it with another row's number, does not let it start. No variable, a value
of another form, a number with no row, a row of another area or one that only describes the guard
(decisions 194 and 199 among them), a row that does not name the command, and the command stops
with exit code 2 before it reads a folder, writes a file or starts a program. Recording the
word is the owner's, or done on his word, as for every decision.

**Decision 200** is that word for the eight captures below: `PYCHIVALRY_OWNERS_WORD=decision 200`,
which names `task game:capture-log`. Tests hold that the guard accepts it for that command and
refuses it for `task scored:in-game-load`, that it names the eight captures
and leaves out item 11.8, that it is the only row of the page that starts the capture and that no
row starts the in-game load, and that decisions 194 and 199 are refused for both
(`capture.test.ts`, through the tools' command line too). Each capture record names the decision
and the command it ran for (`owners_word`).

**The guard does not count launches** (decision 205): nothing durable that every launch sees
records them where it runs (each record goes to a new `CAPTURE_OUT` folder, and reaches the
repository only after the check below, if at all), a count in the user's game folder would leave a
file of pychivalry's there, and a count does not say which capture is which. The agent running the
captures makes each of the eight once; the committed records show afterwards what ran.

## Before a launch

On the analysis machine, as the spec work's launches had it:

1. The owner's word is recorded (above), for the launches named.
2. Steam is running and signed in; the desktop session is unlocked by the owner (no agent types a
   password); the machine is kept awake for the run.
3. The game build is the spec package's (1.21.0.3): the capture records the launcher's
   `rawVersion` and the executable's SHA-256, and a capture of another build is not compared with
   one of this.
4. The repository is checked out there and built (`task build`), with Node 22: the tooling runs
   with Node (decision 201). *Whether Node is installed on the analysis machine is not known
   here; the spec work drove its launches with PowerShell.* If it is not installed, the agent
   coordinating the work comes back to the owner before any capture, and no agent installs it
   there on its own; nothing of the tooling is rewritten for PowerShell.
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
   How many times each placeholder was written in each log is counted, printed when the capture
   ends, and kept in the record (`scrub` in `capture.ts`).
5. **The mod list is put back**, whatever happened: the descriptors removed, `dlc_load.json`
   written back with its time, its SHA-256 compared with the original's. A capture whose list is
   not byte for byte the original fails.
6. **The record**, `capture.json` (`capture_format` 2): the owner's decision, the game build, the
   executable's SHA-256, the options, the mods by name, how the wait ended and after how long, the
   exit code, each log's size, SHA-256 and lines as kept, what was replaced in it (`replaced`: each
   placeholder of a folder given, with its count, 0 when never written), and the mod list
   restored. It names no folder of the machine.

## The captures of item 11.1

The eight launches decision 200 gives the owner's word for, each a capture as above, kept under
`fixtures/logs/captured/<name>/` with its record once it has passed the check below:

| Name | Mods | Options | For |
| --- | --- | --- | --- |
| `base-game` | none | `-debug_mode` | The base game's own lines: what every other capture is read against |
| `base-game-no-debug` | none | none | What debug mode adds (MVP.md, open question 3) |
| `planted-defects` | the planted-defect mod, `fixtures/defects/mod/` | `-debug_mode` | Which of its 37 planted defects the game reports at load, at which line, in which message (item 11.5, open question 2) |
| `corpus-<slug>` | each of the five test mods of the corpus, one capture each | `-debug_mode` | Real mods' messages, matched and tied, the unmatched counted |

## Before the logs are committed

On the owner's word (decision 202), the logs a capture keeps may be committed to this public
repository as test fixtures, in `fixtures/logs/captured/<name>/` beside their `capture.json`, **after
a check of each file for names and paths** by the agent that commits them. The scrubber writes as a
placeholder only the folders it was given; this check is what finds anything else.

1. **Start from what the scrubber replaced.** `task game:capture-log` prints, and `capture.json`
   holds (`replaced` of each log), each placeholder with the number of times it was written in each
   log. They say which logs named the machine's folders, and so which to read most closely. A
   count of 0 is no proof that a log names nothing of the machine.
2. **Search every file kept**, each log and `capture.json`, in any letter case, and look at every
   hit:
   - a path of the machine left: a drive letter and a separator (`C:\`, `c:/`), a network path (two
     backslashes and a name), a user's or home folder (`Users` and a separator, `/home/`,
     `AppData`, `OneDrive`), a short folder name (`~1`);
   - the user name the game ran under, the machine's own name, the Steam name the game ran under,
     and its 17-digit Steam ID (it starts `7656119`);
   - an e-mail address.

   The names of the second point are given to the search on its command line on the machine, and
   never written into a file of the repository, a commit message or a pull request.
3. **What a hit means.** A hit that is the game's own text (a catalogue message, a path inside the
   game's folders after `<game dir>`) may stay, and the pull request says which hits were the
   game's. Any other hit, and the file is **not committed**, nor edited by hand to take the hit out
   (the record holds the SHA-256 of the file the capture kept): it is left out, and the agent
   coordinating the work comes back to the owner.
4. **The bytes as kept.** Each log's SHA-256 in the repository is compared with its record before
   the commit; `fixtures/logs/** -text` in `.gitattributes` keeps their line breaks.

The first and third points' search, with GNU `grep` (Git for Windows' shell has it), the names of
the second point in place of the three placeholders:

```sh
grep -rniE '\b[a-z]:[\\/]|\\\\[a-z0-9]|users[\\/]|/home/|appdata|onedrive|~1|7656119[0-9]{10}|[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]' fixtures/logs/captured/<name>/
grep -rniF -e '<user name>' -e '<machine name>' -e '<Steam name>' fixtures/logs/captured/<name>/
```

## What the captures answer

Then docs/game-log.md is written again from them (item 11.2): every question of its list
"What only a capture can settle" answered from what the logs show, and the matcher's line prefix
and place format set if the logs show one. "Done when" 1 of step 11 is read off the captures:
every message tied to a file and line or listed as unmatched, the unmatched count on record.

## The in-game load

The authoring run's third grade (MVP.md, "AI first": "loads in the game"),
`task scored:in-game-load` (`tools/src/game-log/in-game-load.ts`), for one result the authoring run
kept (`SCORED_KEEP`). **Decision 200 does not cover it**: it runs only on a row of its own that
records the owner's word for it.

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
machine and each log's count of what was replaced, and the in-game load failing a result whose log
names its file and passing one whose log does not. Both commands are refused through the tools' own
command line without the owner's word for them, the guard accepts decision 200, the one row of the
repository's page that records it, for the capture alone, refuses it for the in-game load, and
still refuses decisions 194 and 199 for both.
