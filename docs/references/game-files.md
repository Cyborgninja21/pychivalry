# Reference: the game's own files

What ships in the game folder that pychivalry or the spec derivation uses. Counts were taken on
game 1.21.0.3 on 2026-11-21. Game files are never committed here.

## Script, GUI and localization files

| What | Count | Used for |
| --- | --- | --- |
| Script files in the three folders release 2.3.0 covered | 4,482 | The base-game parse and check suites |
| GUI files | 441, using about 2,000 distinct block names | A measured GUI vocabulary, collected by the 1.21 spec work |
| Localization files | 12,171 | Read at run time for names and descriptions, modifiers in particular |

What these files show is measured use. A field every base-game record sets is "usually
present"; it is not evidence that the game requires it.

## Paradox's documentation files

The game folders hold 214 `.info` files. Each describes the records of its folder field by
field, with value types, the scope a block receives, and defaults. They are the best source for
value types, descriptions and scopes below the executable and the game's own output, and rank
above the wiki. They can lag the code: where one disagrees with the executable or a dump, the
higher source wins.

Open, for the owner: whether the spec package may carry the text of these files' comments, or
only the facts taken from them.

## The command-line options file

`_commandline_options.info` in the game folder documents the game's start-up options. The ones
that matter here:

| Option | What it does | Used by |
| --- | --- | --- |
| `-run_console_action_main=<console command>` | Runs a console command at start-up | The documentation dumps of the spec work; the in-game load test of build step 11 |
| `-continuelastsave` | Starts straight into the last save | The in-game load test |
| `-debug_mode` | Starts in debug mode | The in-game load test; it changes what the error log holds |
| `-skip` | Skips the intro | The in-game load test |
| `-suppress_error_log` | Stops the error log being written | Noted so a harness never sets it |

Whether the first of these produces the documentation dumps unattended is open question 8 of
MVP.md, settled by the spec work.

## Load-path settings

`paths.settings` and `paths_checksummed.settings` in the game folder name the folders some
systems load (`gfx/map/borders`, `music/music_player_categories`, `map_data` and so on). They
say nothing about overriding or load order: build step 3 read them for that and found nothing
([overrides.md](../overrides.md)).

## The install's folders

Checked 2026-11-21 on game 1.21.0.3. The install folder holds three folders in the same layout:
`game/` (the folder `CK3_GAME_PATH` names), `jomini/` (500 files) and `clausewitz/` (603 files).
`jomini/` holds script and localization the game folder does not, such as six files of
`common/defines/jomini/`; 56 of its files, and 18 of `clausewitz/`'s, also exist at the same
relative path under `game/`, almost always changed. How the game ranks the three is rule 3 of
[overrides.md](../overrides.md).

Each DLC is a folder `game/dlc/<pack>/` with a descriptor `<pack>.dlc` (`name`, `path`,
`steam_id`, `affects_checksum`, `checksum` and others), whose `path` names that folder. On
1.21.0.3 the 23 packs hold files only under `gfx/`, `music/` and `sound/`, besides the
descriptor and a thumbnail.

## The game's checksum manifest

`checksum_manifest.txt` names the folders the game itself treats as content when it computes
its checksum. The records hash file content only for those folders and list every other file by
size ([records/README.md](../../records/README.md)).

## The Linux executable

The Linux build of the game keeps its class names, about 6,100 of which name triggers or
effects. It is a second binary to cross-check derived names against.

It also keeps message texts the spec's catalogue does not carry, each near the path of the
source file that holds it. Build step 3 read them with `strings` on 2026-11-21 (game 1.21.0.3)
for the override rules: the generic database's `Overriding entry '{}' for database '{}' in
'{}'`, the localization reader's duplicate-key messages and its `/replace/` folder, and the
descriptor key `replace_path`. They are quoted in [overrides.md](../overrides.md#the-evidence).
A message text shows the game has the behaviour it reports, not when the message fires.

## Workshop mods

Each mod carries a `descriptor.mod` with its name, its workshop id (`remote_file_id`) and the
game version it supports. The corpus manifest is built from those
([records/corpus/README.md](../../records/corpus/README.md)). None of the five uses
`replace_path` (checked 2026-11-21).
