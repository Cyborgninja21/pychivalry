# Reference: the game's logs

The sources of build step 11 ([docs/game-log.md](../game-log.md)): what is known about the game's
logs before one has been captured, and where each fact comes from. Checked 2026-11-27. **No real
`error.log` has been read by this project**; the facts below are each source's own, and
docs/game-log.md says how far each reaches.

| Source | What it gives | How sure | May be copied |
| --- | --- | --- | --- |
| The spec package's error catalogue (part A4) | 2,671 message texts of the executable, their placeholders, a script-facing mark, a subject and the reason (`script_position`: the message gives a place in a script file) | As the package; see [spec-package.md](spec-package.md) | Through the spec package only |
| `pdx-parser-re`, `research/oracle/1.21.0.3/README.md` and `run-record.txt` | The spec work's two launches of the base game on the analysis machine, 2026-11-21: how the game was started (directly, with `-debug_mode` and a start-up console command, through a scheduled task in the logged-on user's session), how the mod list was set and restored through `dlc_load.json`, the logs folder under Documents and its 25 files, each log's size before and after, and the first line of each log a launch changed, cut short | Seen, on one machine, for the base game alone | Facts only: the procedure, the folder's place, sizes, the form of a line. No log text |
| `pdx-parser-re`, `research/oracle/1.20.0.2/README.md` | The earlier launch: the main menu taken as reached when `debug.log`, `error.log` and `game.log` were unchanged for 30 seconds | Seen, once | Facts only |
| `pdx-parser-re`, `research/overrides/1.21.0.3/windows/FINDINGS.md` | The executable's log set-up: `error.log` registered for log categories 1, `0x10000` and `0x1000a`, `debug.log` for 2; the "Overriding entry" line in a category with no file | Read in the Windows executable | Facts only |
| Valve's Proton FAQ (`github.com/ValveSoftware/Proton/wiki/Proton-FAQ`) | A game's Proton prefix is in the game's own Steam library, `steamapps/compatdata/<app id>/pfx/` | Valve's documentation, read 2026-11-27 | Facts only |
| Proton's prefix layout (Proton itself; community guides) | The Windows user inside a prefix is `steamuser`, its Documents `drive_c/users/steamuser/Documents` (`My Documents` in older prefixes) | Convention, not seen with this game | Facts only |
| Windows' shell folders | The user's Documents folder is the `Personal` value of `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders`, which follows a move to OneDrive; OneDrive names its folders in `OneDrive`, `OneDriveConsumer` and `OneDriveCommercial` | Windows' and OneDrive's own behaviour, not seen with the game | Facts only |
| Release 2.3.0's log analyser (`legacy/`) | What not to repeat: 14 patterns written by hand and a guessed `at <file>:<line>` place, tested on one hand-written 16-line log | Guessed; never tested on a real log | Nothing; read only |

## What the launch record shows of a line

The first line of each log a launch changed has the form `[<time>][<level>][<source file>:<line>]:
<message>`, a time of day, a one-letter level (`E`, `W`, `D`, `I` were seen), the executable's own
source file and line, then the message; `game.log` writes a category in brackets before the level.
One line of each log, from one launch, each cut by the record: a form those lines had, not a rule
for every line. The matcher holds no prefix for it (docs/game-log.md).
