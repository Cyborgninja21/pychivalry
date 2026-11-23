# The scored test of the agent server

**What this is, in plain words.** pychivalry contains no API key, no token and no login, and
never will. None of its shipped packages (`packages/core`, `cli`, `mcp`, `lsp` and `vscode`)
makes a network call or a model call: the agent server is a local program that reads mod and
game files and answers questions. The AI is always another program that connects to pychivalry:
Claude Code, or VS Code's built-in AI, signed in however its user already signed it in. The
scored test on this page is a developer's test script. It is not shipped, not part of the
extension, and never run by CI. It starts the Claude Code program already installed on the
developer's machine, as a separate test session with pychivalry's agent server attached, and
grades in code what that session did to a copy of the planted-defect mod. It gives Claude Code
no credentials and removes any key or token variable from the session's environment. The only
effect on the developer is that each test session counts against their own Claude plan, like any
session they open themselves.

Two tests in public CI hold this: `tools/src/no-key-no-network.test.ts` (no shipped file names a
credential or a key, imports a networking module or calls `fetch`) and
`tools/src/scored-run/run.test.ts` (the test session's environment holds no key or token
variable).

A scored run tests whether an AI agent can really use pychivalry's agent server (docs/MVP.md,
"AI tests"; docs/PLAN.md, items 6.8 to 6.11). Each trial is one test session. A model's output is
not repeatable, so each task runs several times and the result is a pass rate. A run is started
by a person, or by an agent on the owner's word; the first test sessions wait for the owner's
word (docs/decisions.md, decision 80).

| File | What it is |
| --- | --- |
| [agent-use.prompt.md](agent-use.prompt.md) | The task given to the agent, word for word |
| `tools/src/scored-run/run.ts` | The run: the trials, Claude Code's arguments and environment, the record |
| `tools/src/scored-run/graders.ts` | The five graders |
| `tools/src/scored-run/stream.ts` | What is read from Claude Code's output stream |
| `tools/src/scored-run/scored-record.ts` | The record's shape and its consistency checks |
| `tools/src/scored-run/fake-claude.ts` | A stand-in for Claude Code, for the tests |
| [../../fixtures/defects/](../../fixtures/defects/README.md) | The planted-defect mod, its fixed copy and its manifest |

## The agent-use task

The agent gets a copy of the planted-defect mod, `fixtures/defects/mod/`: 27 defects, one per
check code that is an error or a warning, and 10 lines that look wrong and are not. It is told to
fix every error and warning with the pychivalry tools, changing nothing else. A trial passes when
all five graders pass and its harness held (below).

## Starting a run

```sh
SCORED_SESSION_LIMIT=3 task scored:agent-use
```

