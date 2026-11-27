# The game's log

How pychivalry reads the game's own error log and ties its messages to a mod's files (build
step 11 of [PLAN.md](PLAN.md)), what is known about the log without having captured one, and what
only a real capture can settle.

**No real log has been read.** Step 11 started on the owner's word without launching the game
([decisions.md](decisions.md), decision 194): no capture has been made on the analysis machine.
His word for the eight captures of item 11.1 was given on 2026-11-27 (decision 200), and none is
made yet. Everything below that is about the log itself rests on the
evidence named beside it; what rests on none is in [What only a capture can settle](#what-only-a-capture-can-settle).
**The matcher has not seen a real log.** It was built on the spec package's catalogue of the
game's messages and tested on hand-made logs written from that catalogue
([fixtures/logs/](../fixtures/logs/README.md)).

## What is known without a capture

| What | Known from | How sure |
| --- | --- | --- |
| **Where the logs are on Windows**: `Paradox Interactive/Crusader Kings III/logs` in the user's Documents folder, holding `error.log`, `debug.log`, `game.log`, `system.log`, `setup.log` and about twenty more | The spec work's launch record on the analysis machine (`pdx-parser-re`, `research/oracle/1.21.0.3/run-record.txt`), which lists that folder and its 25 files before and after a launch | Seen, on one machine |
| **Where they are elsewhere**: Linux `~/.local/share/Paradox Interactive/Crusader Kings III/logs`; the Windows folder inside the game's Proton prefix; Documents moved to OneDrive | [PLAN.md](PLAN.md) item 11.7 for Linux; Valve's Proton FAQ for the prefix (`steamapps/compatdata/<app id>/pfx/`, in the game's own Steam library), the prefix's Windows user `steamuser`; Windows' own shell-folder setting for OneDrive | Documented conventions, not seen with the game ([Where the logs are](#where-the-logs-are)) |
| **What writes `error.log`**: the game's log set-up registers `error.log` for its log categories 1, `0x10000` and `0x1000a`, and `debug.log` for category 2 | The spec work's reading of the Windows executable (`pdx-parser-re`, `research/overrides/1.21.0.3/windows/FINDINGS.md`, the function that sets up the log categories) | Read in the executable. The "Overriding entry" line of the override rules goes to a category no file is registered for: whether it reaches `error.log` is not shown |
| **The messages**: 2,671 message texts taken from the executable, each a format string whose placeholders are printf conversions (`%s`, `%d`, `%.*s`, `%I64d`) and the `{}` of the game's newer formatting; each marked script-facing or not, with a finer subject (35 values) and the rule that decided | The spec package's error catalogue, part A4 ([references/spec-package.md](references/spec-package.md)) | As the package says; 971 entries' script-facing mark is `unknown`, and nothing says which source file of the executable writes which message |
| **How much the base game alone writes**: 42,365 and 29,701 bytes of `error.log` after two launches of the base game | The same launch record | Two launches, no mod |
| **The shape of a line**, from one line of each log: a time in brackets, a one-letter level in brackets, the executable's source file and line in brackets, a colon and a space, then the message, `[<time>][<level>][<source file>:<line>]: <message>`; `game.log` has one bracket more, a category, before the level | The same launch record, which notes the first line of each log a launch changed, cut short | One line of each log, from one launch of the base game, cut by the record: the form of those lines, not of every line. **No prefix is built into the matcher** for it |
| **When the log is cleared**: after the second launch `error.log` had a new time and the same 29,701 bytes as after the first, and the first launch had left it smaller than it was before | The same launch record | It suggests the log is written anew at each start; a capture settles it |

## What only a capture can settle

Each of these is an open question until a real log is read (MVP.md, open question 3). The matcher
assumes none of them: where it would need one, it takes it from the user or says what it could
not do.

1. **The line prefix.** Whether every line has the bracketed form, what each level letter means,
   and whether a line that continues a message has a prefix too. Until then the matcher finds
   each message wherever it starts on its line; a prefix can be given as a pattern (`--prefix`,
   `line_prefix`, `pychivalry.log.linePrefix`).
2. **One line or several per message.** Three templates of the catalogue hold a newline and are
   matched over as many lines; whether other messages are followed by lines of their own (a
   stack, a piece of script) is not known. Such lines are listed as unmatched, never folded into
   the message before them.
3. **When the log is cleared**: at each start, or only sometimes (see above).
4. **What debug mode adds.** Both of the spec work's launches ran with `-debug_mode`; no log of a
   launch without it has been read.
5. **How a place in a script file is written** in the messages that give one (`at {}`, 278 of
   the catalogue's entries, by the package's reason `script_position`): which separator, which
   folder the path starts from, whether a line and a column follow, and how. Until then such a
   message is tied to the file whose path it holds, the line not known; a place format can be
   given as a pattern (`--location`, `location`, `pychivalry.log.location`).
6. **What a line number counts from.** A message whose own text says `line %d` gives a line,
   taken as counted from 1, the usual; a capture of a planted defect at a known line settles it.
7. **Which message the game writes for which defect, and which defects it reports at load at
   all** (MVP.md, open question 2; PLAN.md item 11.5). This is what the planted-defect capture is
   for.
8. **The log's encoding.** A line that is not valid UTF-8 is read as Windows-1252 and counted (the
   game's own documentation logs were found to hold a byte of it); whether `error.log` holds any
   is not known.
9. **Whether a message is written once or each time**, and in what order the game writes them.

## How a log is read

`packages/core/src/log/`, one reading for every surface:

- **The templates.** Each catalogue entry is a template: its fixed text, and a value for each
  placeholder. What a printf placeholder may print is fixed by the C standard (`%d` a whole number,
  `%x` hexadecimal digits, `%f` a decimal number, `%c` one character, `%s` any text); `{}` may print
  any text. A template's leading and trailing whitespace is not matched.
- **What a value stands for**, read from the message's own words: a whole number after `line` is a
  line, after `column` or `col` a column; a whole number after `<value>:` is the line of the file
  that value names. Every other value is text.
- **Which templates are matched.** Not the 520 the package marks as no message at all, and not the
  43 whose fixed text holds fewer than two words of three letters or more (`ERROR: %s`, ` errors`):
  both kinds are listed below.
- **No prefix assumed.** A template matches the end of a line, its message starting anywhere in
  it; what comes before is kept as it is (`before`). A template that starts with a text value
  then takes in the line's prefix too, and the match says so (`starts_with_value`). With a prefix
  given, it is taken off first and the template must match the whole rest.
- **The best match.** Of the templates that match a line, the one that accounts for most of it
  (the most fixed characters) is the message; templates as good as it are all named, and the line
  is **ambiguous**: none is picked.
- **A line that splits two ways.** Where a text value could end at more than one place, or two
  values sit side by side, the line's values are marked **unsure**.
- **A message inside a message.** A text value that is itself a whole message of the catalogue
  (`Error: "<message>" in file: "<file>" near line: <n>`) is matched too, and named.
- **Messages of several lines**: the three templates whose text holds a newline are matched over
  as many lines.
- **What no template matches is listed**, line by line, never guessed at; a line longer than 8,000
  characters is listed as too long to match.
- **Lines**: `\n` ends a line, a `\r` before it is part of the break, a byte-order mark at the start
  is no text, a line not valid UTF-8 is read as Windows-1252 and counted.

## The matcher on the catalogue

Measured from the committed package by the matcher itself; `task docs:game-log` writes this part,
and a test holds it to the code. `pychivalry log --catalogue` prints the same, and with `--json`
every list, the 520 entries that are no message among them.

<!-- written by task docs:game-log: start -->

The catalogue of the committed spec package (game 1.21.0.3) holds 2,671 messages. The matcher matches 2,108 of them; it leaves out 520 the package marks as no message at all (subject `not_a_message`: C++ type names, paths, identifiers, lines of the game's own documentation) and 43 whose fixed text holds fewer than two words of three letters or more, which would match lines that are not them. On a line made from each matched template (its values filled with stand-ins, after a stand-in prefix no game writes), 2,074 are found alone, 34 in 17 groups whose members match one another's lines equally well, 0 are beaten by another template, and 0 are not found. 3 templates span more than one line.

| Family (`subject`) | Entries | Matched | With a line | With a text value | Give a place | No value | What a message can be tied to |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `unknown` | 606 | 568 | 0 | 274 | 0 | 276 | 274 a value that may name a file, a definition, or a name the mod writes; 276 no value: nothing to tie |
| `not_a_message` | 520 | 0 | 0 | 0 | 0 | 0 | Not matched: the package marks every entry as no message |
| `game_object` | 233 | 233 | 0 | 149 | 0 | 79 | 149 a value that may name a file, a definition, or a name the mod writes; 79 no value: nothing to tie |
| `script_file` | 181 | 180 | 19 | 180 | 180 | 0 | 19 a file and line their own text names (`line %d`, `<file>:%d`); 180 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 180 a value that may name a file, a definition, or a name the mod writes |
| `graphics` | 138 | 135 | 0 | 15 | 0 | 99 | 15 a value that may name a file, a definition, or a name the mod writes; 99 no value: nothing to tie |
| `file_io` | 97 | 97 | 1 | 38 | 0 | 55 | 1 a file and line their own text names (`line %d`, `<file>:%d`); 38 a value that may name a file, a definition, or a name the mod writes; 55 no value: nothing to tie |
| `modifier` | 81 | 81 | 0 | 77 | 23 | 4 | 23 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 77 a value that may name a file, a definition, or a name the mod writes; 4 no value: nothing to tie |
| `history` | 77 | 77 | 0 | 74 | 23 | 3 | 23 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 74 a value that may name a file, a definition, or a name the mod writes; 3 no value: nothing to tie |
| `scope` | 71 | 71 | 0 | 70 | 16 | 1 | 16 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 70 a value that may name a file, a definition, or a name the mod writes; 1 no value: nothing to tie |
| `effect` | 64 | 64 | 0 | 56 | 2 | 8 | 2 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 56 a value that may name a file, a definition, or a name the mod writes; 8 no value: nothing to tie |
| `trigger` | 58 | 58 | 0 | 53 | 5 | 4 | 5 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 53 a value that may name a file, a definition, or a name the mod writes; 4 no value: nothing to tie |
| `gui` | 57 | 57 | 0 | 55 | 0 | 1 | 55 a value that may name a file, a definition, or a name the mod writes; 1 no value: nothing to tie |
| `event` | 53 | 53 | 0 | 49 | 12 | 4 | 12 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 49 a value that may name a file, a definition, or a name the mod writes; 4 no value: nothing to tie |
| `localization` | 53 | 53 | 4 | 53 | 6 | 0 | 4 a file and line their own text names (`line %d`, `<file>:%d`); 6 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 53 a value that may name a file, a definition, or a name the mod writes |
| `audio` | 47 | 47 | 0 | 11 | 0 | 30 | 11 a value that may name a file, a definition, or a name the mod writes; 30 no value: nothing to tie |
| `os_runtime` | 44 | 43 | 0 | 2 | 0 | 34 | 2 a value that may name a file, a definition, or a name the mod writes; 34 no value: nothing to tie |
| `asset` | 40 | 40 | 0 | 23 | 0 | 17 | 23 a value that may name a file, a definition, or a name the mod writes; 17 no value: nothing to tie |
| `online_platform` | 34 | 34 | 0 | 5 | 0 | 26 | 5 a value that may name a file, a definition, or a name the mod writes; 26 no value: nothing to tie |
| `dev_tools` | 32 | 32 | 0 | 21 | 0 | 10 | 21 a value that may name a file, a definition, or a name the mod writes; 10 no value: nothing to tie |
| `input_display` | 31 | 31 | 0 | 3 | 0 | 22 | 3 a value that may name a file, a definition, or a name the mod writes; 22 no value: nothing to tie |
| `database` | 22 | 22 | 0 | 20 | 4 | 2 | 4 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 20 a value that may name a file, a definition, or a name the mod writes; 2 no value: nothing to tie |
| `compression` | 17 | 17 | 0 | 0 | 0 | 16 | 16 no value: nothing to tie |
| `variable` | 17 | 17 | 0 | 16 | 0 | 1 | 16 a value that may name a file, a definition, or a name the mod writes; 1 no value: nothing to tie |
| `data_system` | 13 | 13 | 0 | 13 | 0 | 0 | 13 a value that may name a file, a definition, or a name the mod writes |
| `casus_belli` | 12 | 12 | 0 | 12 | 1 | 0 | 1 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 12 a value that may name a file, a definition, or a name the mod writes |
| `character_interaction` | 12 | 12 | 0 | 10 | 0 | 2 | 10 a value that may name a file, a definition, or a name the mod writes; 2 no value: nothing to tie |
| `on_action` | 11 | 11 | 0 | 10 | 4 | 1 | 4 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 10 a value that may name a file, a definition, or a name the mod writes; 1 no value: nothing to tie |
| `settings_file` | 10 | 10 | 1 | 3 | 0 | 6 | 1 a file and line their own text names (`line %d`, `<file>:%d`); 3 a value that may name a file, a definition, or a name the mod writes; 6 no value: nothing to tie |
| `console` | 8 | 8 | 0 | 0 | 0 | 8 | 8 no value: nothing to tie |
| `link` | 8 | 8 | 0 | 7 | 0 | 1 | 7 a value that may name a file, a definition, or a name the mod writes; 1 no value: nothing to tie |
| `script_value` | 8 | 8 | 0 | 8 | 1 | 0 | 1 a place as the script reader prints it (`at {}`): the file found in it, the line not known before a capture; 8 a value that may name a file, a definition, or a name the mod writes |
| `saved_game` | 5 | 5 | 0 | 3 | 0 | 2 | 3 a value that may name a file, a definition, or a name the mod writes; 2 no value: nothing to tie |
| `trigger_cache` | 5 | 5 | 0 | 2 | 0 | 3 | 2 a value that may name a file, a definition, or a name the mod writes; 3 no value: nothing to tie |
| `json` | 3 | 3 | 1 | 2 | 0 | 0 | 1 a file and line their own text names (`line %d`, `<file>:%d`); 2 a value that may name a file, a definition, or a name the mod writes |
| `list` | 3 | 3 | 0 | 3 | 0 | 0 | 3 a value that may name a file, a definition, or a name the mod writes |

"With a line": a value the message's own text says is a line number. "Give a place": the package's reason for the entry is `script_position`, "the message gives the place in a script file the game read, as the script reader prints it". A message can fall in several columns.

**Ambiguous** (several entries match one line equally well; a line they match names them all and picks none):

- `X_missing_exact_perspective_X_at_X_using_X_instead`, `X_missing_exact_perspective_X_at_X_using_X_instead_2`
- `cannot_find_X_in_modifier_database`, `cannot_find_X_in_modifier_database_2`
- `cannot_get_modifier_value_because_X_is_not_a_modifier_type`, `cannot_get_modifier_value_because_X_is_not_a_modifier_type_2`
- `duplicate_landed_title_name_X`, `duplicate_landed_title_name_X_2`
- `expected_X_but_got_X_X_X`, `expected_X_but_got_X_X_X_2`
- `failed_to_load_global_statistics_error_no`, `failed_to_load_global_statistics_error_no_2`
- `failed_to_load_user_statistics_and_achievements_error_no`, `failed_to_load_user_statistics_and_achievements_error_no_2`
- `failed_to_parse_date_due_to`, `failed_to_parse_date_due_to_2`
- `failed_to_parse_log_settings_file`, `failed_to_parse_log_settings_file_2`
- `failed_to_read_key_reference_X_from_database_X`, `failed_to_read_key_reference_X_from_database_X_2`
- `failed_to_read_key_reference_X_from_database_atX`, `failed_to_read_key_reference_X_from_database_at_X`
- `invalid_script_name_X_was_used`, `invalid_script_name_X_was_used_2`
- `missing_loc_key_for_X`, `missing_loc_key_for_XX`
- `modifier_X_doesn_t_match_expected_type_X_due_to_X_2`, `modifier_X_doesn_t_match_expected_type_X_due_to_X_3`
- `referencing_a_named_script_value_that_does_not_exist_X`, `referencing_a_named_script_value_that_does_not_exist_X_2`
- `unexpected_characters_found_at_end_of_statement_X_X`, `unexpected_characters_found_at_end_of_statement_X_X_2`
- `unknown_gfx_culture_flag_X`, `unknown_gfx_culture_flag_X_2`

**Too little fixed text** (not matched):

`error`, `error_2`, `errors`, `errors_2`, `expected`, `unknown`, `error_3`, `unknown_2`, `d3d_error`, `driverinternalerror`, `driverinvalidcall`, `error_4`, `error_X`, `error_5`, `error_6`, `errormsg_X`, `errors_3`, `expected_2`, `expected_at_X_in_X`, `expected_3`, `expected_4`, `expected_5`, `expected_6`, `expected_7`, `expected_8`, `invalidcall`, `invaliddevice`, `no_errors`, `unknown_3`, `undefined`, `unknown_4`, `unknown_X_in_X`, `vk_unknown`, `error_7`, `expected_9`, `expected_10`, `i_o_error`, `invalid`, `invalid_2`, `invalidate`, `invalidated`, `io_error`, `no_error`

**More than one line:** `assertion_failure_at_X_X_X_triggered_X_X_X`, `effect_X_at_X_no_seed_set_in_top_scope_caller_should_seed_to`, `failed_to_pick_default_activity_option_for_category_X_for_sc`.

<!-- written by task docs:game-log: end -->

## What a message is tied to

Each matched message's values are read three ways, in this order (`tie.ts`):

1. **A file it names.** A text value that holds the path of a file the index read (with `/` or `\`,
   on its own or inside a longer path: the longest end of it the index knows). Its line is the
   message's own (`line %d`, `<file>:%d`), or the one the place format given reads; otherwise the
   line is not known, and the file's first line stands for the file.
2. **A definition it names.** A value that is one name and that the mod or the base game defines:
   each definition, the mod's first.
3. **Where the mod writes it.** The same, for a name nothing defines: each place in the mod that
   writes it. An unknown trigger is where the mod wrote it.

A message that names its file says where its names are: they are looked for in that file, at its
line when the message gives one. A scope type's name (`character`, and part O2's `none`) and a
folder's (`events`, `common/traits`) are no names a file defines and are not looked up; a number
is not either. Each matched message also carries the pychivalry codes whose evidence is its
catalogue entry (`names/unknown-trigger` for `Unknown trigger '%s'`): the checks that find the same
thing before the game is run. What each family of messages can be tied to is in the table above.

## Where the logs are

`logFolders` (`packages/core/src/log/folders.ts`) gives the folders that exist, in this order;
nothing there is ever written.

| System | Folder | Basis |
| --- | --- | --- |
| Windows | `Paradox Interactive/Crusader Kings III/logs` in the Documents folder Windows names (the `Personal` shell folder of the user's registry, which follows a move to OneDrive) | Seen on the analysis machine (Documents in the home folder) |
| Windows | The same in `Documents` of the home folder | Seen |
| Windows | The same in `Documents` of each OneDrive folder the environment names (`OneDrive`, `OneDriveConsumer`, `OneDriveCommercial`), and of `OneDrive` in the home folder | Windows' and OneDrive's convention, not seen with the game |
| Linux | `$XDG_DATA_HOME/Paradox Interactive/Crusader Kings III/logs`, when the variable is set | Convention; whether the game reads the variable is not known |
| Linux | `~/.local/share/Paradox Interactive/Crusader Kings III/logs` | PLAN.md item 11.7; not seen on a machine of this project |
| Linux, the Windows build under Proton | `steamapps/compatdata/<app id>/pfx/drive_c/users/steamuser/Documents/Paradox Interactive/Crusader Kings III/logs` (and `My Documents`, older prefixes), in the Steam library the game is installed in; the app id is the one Steam's own `appmanifest_<id>.acf` gives the game's install folder | Valve's Proton FAQ for the prefix's place; `steamuser` and `Documents` the prefix's convention; not seen with the game |
| macOS | `~/Documents/Paradox Interactive/Crusader Kings III/logs` | Untested |

## On every surface

The command line, the agent server and the editor give the same report, the core's `LogReport`;
a test holds the first two to one answer on every hand-made log, with and without a prefix, and
the language server's test holds the editor's diagnostics to the same report.

- **Command line**: `pychivalry log [<log>] [--mod <mod>] [--vanilla <game> | --no-vanilla]
  [--prefix <pattern>] [--location <pattern>] [--json]`, and `pychivalry log --catalogue`
  ([guide/commands.md](guide/commands.md#options-of-log)).
- **Agent server**: the tool `analyze_log`, tool schema version 7, answered whole by message as
  `lookup` is by name; it reads a log only in the game's log folders, a folder it was given
  (`--logs`), or the mod's own folder ([guide/agent-server.md](guide/agent-server.md#the-games-log)).
- **Editor**: "Show the game's log against the mod", "Watch the game's log" and "Clear the game's
  log findings", in a diagnostics collection of their own (source `CK3 game log`), apart from
  pychivalry's own findings; the settings `pychivalry.log.file`, `pychivalry.log.linePrefix` and
  `pychivalry.log.location` ([guide/settings.md](guide/settings.md)).

## The captures and the in-game load

The captures of item 11.1 and the in-game load of item 11.8 are prepared: the procedure, its
guard and the grade are in [game-log-capture.md](game-log-capture.md). The eight captures have the
owner's word (decision 200) and are not made yet; the in-game load waits on a word of its own. The
spec work is asked for the source file of the executable each catalogue message is written from
(decision 204): with it the 17 ambiguous groups could be told apart by the file a line's prefix
names, and the prefix read as data.
When the first capture is read, this page is written again from it, the format questions above
answered one by one, and the matcher's line prefix and place format, if the log shows them, set
from it.
