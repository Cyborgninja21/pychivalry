# The scored runs

A scored run tests whether an AI agent can really use pychivalry's agent server (docs/MVP.md,
"AI tests"; docs/PLAN.md, items 6.8 to 6.11). It starts Claude Code's command-line mode once per
trial, on the existing Claude login, and grades what the agent left behind. A model's output is
not repeatable, so each task runs several times and the result is a pass rate.

A scored run draws on the login's usage limits. It is never part of `task ci`, and it is started
by a person, or by an agent on the owner's word.

| File | What it is |
| --- | --- |
| [agent-use.prompt.md](agent-use.prompt.md) | The task given to the agent, word for word |
| `tools/src/scored-run/run.ts` | The run: the trials, Claude Code's arguments, the record |
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
SCORED_BUDGET_USD=3 task scored:agent-use
```

That runs 5 trials with the pinned model, and spends at most 5 × 3 = 15 US dollars of the
login's usage, plus at most one model response per trial: Claude Code stops a session when its
own estimate of the cost passes the budget, after the response that crossed it. On a
subscription login nothing is charged per call; the run draws on the login's usage limits.
The agent server must be built first (`task build` builds it; the task depends on it).

| Variable | Meaning | Default |
| --- | --- | --- |
| `SCORED_BUDGET_USD` | The budget per trial, in US dollars | none: it must be given |
| `SCORED_MODEL` | The model, by its full name (an alias such as `opus` is refused) | `claude-opus-5-5` |
| `SCORED_TRIALS` | Trials per task: 5 in development, 10 before a release | 5 |
| `SCORED_SERVER` | The agent server's entry point, from the repository root | `packages/mcp/dist/main.js` |
| `SCORED_SERVER_ARGS` | The server's arguments, a JSON list; `{mod}` is the trial's mod and `{game}` the game stub | `["--mod", "{mod}", "--vanilla", "{game}"]`, the server's own options |
| `SCORED_CLAUDE` | Claude Code's command; a `.js` or `.mjs` file is run with Node | `claude` |
| `SCORED_TIMEOUT_MINUTES` | A session still running after this is stopped | 30 |
| `SCORED_KEEP` | `true` keeps the run's temporary folder: each trial's mod, output stream, error output and server configuration | removed |

The pinned model is `PINNED_MODEL` in `tools/src/scored-run/run.ts`. Changing it is a change to
that line and to this page, so every record names the model it measured.

## One trial

1. The mod is copied into a new temporary folder: its files only, no git history.
2. A server configuration is written beside it, naming one agent server, `pychivalry`: the
   built server, `packages/mcp/dist/main.js`, started with this Node as
   `--mod <trial mod> --vanilla fixtures/game/planted-defects/game`, with its index cache in
   the run's own folder. The server is bound to that one mod; it offers `check`, `lookup`,
   `find_definition`, `find_references`, `list_definitions` and `explain_code` (to the agent,
   `mcp__pychivalry__check` and so on), and counts lines and columns from 1, as the manifest
   and the agent's `Read` do. The
   graders check the result over the same stub, so the server and the graders see the same base
   game, and no game install is needed.
3. Claude Code starts in the mod's folder with the prompt and the arguments below. Its
   environment has no `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`, so it runs on the login,
   and none of a surrounding Claude Code session's variables (`CLAUDECODE`, `CLAUDE_PID`,
   `CLAUDE_EFFORT`, `CLAUDE_AGENT_SDK_VERSION`, `CLAUDE_CODE_*`), so a run started from inside
   a session is not steered by it; it has `ENABLE_CLAUDEAI_MCP_SERVERS=false`, so the login's
   own connectors are not offered, and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
4. When the session ends, its output stream is read and the mod graded.

### Claude Code's arguments

The flags of item 6.8, checked on 2026-11-23 against `claude --help` of the installed Claude
Code, 2.1.220, and its documentation:

| Flag in the plan | As given | Why |
| --- | --- | --- |
| (command-line mode) | `-p <prompt>`, first | `-p` is command-line mode, and `--max-budget-usd`, `--output-format` and `--no-session-persistence` work only with it. `--mcp-config`, `--tools` and `--allowedTools` each take several values, so a prompt after them would be read as one more; it goes first, as Claude Code's own examples write it |
| `--strict-mcp-config` | as written | Exists: only the servers of `--mcp-config` |
| `--mcp-config <file>` | as written | Exists; takes several files |
| `--tools "Read,Edit"` | as written | Exists: the built-in tools offered. It does not limit agent-server tools |
| `--allowedTools "mcp__pychivalry__*"` | `"mcp__pychivalry__*,Read,Edit"` | Exists. Under `dontAsk` every call that would ask is refused, and an edit asks unless it is allowed: as written, the agent could not edit. Reading a file in the working folder needs no permission |
| `--permission-mode dontAsk` | as written | Exists (`acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`) |
| `--max-budget-usd <n>` | as written | Exists; command-line mode only |
| `--output-format stream-json` | as written | Exists; command-line mode only |
| `--verbose` | as written | Exists; stream-json in command-line mode needs it |
| `--no-session-persistence` | as written | Exists; command-line mode only |
| `--model <pinned>` | as written | Exists; takes an alias or a full name, and the run gives a full name |
| (not in the plan) | `--setting-sources project,local` | Leaves out the user's own settings, instructions (`CLAUDE.md`) and skills: the plan's open question, whether the flags keep the user's own set-up out. The trial folder has no project settings |

Whether these keep everything else out is checked on every trial (below); the first real run
settles it.

## What is read and recorded

From the output stream (`--output-format stream-json --verbose`, one JSON object per line):

- the session's start (`system`, `init`): the Claude Code version, the model, the permission
  mode, the tools and agent servers offered with their status;
- each tool call (`tool_use` blocks), counted per tool, and each tool error (`tool_result` with
  `is_error`), with its text;
- the end (`result`): what ended it (`success`, `error_max_budget_usd`, ...), Claude Code's
  estimate of the cost, the turns, the time, the calls the permission mode refused.

Nothing else is kept: not the session's text, not the tools' inputs and results, not the
session id, nothing about the login. A tool error's text is kept with the trial's folders named
(`<trial mod>`) and any other absolute path replaced by `<path>`.

**The harness held** when the session ended by itself or at its budget, its start shows only
`Read`, `Edit` and the `mcp__pychivalry__` tools, only the `pychivalry` server, and that server
did not fail; a server already connected at the start offers all six of its tools (one still
starting, as Claude Code before 2.1.221 can show it, offers none yet). Otherwise the trial has a harness problem: it fails, and the run exits 1 so that
nobody takes its pass rate for a result about the server.

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
unused key either way. The graders pass on
`fixtures/defects/reference/` and fail on the untouched `mod/`; their tests run in public CI.

## The record

`records/scored/agent-use.json`, in the record format (records/README.md, "Scored records"):
the harness version, the model, the budget, the arguments, per trial the tool calls and errors,
which graders passed and what the checker still reports, and the pass rate per task. Each run
overwrites it; the history is git's. Unlike a suite's record it is not failed by a later spec,
since re-making it spends the login's usage.

## Tests

`tools/src/scored-run/*.test.ts` run in public CI with no model, key, network or display.
`server.test.ts` starts the built agent server exactly as a trial's configuration says, on a
fresh copy of the planted mod, and gets one `check` answer: the six tools, and the planted
defects at the manifest's lines. The run's tests start `fake-claude.ts` in Claude Code's place: it answers `--version`, records the
arguments and environment it was given, copies a folder over the trial's mod as an agent's edits
would, and plays back a stream written in the documented shape. No real session has been
recorded yet; the first real run's stream is the check of that shape.