That runs 5 test sessions with the pinned model, one after the other. Each has two safety stops:
the session limit, which the script passes unchanged to Claude Code's own session-ending option
([below](#claude-codes-arguments)), and a time limit of 30 minutes, after which the script stops
the session. Claude Code checks its option after each model response, so a session can end one
response after the limit is reached. The agent server must be built first (`task build` builds
it; the task depends on it).

| Variable | Meaning | Default |
| --- | --- | --- |
| `SCORED_SESSION_LIMIT` | The session limit of each test session: a positive number, passed unchanged to Claude Code's session-ending option | none: it must be given |
| `SCORED_MODEL` | The model, by its full name (an alias such as `opus` is refused) | `claude-opus-5-5`, Opus 5.5 |
| `SCORED_TRIALS` | Test sessions per task: 5 in development, 10 before a release | 5 |
| `SCORED_SERVER` | The agent server's entry point, from the repository root | `packages/mcp/dist/main.js` |
| `SCORED_SERVER_ARGS` | The server's arguments, a JSON list; `{mod}` is the trial's mod and `{game}` the game stub | `["--mod", "{mod}", "--vanilla", "{game}"]`, the server's own options |
| `SCORED_CLAUDE` | Claude Code's command; a `.js` or `.mjs` file is run with Node | `claude` |
| `SCORED_TIMEOUT_MINUTES` | A test session still running after this is stopped | 30 |
| `SCORED_KEEP` | `true` keeps the run's temporary folder: each trial's mod, output stream, error output and server configuration | removed |

The pinned model is `PINNED_MODEL` in `tools/src/scored-run/run.ts`, Opus 5.5 by the owner's
decision (docs/decisions.md, decision 78). Changing it is a change to that line, to this page and
to the decision log, so every record names the model it measured.

## One trial

1. The mod is copied into a new temporary folder: its files only, no git history.
2. A server configuration is written beside it, naming one agent server, `pychivalry`: the
   built server, `packages/mcp/dist/main.js`, started with this Node as
   `--mod <trial mod> --vanilla fixtures/game/planted-defects/game`, with its index cache in
   the run's own folder. The server is bound to that one mod; it offers `check`, `lookup`,
   `find_definition`, `find_references`, `list_definitions` and `explain_code` (to the agent,
   `mcp__pychivalry__check` and so on), and counts lines and columns from 1, as the manifest
   and the agent's `Read` do. The graders check the result over the same stub, so the server
   and the graders see the same base game, and no game install is needed.
3. Claude Code starts in the mod's folder as a test session, with the prompt and the arguments
   below. Its environment is the developer's, less every variable whose name says it may hold a
   key, a token or another credential (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and any name
   with `KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `PASSWD`, `CREDENTIAL` or `AUTH` in it, in any
   letter case), so the script hands Claude Code no credentials and the session runs as the
   developer's Claude Code is already signed in. It also has none of a surrounding Claude Code
   session's variables (`CLAUDECODE`, `CLAUDE_PID`, `CLAUDE_EFFORT`, `CLAUDE_AGENT_SDK_VERSION`,
   `CLAUDE_CODE_*`), so a run started from inside a session is not steered by it. It has
   `ENABLE_CLAUDEAI_MCP_SERVERS=false`, so the other agent servers Claude Code would offer from
   claude.ai are switched off, and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, so is its automatic
   memory.
4. When the session ends, its output stream is read and the mod graded.

### Claude Code's arguments

The flags of item 6.8, checked on 2026-11-23 against `claude --help` of the installed Claude
Code, 2.1.220, and its documentation:

| Flag in the plan | As given | Why |
| --- | --- | --- |
| (command-line mode) | `-p <prompt>`, first | `-p` is command-line mode, which the session-ending option, `--output-format` and `--no-session-persistence` need. `--mcp-config`, `--tools` and `--allowedTools` each take several values, so a prompt after them would be read as one more; it goes first, as Claude Code's own examples write it |
| `--strict-mcp-config` | as written | Exists: only the servers of `--mcp-config` |
| `--mcp-config <file>` | as written | Exists; takes several files |
| `--tools "Read,Edit"` | as written | Exists: the built-in tools offered. It does not limit agent-server tools |
| `--allowedTools "mcp__pychivalry__*"` | `"mcp__pychivalry__*,Read,Edit"` | Exists. Under `dontAsk` every call that would ask is refused, and an edit asks unless it is allowed: as written, the agent could not edit. Reading a file in the working folder needs no permission |
| `--permission-mode dontAsk` | as written | Exists (`acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`) |
| `--max-budget-usd <n>` | the session limit | Exists, in command-line mode only. It is Claude Code's own option that ends a session early once Claude Code's own measure of the session reaches the number given; the script uses it only as a per-session limit, a safety stop, and does no accounting of its own |
| `--output-format stream-json` | as written | Exists; command-line mode only |
| `--verbose` | as written | Exists; stream-json in command-line mode needs it |
| `--no-session-persistence` | as written | Exists; command-line mode only |
| `--model <pinned>` | as written | Exists; takes an alias or a full name, and the run gives a full name |
| (not in the plan) | `--setting-sources project,local` | Leaves out the user's own settings, instructions (`CLAUDE.md`) and skills: the plan's open question, whether the flags keep the user's own set-up out. The trial folder has no project settings |

Whether these keep everything else out is checked in every test session (below); the first real
ones settle it.

## What is read and recorded

From the output stream (`--output-format stream-json --verbose`, one JSON object per line):

- the session's start (`system`, `init`): the Claude Code version, the model, the permission
  mode, the tools and agent servers offered with their status;
- each tool call (`tool_use` blocks), counted per tool, and each tool error (`tool_result` with
  `is_error`), with its text;
- the end (`result`): what ended it (by itself, at the session limit, at a turn limit, on an
  error), the turns, the time, the calls the permission mode refused.

Nothing else is kept: not the session's text, not the tools' inputs and results, not the session
id, not any figure Claude Code reports about the session's use of the developer's plan, nothing
about how Claude Code is signed in. A tool error's text is kept with the trial's folders named
(`<trial mod>`) and any other absolute path replaced by `<path>`.

**The harness held** when the session ended by itself or at its session limit, its start shows
only `Read`, `Edit` and the `mcp__pychivalry__` tools, only the `pychivalry` server, and that
server did not fail; a server already connected at the start offers all six of its tools (one
still starting, as Claude Code before 2.1.221 can show it, offers none yet). Each test session
checks its own confinement this way. Otherwise the trial has a harness problem: it fails, and
the run exits 1 so that nobody takes its pass rate for a result about the server.

## The graders

Each grades the folder as the session left it against the untouched `mod/` and the manifest,
on its own (`tools/src/scored-run/graders.ts` states each exactly):

1. `zero-errors`: the checker reports no error.
2. `defects-gone`: the checker reports no finding of a planted code.
3. `only-planted-lines`: nothing changed outside the lines the manifest lets each fix change,
   and no file was added or removed.
4. `look-alikes-untouched`: every look-alike line is still there, unchanged.
5. `nothing-deleted`: no file is gone, and no change lost words (a line commented out or a
   block deleted does; a stray brace removed does not).

The checker is the core's one runner, `checkWorkspace`, over the game stub, with its defaults:
`localization/unused-key` off, as the server's `check` answers by default. The planted mod has no
unused key either way. The graders pass on `fixtures/defects/reference/` and fail on the
untouched `mod/`; their tests run in public CI.

## The record

`records/scored/agent-use.json`, in the record format (records/README.md, "Scored records"):
the harness version, the model, the session limit, the arguments, per trial the tool calls and
errors, which graders passed and what the checker still reports, and the pass rate per task.
Each run overwrites it; the history is git's. Unlike a suite's record it is not failed by a
later spec, since making it again means new test sessions, which start only on the owner's word.

## Tests

`tools/src/scored-run/*.test.ts` run in public CI with no model, key, network or display.
`server.test.ts` starts the built agent server exactly as a trial's configuration says, on a
fresh copy of the planted mod, and gets one `check` answer: the six tools, and the planted
defects at the manifest's lines. The run's tests start `fake-claude.ts` in Claude Code's place:
it answers `--version`, records the arguments it was given and the names of any key, token or
other credential variables it was given (there must be none), copies a folder over the trial's
mod as an agent's edits would, and plays back a stream written in the documented shape. No real
test session has run yet (item 6.11 waits for the owner's word); the first one's stream is the
check of that shape.
