# Commands

## In VS Code

| Command | What it does |
| --- | --- |
| pychivalry: Set up for Claude Code | Adds pychivalry's agent server to Claude Code's own configuration for the mod's folder, which Claude Code reads instead of what VS Code extensions register. With Claude Code's `claude` command installed it runs `claude mcp add --scope local` (removing an earlier entry first), so the entry is private to you and kept outside the mod. Without it, it says so and asks whether to write a project configuration file, `.mcp.json`, in the mod's folder instead; nothing is written before you answer. Run it once per mod folder; it keeps working when the extension updates |

When `pychivalry.gamePath` changes after a set-up, Claude Code still has the command line it was
given, with the old game folder. pychivalry notices and offers, once, to set the folder up
again; accepting runs the command again for that folder.

The editor features need no command: the extension starts when you open a CK3 script or
localization file, or a folder holding a `descriptor.mod`. They are the language server's:

- the mod's findings in the Problems panel, while you type and for the whole mod in the
  background (closing a file keeps its findings);
- hover: the game's own description of a trigger, an effect, a link or a modifier, and where a
  name the mod or the game defines is defined and which definition is in force;
- completion: what is valid where you type (effects in an effect block, triggers in a trigger
  block, names the mod and the game define, the values the base game writes in a field);
- Go to Definition, Find All References and the outline of a file (document symbols).

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
| `--unused-keys` | Also report localization keys nothing in the mod or the base game uses (`localization/unused-key`). Off by default: a large mod has a hint for nearly every key it defines |

Options of `lookup`: `--vanilla`, `--no-vanilla`, `--spec` and `--json` as for `check`, and:

| Option | What it does |
| --- | --- |
| `--mod <mod>` | A mod folder, read over the base game, so that its definitions and uses are found too |
| `--language <language>` | Only this language's localization text, as its files' header names it (`l_english`) |

With `--json`, `lookup` prints one object per name: the whole answer, each part saying where it
comes from or why the spec package has nothing for it.

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
  (empty until fixes arrive in build step 8) and `data` (the names the finding is about, and
  what is valid there where pychivalry knows it, as [the agent server](agent-server.md) gives
  it). The
  last line is `{"summary": ...}`: the version, the spec package and the game build, the files
  checked and not checked, the counts of every finding by severity and by code, how many
  findings matched the filters and how many were shown, and `capped`: what the per-file limit
  left out.
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
name, and `explain` when a code is none of this build's.

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
