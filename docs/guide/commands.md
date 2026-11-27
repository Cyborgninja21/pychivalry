# Commands

## In VS Code

| Command | What it does |
| --- | --- |
| pychivalry: Set up for Claude Code | Adds pychivalry's agent server to Claude Code's own configuration for the mod's folder, which Claude Code reads instead of what VS Code extensions register. With Claude Code's `claude` command installed it runs `claude mcp add --scope local` (removing an earlier entry first), so the entry is private to you and kept outside the mod. Without it, it says so and asks whether to write a project configuration file, `.mcp.json`, in the mod's folder instead; nothing is written before you answer. Once the server is set up, it copies pychivalry's three skills ([below](#the-skills)) into Claude Code's folder of personal skills. Run it once per mod folder; it keeps working when the extension updates, and running it again changes nothing that is already in place |
| pychivalry: Show the game's log against the mod | Reads the game's own error log (build step 11, [The game's log](../game-log.md)) and shows each place in the mod one of its messages is about, as a warning whose source is `CK3 game log`, apart from pychivalry's own findings: the log's line, the game's own text, and why it is shown there (the file and line the message names, the file with its line not known, the definition of a name it names, or where the mod writes it). It reads the log the command is given, or the setting `pychivalry.log.file`, or the `error.log` of the game's log folder it finds, asking when there are several. The log is only read |
| pychivalry: Watch the game's log | The same, and again each time the log changes, as the game writes it |
| pychivalry: Clear the game's log findings | Stops watching and clears the log's findings; pychivalry's own stay |
| pychivalry: Remove from Claude Code | Undoes the set-up for the mod's folder: removes the server's entry (`claude mcp remove --scope local`), takes pychivalry's own entry out of the folder's `.mcp.json` (the file goes too when nothing else is left in it; an entry of that name pychivalry did not write is left), and, when no other folder you set up is left, removes the skills it copied. Run it before you uninstall the extension, which cannot do it for you |

When `pychivalry.gamePath` changes after a set-up, Claude Code still has the command line it was
given, with the old game folder. pychivalry notices and offers, once, to set the folder up
again; accepting runs the command again for that folder.

### The skills

pychivalry ships three skills: short written instructions an AI loads when a task calls for one.
Each tells the AI how to use pychivalry's tools for one kind of task; the AI decides when to load
it from what you ask, or you start one by name.

| Skill | When the AI uses it |
| --- | --- |
| `pychivalry-explain-error` | You ask what an error, a warning or a code means, or why pychivalry reports something. It explains from the game's own evidence and documentation, and changes nothing |
| `pychivalry-fix-error` | You ask to fix the errors and warnings of the mod or a file. It checks, looks up what is valid, edits, and checks again, at most five rounds, and formats what it changed; before it changes a scripted effect, a scripted trigger or an event, it asks the call graph what calls it, and it tells you what the change affects; when you give it the game's error log (a file or the game's log folder), or tell it you have run the mod in the game, it also reads that log against the mod and fixes what the game reported about the files it fixes, and tells you which it fixed; it says what is left. Without a log it does not read one. The log is the game's last run: whether a fix holds in the game shows when you run it again |
| `pychivalry-write-content` | You ask for new content: an event with its localization, a decision, a scripted effect or a scripted trigger. It looks every name up before writing it, writes the localization with the event, reads back from the call graph each event chain or call it wrote, runs the checker and repairs from what it finds, at most five rounds, formats what it wrote, and never says it is done while an error is left |

- **VS Code's own AI** has them as soon as the extension is installed: they are listed in the
  chat's skills, and in agent mode the AI loads one when your request matches it (or type `/`
  and pick one).
- **Claude Code** gets them from "Set up for Claude Code", which copies them into the `skills`
  folder of Claude Code's configuration folder (`~/.claude`, or the folder `CLAUDE_CONFIG_DIR`
  names), never into your mod. Claude Code picks them up at once; ask "What skills are
  available?" to see them. pychivalry writes and removes only its own copies there: a skill of
  the same name that pychivalry did not write, or one you edited, is left as it is, and the
  set-up says so. When the extension updates, it brings its copies up to the new version the
  next time it starts.

The AI's edits go through its own harness, which shows them to you; pychivalry's agent server
only reads, but for `apply_format`, which the skills run on each file the AI wrote to put it in
pychivalry's format (your harness asks you first, unless you allowed it). A clean check proves
the script is valid, not that it does what you asked: read what the AI wrote.

The editor features need no command: the extension starts when you open a CK3 script,
localization or GUI file, or a folder holding a `descriptor.mod`. They are the language server's:

- the mod's findings in the Problems panel, while you type and for the whole mod in the
  background (closing a file keeps its findings);
- hover: the game's own description of a trigger, an effect, a link or a modifier, and where a
  name the mod or the game defines is defined and which definition is in force;
- completion: what is valid where you type (effects in an effect block, triggers in a trigger
  block, names the mod and the game define, the values the base game writes in a field);
- Go to Definition, Find All References and the outline of a file (document symbols); in a GUI
  file (`.gui`, since build step 10) on its types and templates, a type found in any letter case,
  the outline its `types` blocks and templates ([GUI syntax](../gui-syntax.md)); a GUI file's
  findings are its syntax's alone, and it is not formatted;
- Show Call Hierarchy (Shift+Alt+H, or the context menu) on an event, an on-action, a scripted
  effect or trigger, a decision or any definition: what calls it and what it calls, in the mod
  and the base game, each call opening the place it is written ([The call graph](../call-graph.md));
  a callee nothing defines has no file to open and is not shown;
- quick fixes on a finding that has a mechanical fix (the light bulb, or Ctrl+.): each of its
  alternatives, a safe one preferred, and "fix every safe ... in the file" where a file has
  more than one safe fix of a code; Source Action > Fix All applies every safe fix of the file.
  A fix that adds a localization stub edits the mod's localization file, or makes one.
- Format Document, Format Selection and on-type formatting (after Enter, `}` and `=`, when
  VS Code's `editor.formatOnType` is on), by pychivalry's rules ([Formatting](formatting.md)).
  A file with a parse error is left as it is, and pychivalry says why once.

Each later step that adds a command adds its row here.

## The command line

`pychivalry` checks a mod from a terminal and gives the same findings as the editor and the
agent server. It ships inside the extension, which puts it on the path of VS Code's integrated
terminal: in a new terminal, `pychivalry check .` checks the mod in the current folder. VS Code
runs it with its own runtime, so you need no Node. In a terminal of its own, outside VS Code, it
runs from a build of this repository as `node packages/cli/dist/main.js <command>`.

The terminal's `pychivalry` does not read VS Code's settings: it finds the game in Steam's
libraries, or reads it from `--vanilla <game folder>`.

| Command | What it does |
| --- | --- |
| `pychivalry check <mod>` | Checks a mod folder: every finding, file by file, then a summary |
| `pychivalry lookup <name>...` | What a name is: every reading the spec package has of it (its description, the scopes it supports, what it takes, the version it came in or went out), where the base game and a mod define and use it and which definition is in force, and, for a name nothing knows, the names close to it |
| `pychivalry source <layer> <file> <line>` | The text around a place a result named, at most 40 lines, each with its number: the base game's own script, localization or GUI files (to see how the game itself writes a name), or the mod's. The same lines the agent server's `source` gives for the same place ([below](#options-of-source)) |
| `pychivalry calls <name>...` | The call graph of each name: where the mod and the base game define it as script, what calls it and what it calls, each link with its kind (the caller's folder and the callee's: `events -> events`, `common/on_action -> events`), the statement that writes it and its place ([below](#options-of-calls)). The same links as the agent server's `call_graph` and the editor's call hierarchy |
| `pychivalry format <file\|folder>...` | Formats the mod's script and localization files by pychivalry's rules ([Formatting](formatting.md)), in place; a file with a parse error, or not valid UTF-8, is left as it is and named; GUI files are not formatted, and a folder's are counted in one line |
| `pychivalry log [<log>]` | The game's own error log read against the game's error catalogue: every line that is one of its messages, grouped by message, each tied to the places in the mod and the base game it is about; every line that is no message of the catalogue, listed as it is ([below](#options-of-log)). The same answer as the agent server's `analyze_log` and the editor's "Show the game's log against the mod" |
| `pychivalry explain <code>...` | What a finding's code means: its severity, what it finds and the game's evidence for it, its message with each value a named slot (`Unknown trigger '<trigger>'`). A code may be written `names/*` for a whole family, or `*` for all |
| `pychivalry --help`, `pychivalry <command> --help` | The commands, or one command's options |
| `pychivalry --version` | The version |

Options of `check`:

| Option | What it does |
| --- | --- |
| `--vanilla <game>` | The game's `game` folder, the one holding `common/`. Without it, pychivalry looks for the game in every Steam library |
| `--no-vanilla` | Check without the base game. Names the game defines are then not judged, never reported unknown |
| `--spec <file>` | Another spec package file (`ck3-spec-<version>.json.gz`, with its `.sha256` beside it), or its folder |
| `--json` | One JSON object per finding and a last summary line, instead of text |
| `--severity <severity>` | Keep only findings of these severities: `error`, `warning`, `information`, `hint`. Several are written with commas or by giving the option again |
| `--code <code>` | Keep only findings of these codes: a code, a family (`names/*`) or `*`. Several as for `--severity` |
| `--limit <n>` | Show at most `n` findings. The summary still counts all of them |
| `--no-unused-keys` | Do not report localization keys nothing in the mod or the base game uses (`localization/unused-key`), which is on by default; a large mod has a hint for nearly every key it defines |
| `--fix` | Apply the safe fixes of the findings kept (the filters choose them), then check again and print what is left. A safe fix is one whose finding has one outcome that can be right; a suggestion is never applied. A fix whose edits overlap one applied before it waits for another run. A file that is not valid UTF-8 is converted to UTF-8 with a byte-order mark first, when its `style/not-utf8` fix is safe and kept, and its other safe fixes then apply; otherwise it is left as it is. A file's `style/not-formatted` fix formats the whole file and stands for its other formatting fixes |
| `--dry-run` | With `--fix`: write nothing, and print each safe fix and its edits instead (with `--json`, one `{"fix": ...}` line each, then the summary) |

Options of `format`:

| Option | What it does |
| --- | --- |
| `--check` | Write nothing; exit with `1` when a file would change |
| `--diff` | Write nothing; print what would change as a unified diff |
| `--mod <mod>` | The mod folder. Without it: the folder holding `descriptor.mod` at or above the first path given, otherwise that path. Every path given must be inside the mod, and only the files the game reads there are formatted: a file named that is not one is bad usage |
| `--spec <file>` | Another spec package, as for `check` (its folders say which files the game reads) |

`format` prints a line for each file it formats (or would, with `--check`), then
`<n> files formatted, <m> files already formatted, <k> files left as they are`; a file left as it
is is named on standard error with the reason.

Options of `lookup`: `--vanilla`, `--no-vanilla`, `--spec` and `--json` as for `check`, and:

| Option | What it does |
| --- | --- |
| `--mod <mod>` | A mod folder, read over the base game, so that its definitions and uses are found too |
| `--language <language>` | Only this language's localization text, as its files' header names it (`l_english`) |

With `--json`, `lookup` prints one object per name: the whole answer, each part saying where it
comes from or why the spec package has nothing for it, with the evidence behind each part and the
first 20 uses. The text output writes a place as `<layer> <file>:<line>:<column>`: a place of the
layer `game` (or `jomini`, `clausewitz`, `dlc:<pack>`) is a file of the installed game, which you
can open there, or show with `pychivalry source <layer> <file> <line>`. The agent server's
`lookup` gives the same facts, compactly so that every name it is asked fits one result: each
reading's facts without their evidence, the first 3 uses, its own `source` tool for the game's
text around a place. Asked with `evidence` for one name, it also gives that name's readings as
`lookup --json` prints them, with their evidence, as many as fit one result and the rest counted
([The agent server](agent-server.md)).

### Options of `calls`

`pychivalry calls <name>...` takes names of definitions: events (`my_events.1`), on-actions,
scripted effects and triggers, decisions, any definition of script. `--vanilla`, `--no-vanilla`,
`--spec` and `--json` as for `check`, and:

| Option | What it does |
| --- | --- |
| `--mod <mod>` | A mod folder, read over the base game, so that its calls are read too |
| `--callers` | Only what calls each name |
| `--callees` | Only what each name calls |

A link is a call the spec package marks as one ([The call graph](../call-graph.md)): an event
triggering an event, a scripted effect or trigger called by name, an on-action firing an event or
another on-action, a decision firing an event, and every other value that names an event or an
on-action. The text output writes each link as its other end, its kind, the statement, its place
(`<layer> <file>:<line>:<column>`) and what in the package makes it a call; a callee nothing
defines says so. With `--json`, one object per name: its definitions, its callers and its callees
whole, every place with its layer. `calls` exits `1` when a name is neither defined nor called
anywhere, and `2` when there is nothing to read (`--no-vanilla` and no `--mod`).

### Options of `log`

`pychivalry log [<log>]` takes a log file, or a folder whose `error.log` it reads; without one, it
reads the `error.log` of the first of the game's log folders it finds ([Where the logs
are](../game-log.md#where-the-logs-are)). It only reads the log. `--vanilla`, `--no-vanilla`,
`--spec` and `--json` as for `check`, and:

| Option | What it does |
| --- | --- |
| `--mod <mod>` | A mod folder, read over the base game, whose files the messages are tied to. Without it and without the base game, the lines are matched and nothing is tied |
| `--prefix <pattern>` | What the game writes before each message on a line, as a regular expression matched at the line's start and taken off first. None is assumed: no real log has been read yet, and without it each message is found wherever it starts on its line |
| `--location <pattern>` | How a message writes a place in a script file, as a regular expression naming `(?<file>...)` and optionally `(?<line>...)` and `(?<column>...)`. None is assumed: without it a message's file is found by its path, and its line only where the message itself says `line` |
| `--catalogue` | Read no log: what the matcher makes of the catalogue itself, the messages it matches and cannot, the ambiguous ones, and per family what their values can be tied to ([The matcher on the catalogue](../game-log.md#the-matcher-on-the-catalogue)) |

The text output gives the totals, then each message: its catalogue entry (or the entries that
match its lines equally well), its family and the pychivalry codes whose evidence it is, its text
with each value written `<value>`, and each of its lines with their values and places
(`<layer> <file>:<line>:<column>`, or `(line not known)`); then the lines no message matches. With
`--json`, one object: the log read and the core's whole report. `log` exits `1` when a message is
tied to the mod's files, `0` when none is.

### Options of `source`

`pychivalry source <layer> <file> <line>` takes a place as every result writes it: its layer
(`game`, `jomini`, `clausewitz` or `dlc:<pack>` for the base game, `mod` for the mod), its file's
path inside that layer, with `/`, and its line, counted from 1. `--vanilla`, `--spec` and
`--json` as for `check`, and:

| Option | What it does |
| --- | --- |
| `--end-line <line>` | The last line of the place, for a place of several lines |
| `--context <lines>` | How many lines to show before and after the place, 0 to 20; 10 by default, fewer when the 40 lines it shows would be passed |
| `--mod <mod>` | A mod folder, whose script, localization and GUI files are then read as the layer `mod` |
| `--no-vanilla` | Read no base game: only the layer `mod`, with `--mod` |

It shows the lines as the index reads the file (its byte-order mark removed, a file not valid
UTF-8 read with replacement characters, which the first line says), each as its number, a tab
and its text: at most 40 lines, the place's own first; a line longer than 400 characters is cut
and ends in `…`; and the lines it shows, written as JSON, hold at most 12,000 characters, the
lines after them left out. What was cut or left out is said on standard error, with the line to
ask for next. With `--json` it prints one object: `layer`, `file`, `line` and `end_line` (the
lines shown), `line_count`, `lines`, `cut_lines`, `encoding` and `notes`, the same lines the
agent server's `source` gives for the same place.

Only a script, localization or GUI file pychivalry reads is shown, at the path a result names it by;
never an address on disk. `source` refuses, saying why: an absolute path, a backslash, an empty,
`.` or `..` part of the path, a line before 1, `--end-line` before the line or `--context` past
20 (exit `2`, bad usage); and a layer that is not read (the base game when it was not found or
`--no-vanilla` was given; `mod` without `--mod`), a file its layer does not list (naming the
file of the same letters in another case, when there is one), a link, a file whose real address
is outside its layer's folder, or a line past the end of the file (exit `1`). It indexes
nothing: the base game's folders are listed as the index lists them, and the one file is read.

What `check` prints:

- **Text.** Each file with findings, then one line per finding, `line:column  severity  code
  message`, where pychivalry knows what is valid there followed by it in parentheses (a scope
  finding: what the keyword or link takes and the links from the scope it is in,
  `(add_county_modifier takes landed_title; from character: capital_county, ...)`; a missing
  field or a value of the wrong kind: what the field takes and the values the base game writes),
  then a blank line; last, `<n> files checked: <e> errors, <w> warnings, <o> other`,
  which counts every finding (`other` is information and hints) and adds `(<s> shown)` when
  the filters or the limit leave some out. This is the shape of release 2.3.0's command line,
  with the new codes. Notes go to standard error: the game was not found, the game is of
  another build than the spec package, or some files were not checked because they are in a
  folder the game does not read as script.
- **JSON.** One object per finding with release 2.3.0's fields `file`, `range` (lines and
  characters counted from 0), `severity`, `code`, `message` and `source`, and beside them
  `evidence` (the game's message or output the finding rests on, or none for advice), `fix`
  and `data` (the names the finding is about, and what is valid there where pychivalry knows
  it, as [the agent server](agent-server.md) gives it). `fix` is null when the finding has no
  mechanical fix; otherwise `safety` (`safe`: the one outcome that can be right; `suggestion`:
  a choice), `basis` (what it rests on: `retired`, the spec package's documented replacement
  of a removed keyword; `nearest-name`, the names valid at the place that are near the one
  written; `scope-links`, the links the game documents between scopes; `parser`, what the
  parser read the line as; and others), and `alternatives`, at most five, each a `title` and
  its `edits`: a `file` of the mod (it may be another file, or a new one: `create`), a `range`
  and its `new_text`. The last line is `{"summary": ...}`: the version, the spec package and
  the game build (with `from_cache`, true when its index came from the cache, and `shared`,
  true when the language server of an open VS Code answered the command with its own copy of
  it), the files checked and not checked, the counts of every finding by severity and by code,
  how many findings matched the filters and how many were shown, `capped`: what the per-file
  limit left out, and with `--fix`, `fixes`: how many were applied and to which files.
- **One copy of the game's index.** When VS Code has a mod open, `check` and `lookup` are
  answered by its language server, which already holds the game's index, instead of loading a
  second copy; what they print is the same either way, and when the language server cannot
  answer, the command runs by itself ([Settings](settings.md)). `check --fix` always runs by
  itself, so that the edits to your files are made by the command you ran, and so does
  `source`, which loads no index at all.
- **At most 1,000 findings per file.** A file with more keeps its most severe ones (errors
  first, then warnings, information and hints), and the count of the others is given: on
  standard error with the text output, in `capped` with `--json`. The counts are of the
  findings kept.

Every code, with what it finds and its evidence, is listed in [Checks](checks.md). The same
checks, lookups and explanations are tools of [the agent server](agent-server.md), for an AI
agent; it starts as `node packages/mcp/dist/main.js` from a build of this repository.

Exit codes: `0` when no finding kept is an error, `1` when one is, `2` on bad usage or when the
mod, the game or the spec package cannot be read. The filters choose the findings kept, so
`--code syntax/*` exits with `1` only for a syntax error; `--limit` does not change the exit
code. `lookup` exits with `1` when neither the spec package nor the game and the mod know a
name, `source` when the place is not one it reads (above), `explain` when a code is none of this
build's, and `format --check` when a file would change.

The first `check` reads the whole base game, about 15 seconds for game 1.21, and saves what it
found in your cache folder ([Settings](settings.md)); every later one loads that in a second or
two.

## Building and testing from source

Everything goes through `task`; `task --list` shows every task.

| Task | What it does |
| --- | --- |
| `task ci` | Everything public CI runs: install, build, lint, format check, tests, and the spec, record and wiki checks |
| `task install` | Installs the workspace from the lock file |
| `task build` | Compiles every package and the tools |
| `task test` | Runs every package's tests |
| `task lint` | Lints every TypeScript file; warnings count as errors |
| `task format` / `task format:check` | Formats the sources / checks the formatting |
| `task spec:check` | Verifies the committed spec package against its checksum |
| `task records:check` | Checks every committed record |
| `task wiki:check` | Checks that the wiki builds from `docs/` and every link in it resolves |
| `task docs:checks` | Writes [Checks](checks.md) from the code's own list of checks |
| `task vscode:bundle` | Bundles the extension: the extension with its language client, the language server, and the agent server and command line with the spec package beside them |
| `task vscode:package` | Writes the installable file, `packages/vscode/dist/pychivalry-<version>.vsix`, with VS Code's packaging tool (no token is used and nothing is published), and prints its size and contents |
| `task vscode:test` | The editor tests in a real VS Code, downloaded the first time: the extension from its folder, the packaged file installed into a clean VS Code (the smoke test and the same-answers test), and an update. On Linux it runs only under `xvfb-run`, on a virtual display, never on your desktop. Not part of `task ci` |

## Tasks that need the game

These read a local install of the game and the five test mods, and run only on a machine that
has them. Each writes a record that is committed. They are for developing pychivalry, not for
checking your own mod; for that, use [the command line](#the-command-line).

| Task | Needs | What it does |
| --- | --- | --- |
| `task game:parse` | `CK3_GAME_PATH` | The base-game parse suite |
| `task game:index` | `CK3_GAME_PATH`, `CK3_CORPUS` | The index suite: the whole base game indexed, cached and reloaded, each mod indexed over it |
| `task game:check` | `CK3_GAME_PATH` | The base-game check suite: every check on the game's own files, every error and warning classified |
| `task game:mods` | `CK3_GAME_PATH`, `CK3_CORPUS` | The real-mod suite: every check on each test mod, every error classified |
| `task game:bench` | `CK3_GAME_PATH`, `CK3_CORPUS` | The benchmarks |
| `task vscode:corpus` | `CK3_GAME_PATH`, `CK3_CORPUS`; Linux, `xvfb-run` | The packaged extension on each test mod in a real VS Code on a virtual display, six times each: the time from opening the mod to the first full result and the language server's peak memory, and the same-answers test (editor, command line, agent server) on each mod. Prints its figures; writes no record |

`CK3_GAME_PATH` is the game's `game` folder. `CK3_CORPUS` is the folder holding the pinned copy
of the test mods. `CK3_CORPUS_SLUGS` limits a run to some of them.

## Publishing the wiki

| Task | What it does |
| --- | --- |
| `task wiki:build` | Builds the wiki pages from `docs/` into `.wiki-build/` to look at. Publishes nothing |
| `task wiki:publish` | Publishes them to the repository's public wiki. `WIKI_DRY_RUN=true` shows the changes and publishes nothing |
