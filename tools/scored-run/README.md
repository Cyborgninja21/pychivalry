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

Three tests in public CI hold this: `tools/src/no-key-no-network.test.ts` (no shipped file names
a credential or a key, imports a networking module or calls `fetch`),
`tools/src/scored-run/run.test.ts` (the test session's environment holds no key or token
variable) and `tools/src/scored-run/no-model-call.test.ts` (the scripts of this test, its judge
among them, name no key and no model library, reach no network, and start no program but the
Claude Code the run names).

This page describes three scored scripts: the agent-use test (below), the scored authoring test
and the judge's calibration ([further down](#the-scored-authoring-test)).

A scored run tests whether an AI agent can really use pychivalry's agent server (docs/MVP.md,
"AI tests"; docs/PLAN.md, items 6.8 to 6.11). Each trial is one test session. A model's output is
not repeatable, so each task runs several times and the result is a pass rate. A run is started
by a person, or by an agent on the owner's word (docs/decisions.md, decision 80). The first test
sessions ran on the owner's word of 2026-11-23 (decision 81); what they showed is
[below](#the-first-test-sessions-item-611).

| File | What it is |
| --- | --- |
| [agent-use.prompt.md](agent-use.prompt.md) | The task given to the agent, word for word |
| `tools/src/scored-run/run.ts` | The run: the trials, Claude Code's arguments and environment, the record |
| `tools/src/scored-run/graders.ts` | The five graders |
| `tools/src/scored-run/stream.ts` | What is read from Claude Code's output stream |
| `tools/src/scored-run/scored-record.ts` | The record's shape and its consistency checks |
| `tools/src/scored-run/confinement.ts` | What every scored session may be offered, and the check that it was |
| `tools/src/scored-run/fake-claude.ts` | A stand-in for Claude Code, for the tests |
| [../../fixtures/defects/](../../fixtures/defects/README.md) | The planted-defect mod, its fixed copy and its manifest |
| [authoring.prompt.md](authoring.prompt.md) | The authoring task given to the agent, with the request in its slot |
| [judge.prompt.md](judge.prompt.md), [judge.schema.json](judge.schema.json) | The judge's prompt and the shape of its answer |
| `tools/src/scored-run/authoring.ts` | The authoring run: the trials, the skills, Claude Code's arguments, the grades, the record |
| `tools/src/scored-run/requests.ts`, `expectations.ts` | The request list, read and checked, and its expectations held against a result |
| `tools/src/scored-run/judge.ts` | The judge: its prompt filled, its session, its answer parsed |
| `tools/src/scored-run/authoring-record.ts` | The authoring record's shape, its measures and its consistency checks |
| `tools/src/scored-run/calibration.ts` | The judge's calibration against hand grades, and its record |
| [../../fixtures/requests/](../../fixtures/requests/README.md) | The content requests, their base mods and an example result of each |

## The agent-use task

The agent gets a copy of the planted-defect mod, `fixtures/defects/mod/`: 35 defects, every
check code that is an error or a warning at least once (the `style/` family's two warnings among
them since decision 110: a file not in pychivalry's format and a file not UTF-8, which the graders
count like the others), and 29 lines that look wrong and are not, in 17 files in pychivalry's
format but for the defects. Some defects need a lookup to fix, some interact (the obvious fix of one makes
another), and some are fixed away from the line the finding points at
([fixtures/defects/README.md](../../fixtures/defects/README.md#why-it-is-this-hard)); the mod
was made harder after item 6.11's first test sessions, which fixed the first one too easily to
tell a better agent server from a worse one (decision 83). The agent is told to fix every error
and warning with the pychivalry tools, changing nothing else. A trial passes when all five
graders pass and its harness held (below).

**The target** (the owner's, decision 82): every test session passes. A release run is 10 test
sessions and must pass all 10; a development run of 5 that passes fewer than 5 is looked into.
The record states each task's target and whether the run met it, and the run prints it last.

## Starting a run

```sh
SCORED_SESSION_LIMIT=3 task scored:agent-use
```

That runs 5 test sessions with the pinned model, one after the other: a development run.
`SCORED_TRIALS=10` makes it a release run. Each has two safety stops:
the session limit, which the script passes unchanged to Claude Code's own session-ending option
([below](#claude-codes-arguments)), and a time limit of 30 minutes, after which the script stops
the session. Claude Code checks its option after each model response, so a session can end one
response after the limit is reached. The agent server must be built first (`task build` builds
it; the task depends on it).

| Variable | Meaning | Default |
| --- | --- | --- |
| `SCORED_SESSION_LIMIT` | The session limit of each test session: a positive number, passed unchanged to Claude Code's session-ending option | none: it must be given |
| `SCORED_MODEL` | The model, by its full name (an alias such as `opus` is refused) | `claude-opus-5-5`, Opus 5.5 |
| `SCORED_TRIALS` | Test sessions per task: 5 in development, 10 before a release, where every one must pass (the target) | 5 |
| `SCORED_SERVER` | The agent server's entry point, from the repository root | `packages/mcp/dist/main.js` |
| `SCORED_SERVER_ARGS` | The server's arguments, a JSON list; `{mod}` is the trial's mod and `{game}` the game stub | `["--mod", "{mod}", "--vanilla", "{game}"]`, the server's own options |
| `SCORED_CLAUDE` | Claude Code's command; a `.js` or `.mjs` file is run with Node. The record's command says `SCORED_CLAUDE=<another Claude Code>` when it is not `claude` | `claude` |
| `SCORED_TIMEOUT_MINUTES` | A test session still running after this is stopped | 30 |
| `SCORED_KEEP` | `true` keeps the run's temporary folder: each trial's mod, output stream, error output and server configuration | removed |
| `SCORED_CONTINUE` | `true` adds this run's test sessions to the record already written, numbered after its own, and only when that record was made at the same commit (with no uncommitted change) with the same task, Claude Code version, model, session limit, time limit, arguments and agent server; otherwise the run stops before any test session and names what differs. A note in the record says which trials each run added | a new record |

**Which Claude Code.** The pinned model needs Claude Code 2.1.280 or later: an older one refuses
it before the session reaches the model (it says so, and the script reports the session's end as
a harness problem). Item 6.11 found the `claude` on the machine's path at 2.1.220, whose own
update had failed, and ran its test sessions with the Claude Code 2.1.330 that VS Code's Claude
Code extension had installed on the same machine, named by `SCORED_CLAUDE`.

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
   `CLAUDE_CODE_*`, `AI_AGENT`) and none of Claude Code's agent-server settings (`MCP_*`), so a
   run started from inside a session is not steered by it: item 6.11 found `AI_AGENT`,
   `MCP_CONNECTION_NONBLOCKING=true` (set by the host that started the surrounding session) and
   `MCP_DISCOVERY_CACHE` (from the person's own settings, which the surrounding session had
   applied) reaching the test session before this rule. It has
   `ENABLE_CLAUDEAI_MCP_SERVERS=false`, so the other agent servers Claude Code would offer from
   claude.ai are switched off; `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, so is its automatic memory;
   and `MCP_CONNECTION_NONBLOCKING=0`, so Claude Code waits for the agent server to connect
   before the session's first turn.
4. When the session ends, its output stream is read and the mod graded.

### Claude Code's arguments

The flags of item 6.8, checked on 2026-11-23 against `claude --help` of the installed Claude
Code, 2.1.220, and its documentation, and again against `--help` of Claude Code 2.1.330, which
ran item 6.11's test sessions (every flag below is there, with the same meaning):

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
| (not in the plan) | `--disable-slash-commands` | Leaves out the skills that come with Claude Code itself ("Disable all skills and commands"): item 6.11's first test session listed 16 at its start, none of them the user's |

Whether these keep everything else out is checked in every test session (below). Item 6.11's
test sessions settled the plan's open question: each start event offered only `Read`, `Edit` and
the six `mcp__pychivalry__` tools, only the `pychivalry` server (connected), no skill, no plugin
but Claude Code's own, and the output style `default`, where the developer's own settings name
another: the developer's settings were not read.

## What is read and recorded

From the output stream (`--output-format stream-json --verbose`, one JSON object per line):

- the session's start (`system`, `init`): the Claude Code version, the model, the permission
  mode, the tools and agent servers offered with their status, the skills offered and the
  plugins loaded (each by its source, such as `cc-plugin-telemetry@builtin`);
- each tool call (`tool_use` blocks), counted per tool, and each tool error (`tool_result` with
  `is_error`), with its text;
- the end (`result`): what ended it (by itself, at the session limit, at a turn limit, on an
  error), the turns, the time, the calls the permission mode refused. A session ended by itself
  only when its end is `success` and not an error: Claude Code ends a session that never reached
  the model with `subtype: "success"`, `is_error: true` and `terminal_reason: "api_error"`, as
  item 6.11's first test session did. Any other end is an error, named in the record by its
  subtype, its `terminal_reason` and the failed request's status; the session's own words on
  the error are printed for the person running the test, never recorded.

Nothing else is kept: not the session's text, not the tools' inputs and results, not the session
id, not any figure Claude Code reports about the session's use of the developer's plan, nothing
about how Claude Code is signed in. A tool error's text is kept with the trial's folders named
(`<trial mod>`) and any other absolute path replaced by `<path>`.

**The harness held** when the session ended by itself or at its session limit, its start shows
only `Read`, `Edit` and the `mcp__pychivalry__` tools, no skill, no plugin but Claude Code's own
(source `<name>@builtin`: they come with the program, as its built-in agents do, and offer no
tool), only the `pychivalry` server, and that server did not fail; a server already connected
at the start offers all six of its tools (one still starting, as Claude Code before 2.1.221 can
show it, offers none yet; with `MCP_CONNECTION_NONBLOCKING=0` every test session of item 6.11
started with it connected). Each test session checks its own confinement this way. Otherwise the
trial has a harness problem: it fails, and the run exits 1 so that nobody takes its pass rate for
a result about the server.

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
unused key either way. The graders judge a fix by the checker and the manifest's fix ranges,
never by equality with `fixtures/defects/reference/`, so any fix the checker accepts inside those
ranges passes: `liege` or `primary_title.holder` for the link a title needs, `capital_county`
around the county effect or `add_character_modifier` in its place. The graders pass on
`reference/` and fail on the untouched `mod/`; their tests, run in public CI, also show fixes
the reference does not use passing and the obvious fixes of the interacting defects failing.

## The record

`records/scored/agent-use.json`, in the record format (records/README.md, "Scored records"):
the harness version, the model, the session limit, the arguments, per trial the tool calls and
errors, which graders passed and what the checker still reports, and per task the pass rate, the
target and whether the run met it (`target`: `run`, release for 10 trials or more, else
development; `needs`, all the trials; `met`). Item 6.11's record was made before the target was
set and states none.
Each run overwrites it, unless `SCORED_CONTINUE=true` adds its trials to it; the history is
git's. Unlike a suite's record it is not failed by a later spec, since making it again means new
test sessions, which start only on the owner's word.

## Tests

`tools/src/scored-run/*.test.ts` run in public CI with no model, key, network or display.
`server.test.ts` starts the built agent server exactly as a trial's configuration says, on a
fresh copy of the planted mod, and gets one `check` answer: the six tools, the planted defects
at the manifest's lines, and the data that says what is valid at the scope and field findings. The run's tests start `fake-claude.ts` in Claude Code's place:
it answers `--version`, records the arguments it was given and the names of any key, token or
other credential variables it was given (there must be none), copies a folder over the trial's
mod as an agent's edits would, and plays back a stream in the shape Claude Code 2.1.330 wrote in
item 6.11's test sessions, scrubbed of identifiers, folders and figures; another test plays back
the whole stream of item 6.11's first test session, which never reached the model.

## The first test sessions (item 6.11)

On the owner's word of 2026-11-23 (docs/decisions.md, decision 81): five test sessions of the
agent-use task on the pinned model, `claude-opus-5-5`, each with session limit 3
(`SCORED_SESSION_LIMIT=3`), one first and then four more added to the same record
([`records/scored/agent-use.json`](../../records/scored/agent-use.json)). All five passed: **5 of
5, pass rate 1**. Seven test sessions were started in all: two repair sessions, which found
faults of the harness and are not in the record, then the five. The baseline is of the agent
server, the checks and the planted mod as merged; none of them was changed.

### The repair sessions

Before any test session, the trial's environment, worked out from inside a Claude Code session,
held three variables of that session: `AI_AGENT`, `MCP_CONNECTION_NONBLOCKING=true` and
`MCP_DISCOVERY_CACHE`. The script drops them now and sets `MCP_CONNECTION_NONBLOCKING=0`
([One trial](#one-trial)).

1. **Claude Code 2.1.220**, the `claude` on the machine's path (its own update had failed on
   2026-11-17). It refused the pinned model before the session reached it ("version 2.1.280 or
   newer is required") and still ended the session with `subtype: "success"`, beside
   `is_error: true`, `terminal_reason: "api_error"` and status 400. The script read the subtype
   alone and graded the untouched mod as if the session had run: a harness fault. Now any end
   that is not `success` without an error is a harness problem
   ([What is read and recorded](#what-is-read-and-recorded)). Its start event also listed 16
   skills that come with Claude Code (none of the user's), which `--disable-slash-commands` now
   keeps out. It showed the rest of the confinement holding: `Read`, `Edit` and the six tools
   only, the one server, connected, no plugin, and the output style `default`.
2. **Claude Code 2.1.330**, the copy VS Code's Claude Code extension had installed on the same
   machine (`SCORED_CLAUDE`). It ran properly: 38 tool calls in 57 seconds, and every grader
   passed. But the confinement check, as just written, tripped on two plugins that 2.1.330
   lists in every session, `cc-plugin-telemetry@builtin` and `cc-plugin-privacy@builtin`. They
   come with the program, as its built-in agents do, and offer no tool and no skill; the check
   now allows only such `@builtin` plugins and records them. A session whose confinement check
   tripped is a repair session by the owner's rule, so it is not one of the five.

### What every start event showed

Each of the five: Claude Code 2.1.330, the model `claude-opus-5-5`, the permission mode
`dontAsk`; the tools `Edit`, `Read` and the six `mcp__pychivalry__` tools, nothing else; one agent
server, `pychivalry`, already connected, so all six tools were there for the first turn; no
skill and no slash command; plugins only Claude Code's own (five in sessions 1 to 3, four in
sessions 4 and 5, where `cc-plugin-easel@builtin` was not loaded: the list is Claude Code's to
choose); its built-in agent types listed, which only the `Agent` tool reaches, and that tool was
not offered; and the output style `default`, where the developer's own settings name another,
so those settings were not read. Every `Read` and `Edit` of the five sessions named a file
inside the trial's mod (checked on the kept streams; the record keeps no tool input).

### The real stream against the assumed one

The parser's reading held: the start event, the `tool_use` blocks, the `tool_result` blocks with
`is_error`, and the end's `subtype`, `is_error`, `num_turns`, `duration_ms` and
`permission_denials` are where the documentation put them. What differed, now in the tests'
stand-in stream (scrubbed of identifiers, folders, texts and figures):

- the end of a session that never reached the model is `success` with `is_error: true` (above);
- each `assistant` event holds one content block, among them `thinking` blocks; a tool's result
  is a text, beside a structured copy (`tool_use_result`) and its permission decision
  (`tool_result_meta`);
- events the documentation did not show: `rate_limit_event` and `system` events of the subtype
  `thinking_tokens`, both ignored;
- the start event's plugins are objects with a name, a path and a source, and each agent server
  has a source;
- the end carries `terminal_reason` and further fields the record never keeps, among them one
  about how Claude Code is signed in; the tests now check that the record leaves it out.

### The results

| Session | Graders passed | Ended | Turns | Time | `check` | `lookup` | `explain_code` | `list_definitions` | `find_references` | `Read` | `Edit` | Tool errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 of 5 | by itself | 40 | 68 s | 2 | 1 | 1 | 0 | 0 | 14 | 21 | 0 |
| 2 | 5 of 5 | by itself | 39 | 57 s | 2 | 1 | 0 | 1 | 0 | 13 | 21 | 0 |
| 3 | 5 of 5 | by itself | 40 | 56 s | 2 | 1 | 0 | 0 (1 refused) | 1 | 13 | 21 | 1 |
| 4 | 5 of 5 | by itself | 39 | 61 s | 2 | 1 | 0 | 1 | 0 | 13 | 21 | 0 |
| 5 | 5 of 5 | by itself | 40 | 59 s | 2 | 1 | 1 | 0 (1 refused) | 0 | 13 | 21 | 1 |

Each grader passed in all five sessions: `zero-errors`, `defects-gone`, `only-planted-lines`,
`look-alikes-untouched` and `nothing-deleted`, 5 of 5 each. Every session ended by itself, with
the checker reporting nothing at all; none ended at its session limit or at the time limit, and
the permission mode refused no call. Each made 38 or 39 tool calls.

Every session worked the same way: one `check` with `min_severity` `warning`, which returned all
28 findings in one page; a `Read` of every one of the mod's 13 files; one `lookup` of the names it
meant to write (and in two sessions one `explain_code`); 21 edits; a second `check`, which
reported nothing; and a summary.

**The two tool errors.** Sessions 3 and 5 each called `list_definitions` by its bare name, as the
server's instructions write it, instead of `mcp__pychivalry__list_definitions`, and Claude Code
answered "No such tool available: list_definitions" (the call never reached the server). Both
calls asked for the interaction categories, in a batch of calls made together, while the session
was choosing a value for the missing `index`; neither session tried again: session 3 asked
`find_references` for `index` instead, and session 5 went on without it.

### Each planted defect

Of the first planted mod, which the harder one has replaced (decision 83). All 27 defects were
fixed in all five sessions, no look-alike was touched and nothing was deleted. Most fixes were
the same in every session. Where a session had to choose:

- `scope/wrong-scope-for-effect` (`add_county_modifier` in the character scope of the event):
  four sessions wrapped it in `capital_county = { ... }`, as the reference copy does; session 1
  changed it to `add_character_modifier`. The modifier, `harvest_bounty_modifier`, holds only
  character modifiers (`monthly_income_mult`, `stewardship`), and the mod adds it to characters
  elsewhere, so session 1's fix fits the modifier; the other four, like the reference copy, give a
  county a modifier made of character modifiers, which no check judges. The message, "Wrong
  scope for effect: character, expected landed_title", names neither the effect nor a way to the
  expected scope; the sessions looked up `capital_county` to be sure of it.
- `scope/link-on-wrong-scope` (`holder` in a character scope): all five wrote
  `primary_title.holder`, which leads from the character back to the character itself; the
  reference copy uses `liege`. The checker accepts both; which one the mod meant is its author's
  to say. The message, "Trying to use holder link on an invalid scope character", does not say
  which scope `holder` needs.
- `references/unknown-key` (`trigger_event` to `harvest.0020`, which no file defines): four
  sessions chose `harvest.0002`, one `harvest.0004`; both exist, and which was meant is unknown.
- `fields/missing-required-field` (an interaction category without `index`): the values 16, 16,
  20, 10 and 100. Every session looked for the values other categories use (`lookup` of `index`,
  `list_definitions` of the categories, `find_references` of `index`); the game stub defines no
  other category, so nothing guided the number. The message, "Invalid or undefined index for
  character interaction category 'interaction_category_harvest'", names the field, not what it
  takes.
- `localization/missing-key`: every session added the key, with a text of its own.
- `syntax/missing-value` (`add_piety =`): 10 in four sessions, 5 in one.
- `syntax/block-without-key`: the name `harvest_remove_bounty_effect` in three sessions,
  `harvest_remove_modifier_effect` in two.
- The defects the game reports away from their line (the bare value and the missing value at
  the token after them, the missing brace at its opening brace) were all fixed in the right
  place: each session had read every file first.
- One slip of layout, not of content: session 2 wrote `root.father ={`, a space lost.

### What this says about the agent server

Proposals, not changes: the baseline is of what is merged, so none was made with the sessions.
On the owner's word (decision 83) all five are done since, each as
[below](#what-was-done-with-them).

1. **The planted mod does not yet tell a better server from a worse one.** Every session fixed
   every defect in about a minute, reading each file once. For the pass rate to measure the
   server, the task needs defects whose fix needs a tool's answer: a scope that only a chain of
   links reaches, a value only the game defines, a name close to two others; more look-alikes
   inside the blocks a fix may rewrite; and a larger mod, so that reading every file is not the
   easy way.
2. **Scope findings could say the way out.** For `scope/wrong-scope-for-effect`,
   `scope/wrong-scope-for-trigger` and `scope/link-on-wrong-scope`, the finding's data (the
   game's message staying as it is) could name the effect, trigger or link, the scopes it takes,
   and the links that lead from the current scope to one of them, which the spec package holds.
   The sessions found `capital_county` and `primary_title` themselves; on a real mod the choice
   is less obvious.
3. **A required field could say what it takes.** For `fields/missing-required-field`, the
   finding's data could carry the field's value type and the values the base game uses, as
   `lookup` already gives them, so that a number is chosen from the game, not guessed.
4. **The instructions name the tools by their bare names.** In two of five sessions the agent
   called one by that name. A server cannot know a client's prefix, but its instructions could
   say that a client may show the tools under its own prefix, such as `mcp__pychivalry__check`.
5. **`explain_code` shows a per-place message with its placeholder** ("The %s is missing a
   field the spec package marks required."); it could say that the real message is the field's
   own. Minor: the session that asked went on unhindered.
6. No change is needed to the size of results: the first `check` (about 9,300 characters) and
   the largest `lookup` (about 13,700) fitted, and no session followed a cursor.

Outside the server: the reference copy's fix for `scope/wrong-scope-for-effect` gives a county a
modifier of character modifiers (above). Whether the game reports that is not established; if
it does, the reference copy and a check would follow, not this pull request.

### The target

The proposal was a release run of 10 test sessions passing at 9 or more (pass rate at least
0.9), and a development run of 5 below 4 looked into: five of five proves less than it looks,
since a pass rate as low as about 0.55 would still give 5 of 5 one time in twenty. **The
owner's answer (decision 82): every test session passes.** A release run of 10 must pass all 10;
a development run of 5 that passes fewer than 5 is looked into. The record states it
([The record](#the-record)).

### What was done with them

On the owner's word (decision 83), before step 7 continued:

1. **A harder planted mod.** 32 defects, every error and warning code at least once and four
   twice, 29 look-alikes, 17 files and 591 lines
   ([fixtures/defects/README.md](../../fixtures/defects/README.md#why-it-is-this-hard)):
   defects whose fix needs a lookup, defects that interact, and defects fixed away from the
   finding. The reference copy's fault is fixed: its county effect now adds
   `harvest_granary_modifier`, a modifier of county modifiers. No built check should have
   caught the fault: `names/modifier-outside-use-area` judges a modifier by the block it is
   written in, and part D7 of the spec package leaves the record body of `common/modifiers`
   unknown, since a static modifier's area is the area of the effect that applies it. A row for
   it is a question for the owner (docs/decisions.md, "Asked, awaiting the owner"); none is
   added.
2. **Scope findings say the way out.** Their data carries `links_from_scope`: the links, or
   chains of two, from the current scope to the scopes the effect, trigger or link takes
   (`capital_county`, `primary_title`, ...), at most 12, beside the keyword and those scopes.
3. **Field findings say what the field takes.** `fields/missing-required-field` and
   `fields/wrong-kind-of-value` carry the field's `value_type` and `values`, the values the
   base game writes (the interaction category's `index`: integer, 0 to 15). The command line's
   text shows both after the game's message.
4. **The instructions name the prefix.** A client may list the tools under its own prefix,
   `mcp__pychivalry__check` in Claude Code; the names in the instructions are the bare ones.
5. **Readable slots.** `explain_code` and `explain` show every message with named slots
   (`The <record> is missing a field the spec package marks required.`), never `%s` or `{}`.

With them: the size test's builder had noted the core's check slowing sharply on a name defined
in many files (100 files 0.3 s, 300 files 6 to 7.5 s). The check resolved a name once per
definition and compared every pair of its definitions each time; it now sorts them and resolves
a name once (300 files 0.09 s, 1,000 files 0.36 s). On the harder mod the first `check` (errors
and warnings) returns all 33 findings in one page of about 11,400 characters; on rice every
result stays under the limit (the largest 27,990 characters). The harder mod has not been run
by a test session yet.

## The scored authoring test

**In plain words.** The same kind of developer's test script as the agent-use test, never shipped
and never run by CI: it starts the Claude Code program already installed on the developer's
machine, as separate test sessions, with pychivalry's agent server and its skills, and asks each
to write new content for a mod; then it grades what each wrote. The grading has two parts. The
first is pychivalry's own checker. The second is the match to the request: part of it in code,
and the rest by a **judge**, which is one more test session of the same Claude Code, started the
same way, that reads the request and the result and answers a fixed set of questions. pychivalry
makes no model call of its own, gives no session credentials, and removes key and token
variables from every session's environment. Each test session, the judge's too, counts against
the developer's own Claude plan, so a run is started only on the owner's word (docs/PLAN.md,
items 9.4 to 9.6 and 9.8).

### The requests

The fixed list is `fixtures/requests/requests.json`: twelve requests, three each of events,
decisions, scripted effects and scripted triggers, one easy, one medium and one hard of each
([fixtures/requests/README.md](../../fixtures/requests/README.md)). Each names everything the
result must define; each relies only on names the spec package has, or the request's base mod
defines, which a test proves and the run checks again before it starts. Each holds what a correct
result must contain twice over: **expectations** checked in code (files, namespaces, definitions,
fields, names used, references that resolve, localization keys, base files left alone), and
**judged dimensions** for the rest, from one closed set: `effects-as-asked`,
`conditions-as-asked`, `scope-as-asked`, `text-as-asked` and `nothing-unasked`.

### Starting a run

```sh
SCORED_SESSION_LIMIT=3 CK3_GAME_PATH=<game dir> task scored:authoring
```

Every request, 5 trials each: for each trial one authoring test session and then one judge test
session. The variables of the agent-use test apply as they do there (`SCORED_SESSION_LIMIT`,
required with no default, `SCORED_MODEL`, `SCORED_TRIALS`, `SCORED_SERVER`,
`SCORED_SERVER_ARGS`, `SCORED_CLAUDE`, `SCORED_TIMEOUT_MINUTES`, `SCORED_KEEP`,
`SCORED_CONTINUE`), with these beside them:

| Variable | Meaning | Default |
| --- | --- | --- |
| `CK3_GAME_PATH` | The base game's `game` folder: the agent server, the checker and the expectations read it, as the game-file suites do | none: it must be given |
| `SCORED_REQUESTS` | The requests to run, by id, comma-separated | every request |
| `SCORED_SKILLS` | The skills folder, from the repository root: each folder holding a `SKILL.md` is a skill | `skills` (the three skills of item 9.1) |
| `SCORED_SKILLS_IN` | Where each session is given the skills: `project` or `config` ([below](#the-skills)) | `project` |
| `SCORED_JUDGE_MODEL` | The judge's model, by its full name | the authoring model |
| `SCORED_JUDGE_SESSION_LIMIT` | The session limit of each judge session | `SCORED_SESSION_LIMIT` |
| `SCORED_JUDGE_TIMEOUT_MINUTES` | A judge session still running after this is stopped | 10 |

`SCORED_TRIALS` is the number of trials of each request. With `SCORED_CONTINUE=true` the run adds
to the record already written, made the same way (the same commit, request list, prompts, judge,
skills, base mods, Claude Code version, models, session limits, time limits and arguments), and
brings each request named up to `SCORED_TRIALS` trials whose harness held.

**A harness problem stops the run.** A trial whose authoring or judge session broke, or was
offered more than the run allows, says nothing about pychivalry, and the trials after it would
most likely say as little while each still counted against the developer's plan. The run stops
after it, the record keeps it, and the run exits 1; once the fault is fixed, `SCORED_CONTINUE=true`
carries on. The record is written again after every trial, so a run stopped by hand keeps what it
did.

### One trial

1. The request's base mod (`fixtures/requests/bases/<base>/`) is copied into a fresh temporary
   folder, with no git history, and the skills beside it (below).
2. The base game's index is built once per run into the run's own cache folder before the first
   trial, so that no session waits for it; every trial's agent server loads it from there, as
   the checker does.
3. One authoring test session starts in the mod's folder with the request in
   [authoring.prompt.md](authoring.prompt.md), the agent server over `CK3_GAME_PATH`, and the
   arguments below. Its environment is an agent-use trial's.
4. **Grade one, validity:** pychivalry's checker on what the session left, over the same base
   game, with its defaults: the core's one runner, as every surface runs it. Three measures, each
   of its own: no error; no warning; and in pychivalry's format, no warning of the family
   `style/` (the owner's principle, decision 101). The errors and warnings are recorded by code.
5. **Grade two, the match to the request:** first each of the request's expectations, checked in
   code on the index the checker built (`expectations.ts`), each met or not with its reason; then
   the judge (below), on the result, when the authoring session's harness held.

### The skills

The three skills of `skills/` are given to every authoring session, each folder copied whole, as
"pychivalry: Set up for Claude Code" copies them, into a configuration folder of the trial's own,
never the developer's own:

- **`project`** (the default): `.claude/skills/` of the trial's mod, where Claude Code finds a
  project's skills, read with `--setting-sources project,local`. The session runs in the
  developer's Claude Code as it already runs: its own configuration folder is left as it is and
  none of its settings or skills are read.
- **`config`**: `skills/` of a temporary Claude Code configuration folder of the trial's own,
  named by `CLAUDE_CONFIG_DIR`, read with `--setting-sources user,project,local`: where the set-up
  puts them in a person's own folder. Claude Code keeps the developer's sign-in in its
  configuration folder on Linux and Windows, so a session given a temporary one starts without
  it, and ends on an error before any model is reached: a harness problem, which stops the run at
  its first trial. The script copies nothing from the developer's own folder into it.

The judge, the checker and the expectations never see the skills' folder.

### Claude Code's arguments

Those of an agent-use trial ([above](#claude-codes-arguments)), each for the reason given there,
with three differences:

| Argument | As given | Why |
| --- | --- | --- |
| `--tools`, `--allowedTools` | `Read,Edit,Write,Skill`, and the server's tools | An authoring session writes new files, which the agent-use task forbids, and loads a skill with Claude Code's `Skill` tool |
| `--disable-slash-commands` | left out | It switches every skill off, pychivalry's with Claude Code's own; no flag offers one set without the other |
| `--setting-sources` | `project,local`, or `user,project,local` with `SCORED_SKILLS_IN=config` | The second reads the temporary configuration folder's skills |

### The harness held (authoring)

As for an agent-use trial: the session ended by itself, at its session limit or at its turn
limit; its start offers only `Read`, `Edit`, `Write`, `Skill` and the `mcp__pychivalry__` tools,
the one server and no plugin but Claude Code's own; a connected server offers all its tools. Two
things differ. **The three pychivalry skills must be offered**, by name; other skills may be
there and are recorded, since leaving Claude Code's own skills out would leave pychivalry's out
too. **Every `Read`, `Edit` and `Write` names a file inside the trial's mod**, so that no session
reads an example result or anything else outside it; the files a session named outside are
printed for the person running the test and never recorded. And the session must leave the
skills unchanged.

### The judge

One test session per result, started as a child process of the same Claude Code exactly as the
trials are (`judge.ts`), in an empty folder of its own, with the trial's environment:

- **No tool, no agent server, no skill:** `--tools ""`, `--strict-mcp-config` with no
  configuration, `--disable-slash-commands`, `--setting-sources project,local`; its confinement
  check allows nothing at all, and a session that ends at its session limit or turn limit before
  answering is a harness problem.
- **Its whole prompt on standard input** (`-p` with no prompt argument), so that no result is
  bound by the length of a command line: [judge.prompt.md](judge.prompt.md) with its four slots
  filled, the request's id, its text, its questions (one per judged dimension), and the result,
  every file of the mod as the session left it, each marked as written, changed, removed or as
  given, with `\n` line breaks and no byte-order mark. A result over 200,000 characters is not
  judged, and its record says why.
- **Its answer, fixed:** one JSON object of the shape of [judge.schema.json](judge.schema.json):
  the request's id, and for each question `yes`, `no` or `cannot-tell` with a one-sentence
  reason. The parsing is fixed too: the session's last words, trimmed; if they are one fenced code
  block, its inside; JSON valid against the schema, about the request asked, answering exactly
  its questions. Anything else is recorded as **malformed**, with what was wrong, and nothing is
  guessed from it. The reasons are printed for the person running the test and never recorded.

`judge.test.ts` holds the prompt's slots, the schema's closed set, the material, and every rule of
the parsing, a malformed answer of each kind among them.

### The record

`records/scored/authoring.json`, suite `scored:authoring`, in the record format
([records/README.md](../../records/README.md#scored-records)): the task (the request list, both
prompts, the judge's schema, the base mods and the skills, each by its hash, where the skills were
given, the dimensions and the answers), the harness, the authoring and judge models, session
limits, time limits and arguments, the agent server; per trial what the agent-use record keeps of
the session, its validity, its expectations and the judge's state and answers; and per request
and over all, how many trials held and, of those, how many had no error, no warning, were in the
format, met every expectation, and how the judge answered each dimension. No figure about the
session's use of the developer's plan is kept, and there is no target: the owner sets the targets
from the first run (item 9.8). `task records:check` holds the record to its schema and its figures
to each other.

### Tests

`requests.test.ts`, `expectations.test.ts`, `judge.test.ts`, `authoring.test.ts`,
`calibration.test.ts` and `no-model-call.test.ts` run in public CI with no model, key, network or
display. The run's tests start `fake-claude.ts` in Claude Code's place: as an authoring session
it copies a request's example result into the trial's mod (or nothing, or a broken result) and
plays back a stream in the shape Claude Code 2.1.330 writes; as a judge it reads its prompt from
standard input and plays back an answer. They show a correct result graded valid with every
expectation met and the judge's answers recorded; an empty result and a broken one measured three
ways; a malformed judge recorded as such; an unconfined authoring session and an unconfined judge
each stopping the run; both places of the skills; the continued run; and the record's checks.

## The first scored authoring run (item 9.8)

Not run: it waits for the owner's word. What it is, exactly:

- **The command:**
  `SCORED_SESSION_LIMIT=3 CK3_GAME_PATH=<game dir> task scored:authoring`, from the repository
  root, on the machine with the game, after `task build` (the task builds first) and with Claude
  Code 2.1.280 or later (`SCORED_CLAUDE` names it, as item 6.11's run did).
- **What it does:** for each of the 12 requests, 5 trials; each trial one authoring test session
  of the pinned model, `claude-opus-5-5`, in a fresh copy of the request's base mod, with the
  agent server over the installed game and the three skills in the trial's own `.claude/skills/`,
  then one judge test session of the same model on what it wrote.
- **How many sessions:** at most **120 test sessions**: 60 authoring sessions and 60 judge
  sessions. Fewer if a harness problem stops it, after the trial that had one.
- **The session limit:** 3 for every session, the authoring sessions' and the judge's
  (`SCORED_JUDGE_SESSION_LIMIT` is not given, so it is the same); the time limits 30 minutes for
  an authoring session and 10 for a judge's.
- **What it leaves:** `records/scored/authoring.json`, committed, from which the owner sets the
  targets on the measures above.

## Calibrating the judge (item 9.6)

The judge is calibrated once against results graded by hand, and the agreement is recorded
(`calibration.ts`). Like the runs, it starts test sessions, one judge session per graded result,
and only on the owner's word:

```sh
SCORED_SESSION_LIMIT=3 SCORED_GRADES=<grades file> task scored:calibrate
```

**The hand grades** are one JSON file a person writes (`grades_format` 1): `about` (where the
results came from, how they were chosen), and `items`, each a `request` (its id), a `result` (the
folder of the mod as a session left it, from the grades file's own folder) and `grades`, the
person's answer to every question the request's judge is asked, and no other, from the judge's
closed set. Nothing in it names the person who graded.

```json
{
    "grades_format": 1,
    "about": "Results of the first scored authoring run, two per request, graded by hand.",
    "items": [
        {
            "request": "effect-reward",
            "result": "results/effect-reward-1",
            "grades": { "effects-as-asked": "yes", "nothing-unasked": "no" }
        }
    ]
}
```

**The procedure**, for the owner to start:

1. Make a run with `SCORED_KEEP=true`: it prints the folder its trials are kept in, each trial's
   mod in `<request>-<n>/mod/`.
2. Copy the results to grade into a folder beside a new grades file (several per request, good
   and bad ones), and grade each by hand on its request's questions, without reading the judge's
   answers first.
3. Run the command above. It checks the grades file against the requests before any session,
   then runs the judge once per result.

**The record**, `records/scored/calibration.json`, suite `scored:calibration`: the grades file by
its hash, the judge's prompt, schema, model, session limit and arguments, each item's hand grades
and the judge's answers with whether each agrees, and per dimension and over all: the grades, those
the judge answered, those it agreed with, the agreement (agreed over answered), how often the
person and the judge each said "cannot tell", and the full table of hand answer against judge
answer. A judge session with a harness problem stops it, as in the runs.
