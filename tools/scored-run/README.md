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

This page describes four scored scripts: the agent-use test (below), the scored authoring test,
the judge's calibration ([further down](#the-scored-authoring-test)) and the re-judging of kept
results ([Re-judging kept results](#re-judging-kept-results)), and one reading of a record that
starts no session, `task scored:targets` ([The targets](#the-targets-item-98)).

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
| `tools/src/scored-run/authoring-targets.ts` | The owner's targets, read from an authoring record's measures |
| `tools/src/scored-run/calibration.ts` | The judge's calibration against hand grades, and its record |
| `tools/src/scored-run/rejudge.ts` | The judge run again over a record's kept results, with no authoring session |
| [../../fixtures/requests/judge/](../../fixtures/requests/judge/README.md) | Hand-made, labelled cases of what the judge is given, each from a case a run found it getting wrong |
| [../../fixtures/requests/](../../fixtures/requests/README.md) | The content requests, their base mods and an example result of each |

## The agent-use task

The agent gets a copy of the planted-defect mod, `fixtures/defects/mod/`: 37 defects, every
check code that is an error or a warning at least once (`graphics/missing-file` since build step 10) (the `style/` family's two warnings among
them since decision 110: a file not in pychivalry's format and a file not UTF-8, which the graders
count like the others), and 30 lines that look wrong and are not, in 17 files in pychivalry's
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

The fixed list is `fixtures/requests/requests.json`: twenty-four requests, six each of events,
decisions, scripted effects and scripted triggers: one easy, one medium and one hard of each, the
twelve the first two runs were made on, and three **expert** ones of each, added after the second
run ([below](#the-expert-requests-decisions-131-and-132);
[fixtures/requests/README.md](../../fixtures/requests/README.md)). Each names everything the
result must define; each relies only on names the spec package has, or the request's base mod
defines, which a test proves and the run checks again before it starts; an expert request may
describe such a name in words instead of writing it, so that a session has to find it. Each holds
what a correct result must contain twice over: **expectations** checked in code (files,
namespaces, definitions and how many, fields, names used and the block they are used in,
references that resolve, localization keys, base files and base definitions left alone), and
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
| `SCORED_JUDGE_MODEL` | The judge's model, by its full name | `claude-fable-5-2`, Fable 5.2 (`PINNED_JUDGE_MODEL` in `run.ts`): another model than the one it judges, by the owner's answer of 2026-11-24 |
| `SCORED_JUDGE_SESSION_LIMIT` | The session limit of each judge session | `SCORED_SESSION_LIMIT` |
| `SCORED_JUDGE_TIMEOUT_MINUTES` | A judge session still running after this is stopped | 10 |
| `SCORED_RECORD` | The record the run writes, and with `SCORED_CONTINUE=true` the record it continues: a `.json` file directly in `records/scored/`, from the repository root; anywhere else is refused before any session. A run of some requests only is filed under its own name ([records/README.md](../../records/README.md#authoring-records-scoredauthoring)) | `records/scored/authoring.json` |

`SCORED_TRIALS` is the number of trials of each request. A run makes that many trials of each
request it names, and does not try a trial that did not hold again. With `SCORED_CONTINUE=true`
the run adds to the record already written, made the same way ([below](#continuing-a-run)), and
brings each request named up to `SCORED_TRIALS` trials whose harness held: a trial of the record
that did not hold is tried again there, numbered after the request's last.

### When a run stops

A trial whose authoring or judge session broke, was offered more than the run allows, or named a
file outside its mod **did not hold**: it says nothing reliable about pychivalry. It stays in the
record with its reasons, its result is graded, and it is judged when its authoring session ended
by itself; it is never counted as a success ([The targets](#the-targets-item-98)). Whether the
run goes on depends on whether the trials after it would say as little (`stop-rule.ts`). It
**stops** after a trial that did not hold when:

1. **a session was not set up as the run asks:** its start offered other tools, other agent
   servers or plugins, left out the pychivalry skills or the server's tools, showed the server
   failing to start, or the stream shows no start at all, for the authoring session or the
   judge's. Every trial after it would be set up the same way;
2. **it was the run's first trial and a session of it broke:** the authoring session did not end
   by itself (an error, the time limit, no result) or the judge's had a problem. A first trial
   that breaks is most likely the run's own set-up: a session given a temporary configuration
   folder with no sign-in ends on an error before any model is reached;
3. **it ended three trials in a row that did not hold**, whatever their reasons: something the
   trials share has most likely gone wrong.

Otherwise the run **carries on**: one session that ran to its end and once read outside its mod,
or one later session that broke, says nothing about the next session, which is a fresh one. The
rule reads the trials of the run itself, in the order made: a continued run's first trial is its
own first. A run that stopped, or that ends with a request it names short of `SCORED_TRIALS`
trials whose harness held, exits 1, and its last lines name why and which requests are short;
`SCORED_CONTINUE=true` carries on. The record is written again after every trial, so a run
stopped by hand keeps what it did.

Before the expert requests' development run (below) any trial that did not hold stopped the run;
that run stopped after its 14th trial, one session's single read of a game file outside its mod,
with every target met by the 13 before it.

### Continuing a run

`SCORED_CONTINUE=true` adds the run's trials to the record already written only when it was made
the same way: the same spec and game, and everything its results say a trial was made with (the
request list, both prompts, the judge's schema, the base mods and the skills, each by its hash;
`skills_in`; the Claude Code version; the models, session limits, time limits and arguments of
both kinds of session; the agent server). Otherwise the run stops before any test session and
names what differs.

**Its commit** is this checkout's, or an earlier one when nothing a trial is made or graded with
changed since (`continuation.ts`): git must show the record's commit to be an ancestor of this
checkout's, neither with an uncommitted change (beside `records/`), and every file that changed
between the two must be a document (`docs/`, any `.md` file), a record (`records/`), a CI workflow
(`.github/`), a test (`.test.ts`), or one of the run's own files: its loop and stop rule
(`authoring.ts`, `stop-rule.ts`), its record and the reading of the targets
(`authoring-record.ts`, `authoring-targets.ts`), this rule (`continuation.ts`), the stand-in and
the tests' helpers (`fake-claude.ts`, `authoring-testing.ts`), the command line that starts it
(`tools/src/cli.ts`) and `Taskfile.yml`. Anything else refuses the continuation and is named:
the agent server and the checker (`packages/`), the spec, the skills, the requests and their
bases, the harness's other files (the session's arguments and environment, the stream's reading,
the confinement check, the expectations, the judge), the dependencies. A fix of what a session
is given or of how a result is graded therefore starts a new record; a fix of how the run goes on
does not make the trials before it worthless.

`authoring.ts` is allowed although it holds a trial's own steps beside the run's loop: at the
commit of the record the rule was made for, the two are one file, and moving them apart would
itself be a change the rule must refuse. A continued record keeps the `tool` it was first made
with; a note names the commit each continuing run was made at and every file of code that changed
since the record's own, so that a continuation across commits is never silent.

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
  it, and ends on an error before any model is reached: a broken first trial, which stops the
  run. The script copies nothing from the developer's own folder into it.

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
printed for the person running the test and never recorded. A call counts whether it succeeded,
was refused or failed: a session that tried to read outside its mod did not hold, even when the
file did not exist. And the session must leave the skills unchanged. What counts as held is
unchanged since the first run; only what the run does after a trial that did not hold changed
([When a run stops](#when-a-run-stops)).

### The judge

One test session per result, started as a child process of the same Claude Code exactly as the
trials are (`judge.ts`), in an empty folder of its own, with the trial's environment:

- **No tool, no agent server, no skill:** `--tools ""`, `--strict-mcp-config` with no
  configuration, `--disable-slash-commands`, `--setting-sources project,local`; its confinement
  check allows nothing at all, and a session that ends at its session limit or turn limit before
  answering is a harness problem.
- **Its whole prompt on standard input** (`-p` with no prompt argument), so that no result is
  bound by the length of a command line: [judge.prompt.md](judge.prompt.md) with its six slots
  filled, the request's id, its text, its questions (one per judged dimension), the material from
  the installed game (below), and the result, every file of the mod as the session left it, each
  marked as written, changed, removed or as given, with `\n` line breaks and no byte-order mark. A
  result over 200,000 characters is not judged, and its record says why.
- **The material from the installed game** (`judgeMaterial`, since version 2 of the prompt), so
  that the judge is never the authority on whether a name exists or what it means: that is the
  checker's and the game's. **The checker's report**: what pychivalry's checker reports in the
  result over the installed game, by its version, every error and warning with its file, line and
  message (at most 50 shown, the rest counted), or that it reports none. **The keywords**: every
  trigger, effect, iterator and link the result's script files write, read in its place as the
  checker reads it (`readContext`: a key of a trigger or effect block, a link of a scope chain; a
  record's own fields, such as an event's `type` or `title`, and plain values are not keywords),
  each once, with its kind, the scopes the game supports it in and the game's own description,
  from the spec package (cut at 300 characters); and every such key the spec package lists as
  no longer in the game's version, with the version that removed it. The prompt tells the judge
  that the game changes from one version to the next, to take whether a name exists, what it
  means and which scope it works in from that material and never from its memory, that a name
  the list describes exists in the installed game and means what its line says whatever another
  version called it, that the game's acceptance of the files is the checker's to say, and to
  answer cannot-tell only when the files and the material do not settle the question.
- **Its answer, fixed:** one JSON object of the shape of [judge.schema.json](judge.schema.json):
  the request's id, and for each question `yes`, `no` or `cannot-tell` with a one-sentence
  reason. The parsing is fixed too: the session's last words, trimmed; if they are one fenced code
  block, its inside; JSON valid against the schema, about the request asked, answering exactly
  its questions. Anything else is recorded as **malformed**, with what was wrong, and nothing is
  guessed from it. The reasons are printed for the person running the test and never recorded.

`judge.test.ts` holds the prompt's slots, the schema's closed set, the material, and every rule of
the parsing, a malformed answer of each kind among them; and, word for word, what the judge is
given for the labelled case of [fixtures/requests/judge/](../../fixtures/requests/judge/README.md)
and for its first draft.

**Its version.** Each version of the prompt and of the material is a row of
`JUDGE_PROMPT_VERSIONS` (`judge.ts`), named in a record by the prompt's SHA-256
(`judge_prompt_sha256`). A test holds the committed prompt to the last row, and the material to the
labelled case, so a change to either is a new version. Version 1 (2026-11-24) gave the request,
its questions and the result, and left the judge to its own memory of the game; every committed
authoring record was judged with it. Version 2 (2026-11-25) adds the material from the installed
game. Records judged with different versions are never mixed or compared silently: a run
continuing a record refuses another prompt ([Continuing a run](#continuing-a-run)), and
`task scored:targets` names the version a record was judged with and says when it is not the
committed one.

### The record

`records/scored/authoring.json`, suite `scored:authoring`, in the record format
([records/README.md](../../records/README.md#scored-records)): the task (the request list, both
prompts, the judge's schema, the base mods and the skills, each by its hash, where the skills were
given, the dimensions and the answers), the harness, the authoring and judge models, session
limits, time limits and arguments, the agent server; per trial what the agent-use record keeps of
the session, its validity, its expectations and the judge's state and answers; and per request
and over all, how many trials held and, of those, how many had no error, no warning, were in the
format, met every expectation, and how the judge answered each dimension. No figure about the
session's use of the developer's plan is kept, and no target: the record states measures only,
and the owner's targets are read from them ([below](#the-targets-item-98)). `task records:check`
holds the record to its schema and its figures to each other. A trial whose harness did not hold
is in `trials` with its reasons, its grades and, when its authoring session ended by itself, its
judge's answers; the measures per request and over all count it in `trials` only.

Each run of the whole list writes `records/scored/authoring.json`, the latest run. When a run
replaces it, the record it replaces is kept beside it, unchanged, as `authoring-run-<n>.json`,
`<n>` its run's number: the first run's is `records/scored/authoring-run-1.json` and the second's
`records/scored/authoring-run-2.json`, so that their measures stay readable without git's history;
`authoring.json` is the third preview's release run
([below](#the-third-previews-release-run-decision-132)). A run of some requests only never
replaces it: it is filed beside it under a name of its own (`SCORED_RECORD`;
[records/README.md](../../records/README.md#authoring-records-scoredauthoring)), as the expert
requests' development runs are, `authoring-expert-run-1.json` and `authoring-expert-run-2.json`.

### Tests

`requests.test.ts`, `expectations.test.ts`, `repair.test.ts`, `judge.test.ts`,
`authoring.test.ts`, `authoring-targets.test.ts`, `stop-rule.test.ts`, `continuation.test.ts`,
`calibration.test.ts`, `rejudge.test.ts` and `no-model-call.test.ts` run in public CI with no model, key, network or
display. The run's tests start `fake-claude.ts` in Claude Code's place: as an authoring session
it copies a request's example result into the trial's mod (or nothing, or a broken result) and
plays back a stream in the shape Claude Code 2.1.330 writes, the same for every trial or, named by
`FAKE_CLAUDE_STREAMS`, one of its own for a given trial; as a judge it reads its prompt from
standard input and plays back an answer. They show a correct result graded valid with every
expectation met and the judge's answers recorded; an empty result and a broken one measured three
ways; a malformed judge recorded as such; an unconfined authoring session and an unconfined judge
each stopping the run; a session that reads a game file outside its mod, as the development run's
did, recorded as not held, graded and judged, the run carrying on; a broken first trial stopping
the run, a broken later one alone not, and three in a row stopping it; both places of the skills;
the continued run, from a record ending on a trial that did not hold (its request tried again,
numbered after it, the requests not yet run after it), and from a record made at an earlier
commit (accepted when only the run's own files changed, refused naming the files when what a
trial is made with changed); `SCORED_RECORD`; and the record's checks. `stop-rule.test.ts` holds
the stop rule case by case and `continuation.test.ts` which files may change, each refusal, and
the repository's git on a repository of its own. `authoring-targets.test.ts` reads the targets at
their thresholds (95% met by 57 of 60 and 19 of 20, not by 56 of 60 or 18 of 20; every result
means every one), from the committed first run's record, from the release run's (a release run,
every target met with and without the expert requests), with and without the expert requests,
and from a record that lacks requests of the list; a trial that did not hold counted against
each part its own result fails, and for nothing when its result is clean or a session of it
broke, never raising a rate; a release run needing 10 trials that held of each request; and it
refuses a record whose figures disagree. `requests.test.ts` holds each expert request's first
draft to the reason it fails, and `repair.test.ts` shows the built agent server reporting the
eight drafts' errors and warnings and none once each is repaired.

### The targets (item 9.8)

Set by the owner on 2026-11-24 from the first run's record (docs/decisions.md, decision 127).
They are strict, and they hold before any release:

| Target | Measure | Needs |
| --- | --- | --- |
| No error | Results with no error | 100% |
| No warning, in the format | Results with no warning, and results in pychivalry's format (no `style/` warning) | 100% each |
| Every expectation | Results meeting every expectation checked in code | at least 95% |
| Judged | Each judged dimension: its yes over every question of it the judge was asked | at least 95% each |

Every rate is over the trials whose harness held, as every measure of the record is. A judged
dimension's no, cannot tell, malformed or missing answer counts against it, and a target with
nothing to measure is not met. A run before a release is 10 trials whose harness held of each
request (docs/MVP.md, "Repetitions"); a run of 5 is a development run, read against the same
targets.

**A trial that did not hold never improves a score.** It is never counted as a success. When its
authoring session ended by itself (it finished, or reached its session or turn limit), its result
is a real result the tools and the skills led to, graded and judged like any other: each target
part its own grades fail (an error, a warning, out of the format, an expectation not met, a judged
no or cannot tell) counts it against that part, added to what the part is over and not to what
meets it. Its result clean, it counts for nothing, the trials that held deciding. When a session
of it broke (an error, the time limit, no result, or a judge's session that did not answer), its
result says nothing either way and it counts for nothing. Leaving every trial that did not hold
out, as the record's measures do, would let a session that failed and strayed vanish from the
score; counting every one as a failure would let one outage of the developer's Claude Code make a
release run's 100% targets unreachable for good. Either way the reading names each trial that did
not hold, why, and what it counts against, a part with one says so, and a run continuing the
record tries its request again. The reading of a record whose every trial held says so in one
line.

**The record holds measures only.** The targets are never written into it, so a record made before
they were set and one made after are read the same way (`authoring-targets.ts`). The run prints
the reading when it ends, each target met or not. `task scored:targets` reads it from a record
without starting any session: the committed `records/scored/authoring.json`, or the one
`SCORED_RECORD` names; it exits 1 when a target is not met.

**With and without the expert requests.** The reading over every request of the record decides
whether the targets are met. When a record has trials of the expert requests and of the others,
the same targets are read a second time over the others alone, summed from the record's measures
per request, which add up to its measures over all (a test holds it on the committed records); a
record of one kind only is read once. A record is read against the committed request list: one
made before the expert requests were added, as the first two runs' records were, has no trial of
them, so it is read over the twelve requests it has, and its reading names the twelve it lacks
first. A record that lacks any request of the list is a development run whatever its trials: a
release run covers the whole list.

```sh
task scored:targets
SCORED_RECORD=records/scored/authoring-run-1.json task scored:targets
```

| Run | No error | No warning, in the format | Every expectation | Judged (lowest dimension) | Targets met |
| --- | --- | --- | --- | --- | --- |
| First, 2026-11-24 (`authoring-run-1.json`) | 50 of 60 (83.3%): not met | 0 of 60, 0 of 60: not met | 58 of 60 (96.7%): met | 100%: met | 2 of 4 |
| Second, 2026-11-24 (`authoring-run-2.json`) | 60 of 60: met | 60 of 60, 60 of 60: met | 60 of 60: met | 100%: met | 4 of 4 |
| Expert requests' development run, 2026-11-25 (`authoring-expert-run-1.json`) | 60 of 60: met | 60 of 60, 60 of 60: met | 60 of 60: met | 94.5% (`conditions-as-asked` 52 of 55): not met | 3 of 4 |
| The same judged again with version 2, 2026-11-25 (`authoring-expert-run-1-judge-2.json`) | 60 of 60: met | 60 of 60, 60 of 60: met | 60 of 60: met | 100%: met | 4 of 4 |
| Expert requests' second development run, 2026-11-26 (`authoring-expert-run-2.json`) | 60 of 60: met | 60 of 60, 60 of 60: met | 60 of 60: met | 100%: met | 4 of 4 |
| **Release run**, 2026-11-26 (`authoring.json`), every request 10 times | 240 of 240: met | 240 of 240, 240 of 240: met | 240 of 240: met | 100%: met | 4 of 4, and 4 of 4 without the expert requests |

The first three records of the table were judged with version 1 of the judge's prompt, and their
readings say so ([The judge](#the-judge)): the expert run's one target not met is that judge's,
wrong on the game's names ([below](#trigger-loyal-realm-the-judge-was-wrong-from-its-memory-of-the-game));
the last three with version 2. Only the release run is a release run: the others are development
runs, and the sessions of the first four were given tool schema version 3 or earlier, which their
readings say first.

## The first scored authoring run (item 9.8)

Made on the owner's word of 2026-11-24, the whole run at once, with no shake-down first, from
the main clone at the merge of #152:
`SCORED_MODEL=claude-opus-5-5 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<another Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring`,
with Claude Code 2.1.330 (the copy VS Code's Claude Code extension installed) and the base game
1.21.0.3. Every request, 5 trials each: 60 authoring test sessions of Opus 5.5 and 60 judge test
sessions of Fable 5.2, **120 test sessions**, each with session limit 3. No harness problem
stopped it. Its record, as the run wrote it, is kept since the second run as
[`records/scored/authoring-run-1.json`](../../records/scored/authoring-run-1.json); the run kept
no trial's files (`SCORED_KEEP` was not set).

### The results

| Request | Type | Difficulty | Held | No error | No warning | In the format | Every expectation | Judge: yes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `event-merchant-debt` | event | easy | 5 of 5 | 5 | 0 | 0 | 5 | 15 of 15 |
| `event-sleepless-night` | event | medium | 5 of 5 | 5 | 0 | 0 | 5 | 15 of 15 |
| `event-letter-from-spouse` | event | hard | 5 of 5 | 5 | 0 | 0 | 3 | 20 of 20 |
| `decision-give-alms` | decision | easy | 5 of 5 | 5 | 0 | 0 | 5 | 15 of 15 |
| `decision-night-vigil` | decision | medium | 5 of 5 | 5 | 0 | 0 | 5 | 15 of 15 |
| `decision-hold-feast` (retired) | decision | hard | 5 of 5 | 0 | 0 | 0 | 5 | 20 of 20 |
| `effect-reward` | scripted effect | easy | 5 of 5 | 5 | 0 | 0 | 5 | 10 of 10 |
| `effect-war-chest` | scripted effect | medium | 5 of 5 | 5 | 0 | 0 | 5 | 15 of 15 |
| `effect-children-gift` | scripted effect | hard | 5 of 5 | 5 | 0 | 0 | 5 | 20 of 20 |
| `trigger-can-host` | scripted trigger | easy | 5 of 5 | 5 | 0 | 0 | 5 | 10 of 10 |
| `trigger-family-ready` | scripted trigger | medium | 5 of 5 | 5 | 0 | 0 | 5 | 10 of 10 |
| `trigger-feast-guest` (retired) | scripted trigger | hard | 5 of 5 | 0 | 0 | 0 | 5 | 15 of 15 |
| **All** | | | **60 of 60** | **50** | **0** | **0** | **58** | **180 of 180** |

By kind of content: events 15 without an error, 13 meeting every expectation; decisions 10 and
15; scripted effects 15 and 15; scripted triggers 10 and 15. Every warning was
`style/not-formatted`, one for each file a session wrote (1 to 3 a trial); the only error was
`definitions/clash`, once in each trial of the two requests now retired. The judge answered every
question of every trial, none malformed, never `no` or `cannot-tell`.

Every session ended by itself, in 11 to 23 turns and 19 to 42 seconds; the permission mode
refused nothing. Over the 60: `Skill` 60 calls (once each), `check` 231 (2 to 7 a session),
`lookup` 97, `format` 59 (in 42 sessions), `find_definition` 54, `explain_code` 2,
`list_definitions` 1; `Write` 217, `Edit` 47, `Read` 8. The tool errors: 31 `Edit`s refused
because their two strings were the same (below), 7 `lookup`s given a cursor with other
arguments, 10 calls of a server tool by its bare name (`lookup` 4, `find_definition` 4, `check`
2) and one of `mcp__pychivalry__Read`, none of which exist.

### What it proved about real sessions

Four things the tests could only assume, each now seen in all 60 trials:

1. **Project skills are offered** under `--setting-sources project,local`: every start event
   listed the three pychivalry skills from the trial's `.claude/skills/`, beside the 21 that come
   with Claude Code, and none of the developer's own.
2. **The skill tool is `Skill`**: offered in every session and called once in each, with no
   error.
3. **The judge's prompt on standard input, with no tool**: every judge session ran with `-p`, no
   prompt argument and `--tools ""`, offered nothing (its confinement held), and ended by itself
   in one turn (2 to 7 seconds).
4. **The judge's answer shape**: all 60 answers were one JSON object valid against
   `judge.schema.json`, about the request asked and answering exactly its questions, under the
   fixed parsing rules: 180 answers, none malformed.

### Why no result was in the format

The authoring skill told every session to format what it wrote and to count
`style/not-formatted` as an error. No session could, whatever it did:

1. **`format` only proposes.** It returns the formatted text and writes nothing (items 6.5 and
   8.9; `format.test.ts`). 42 sessions called it, 59 times.
2. **Claude Code's own file tools cannot be relied on to write Windows line breaks.** Read in the
   shipped code of Claude Code 2.1.330, the release the run used: `Write` saves the text exactly
   as the model sends it, adding a byte-order mark only when the file it replaces had one; `Edit`
   reads a file with its `\r\n` turned into `\n`, changes it, and writes it back with the line
   break it found in the file, and refuses an edit whose two strings are the same ("No changes
   to make: old_string and new_string are exactly the same."). A new file therefore gets Windows
   line breaks only if the model itself sends carriage returns, and `Edit` never changes a
   file's line breaks. The 31 refused `Edit`s are sessions trying to apply `format`'s text,
   which differed from the file only in line breaks the model's own text does not carry.
3. **What the results held**, from the record's counts and a reproduction on an example result:
   a file with `\n` line breaks and the byte-order mark gives one `style/not-formatted` and one
   hint, `style/line-endings`; without the mark it also gives `style/byte-order-mark`, and a
   localization file without it also gives `localization/missing-key` for each of its keys. No
   trial had a `localization/missing-key`, and each had one hint a file (one more in five
   trials): the sessions wrote the mark, as the skill said, but `\n` line breaks.
4. **No terminal.** A trial offers `Read`, `Edit`, `Write`, `Skill` and the server's tools; the
   skill's other way, `pychivalry format <file>` "when pychivalry runs in a terminal you can
   use", was out of reach.
5. **`check` did say so.** Its totals count every finding by code whatever is listed, so
   `style/not-formatted` is in every answer; with `min_severity` `warning`, as the skill's rule 3
   asks, it is listed too (by default only errors are). Every session checked 2 to 7 times. The
   record keeps no tool input, so which sessions asked for warnings is not known.

### Why two requests had an error in every trial

`decision-hold-feast` and `trigger-feast-guest` started from the base `feast`, whose event is
`feast.0001`. The base game defines an event of that id too
(`events/activities/feast_activity/feast_events.txt`), at the same override priority: the
game's own error, `definitions/clash`. The base alone, copied untouched, gives it over the
installed game; so do both requests' example results, and a minimal result that adds one
unrelated scripted trigger. The checker indexes the base once (the other definition is the
game's). The sessions wrote nothing that caused it, and could not remove it: one request forbade
changing the mod's files, and the other asked for that very event to be changed, not renamed.
The request tests check each base over an empty game, which cannot see a name the game defines.

### The on-action expectation

Two trials of `event-letter-from-spouse` (1 and 4) missed the expectation
"`yearly_playable_pulse` uses `authoring_letter.0001`": they hooked the event in through an
on-action of their own, `yearly_playable_pulse = { on_actions = { <theirs> } }` and
`<theirs> = { events = { authoring_letter.0001 } }`. The game's own documentation,
`common/on_action/_on_actions.info`, says an on-action "can fire other on_actions, following the
same rules as with events" and gives exactly this as the way a mod appends to one of the game's
on-actions without overriding a file; the base game hooks its own content into
`yearly_playable_pulse` the same way (its `on_actions` list there names several on-actions of
its own). The result does what the request asks: the expectation was too strict, and the judge,
who answered "comes through the yearly on-action" yes in both, was right. A hand-made result of
that shape gives the checker nothing at all over the installed game.

### What the judge's 180 yes show

That the judge answered, in the right shape, about what was asked, and that its answers agree
with everything the code could check: the two trials whose expectation failed are ones the judge
was right about. Its question on `conditions-as-asked` ("Does the first event come through the
yearly on-action...?") is the same question as the failed expectation, and its reasons (printed,
not recorded) named the on-action of the session's own. What they do not show is that the judge
can say `no` or `cannot-tell`: as far as the code and the expectations can tell, no result was
wrong on a judged question, so there was nothing to say no to, and a judge that always said yes
would have scored the same. Only results graded by hand, wrong ones among them, can tell the
two apart: the calibration (item 9.6). The judge is shown the files with `\n` line breaks and no
byte-order mark, so the format is the checker's to measure, never the judge's.

### What was done with it

As fixes of pychivalry's own harness, tools and skills, each with tests that need no model; the
record's measures are left as the run made them:

1. **`apply_format`**, a tool of the agent server that writes one file of the mod in the format,
   as `pychivalry format <file>` does ([docs/guide/agent-server.md](../../docs/guide/agent-server.md#the-tools)),
   and the write-content and fix-error skills run it on each file they wrote or changed instead
   of writing `format`'s text back. It is the server's one tool that writes, declared not
   read-only: a choice the owner confirmed on 2026-11-24 (decision 126), since the server wrote
   nothing before.
2. **A clean base.** `decision-hold-feast` and `trigger-feast-guest` are retired and replaced by
   `decision-hold-banquet` and `trigger-banquet-guest`, the same requests on a base `banquet`
   whose names the game does not have; a retired id is never used again
   ([fixtures/requests/README.md](../../fixtures/requests/README.md#retired-requests)). The run
   now refuses to start any test session while a base it would use has an error or a warning
   over the installed game, as `feast` had.
3. **The on-action expectation corrected**: an expectation may follow records of the mod in a
   named database (`through`), and `event-letter-from-spouse`'s does, through the mod's
   on-actions. The record's two trials stay as measured on the old list (its
   `requests_sha256`).
4. **Fable 5.2 judges** unless `SCORED_JUDGE_MODEL` names another, in the run and the
   calibration, by the owner's answer.
5. **A calibration that can be run now**: ten hand-made results and a sheet for the owner
   ([docs/guide/judge-calibration.md](../../docs/guide/judge-calibration.md)).

Not changed, as findings for the owner: every session met every expectation it could (bar the
two above) in about half a minute, much as item 6.11's first planted mod was fixed too easily;
the requests may need to be harder before their rates tell a better server from a worse one.

## The second scored authoring run (item 9.8)

Made on the owner's word of 2026-11-24 (docs/decisions.md, decision 128), the whole run at once,
to measure the first run's fixes, from the main clone at the merge of #153:
`SCORED_KEEP=true SCORED_MODEL=claude-opus-5-5 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<another Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring`,
with Claude Code 2.1.330 and the base game 1.21.0.3. Every request of the corrected list, 5 trials
each: 60 authoring test sessions of Opus 5.5 and 60 judge test sessions of Fable 5.2, **120 test
sessions**, each with session limit 3. No harness problem stopped it. The record, committed as
`records/scored/authoring.json` and kept since the release run as
[`records/scored/authoring-run-2.json`](../../records/scored/authoring-run-2.json), is as the run
wrote it (its last note still says no target is set: it was made at the commit before the
targets). The run
kept every trial's files; one result of each request is committed for the calibration
([below](#calibrating-the-judge-item-96)), and nothing else of them.

### The results

| Request | Type | Difficulty | Held | No error | No warning | In the format | Every expectation | Judge: yes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `event-merchant-debt` | event | easy | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `event-sleepless-night` | event | medium | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `event-letter-from-spouse` | event | hard | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `decision-give-alms` | decision | easy | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `decision-night-vigil` | decision | medium | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `decision-hold-banquet` | decision | hard | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `effect-reward` | scripted effect | easy | 5 of 5 | 5 | 5 | 5 | 5 | 10 of 10 |
| `effect-war-chest` | scripted effect | medium | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `effect-children-gift` | scripted effect | hard | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `trigger-can-host` | scripted trigger | easy | 5 of 5 | 5 | 5 | 5 | 5 | 10 of 10 |
| `trigger-family-ready` | scripted trigger | medium | 5 of 5 | 5 | 5 | 5 | 5 | 10 of 10 |
| `trigger-banquet-guest` | scripted trigger | hard | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| **All** | | | **60 of 60** | **60** | **60** | **60** | **60** | **180 of 180** |

Against the owner's targets, every one is met, as a development run of 5 trials a request
([The targets](#the-targets-item-98)). The judge answered every question of every trial, none
malformed, never `no` or `cannot-tell`. Nine trials, all of decision requests, ended with advice
the targets do not count: 8 hints and 4 information findings in all.

### What the kept trials show

Read from the record and from the trials the run kept (each session's output stream), with no
model; the trials' files are not committed beyond the twelve results of the calibration.

1. **`apply_format` did what the first run could not.** Every session called it, 110 times in
   all (1 to 4 a session): 104 calls wrote a file in the format and 6 found the file already in
   it; none was refused. `format`, the read-only proposal, was not called once (59 times in the
   first run), and no `Edit` was refused (31 in the first run, each trying to write `format`'s
   text back). Every result is in the format.
2. **Every session checked, and no check after writing found an error or a warning.** `check`
   146 times, 1 to 4 a session; 59 sessions checked the base mod once before writing anything,
   and every session checked again after writing, 1 to 3 times. No check a session made after
   writing reported an error or a warning, in any of the 60.
3. **Rounds, against the five-round stop rule:** no session needed a round of repair for an error
   or a warning. Four (`decision-hold-banquet` 2 and 3, `decision-night-vigil` 2 and 4) rewrote
   their decision once after the hint `style/unusual-field-order` and checked again; the others
   wrote once. The stop rule was never approached, so this run does not show the skill's repair
   loop at work on an error.
4. **Tool errors: 17, none a fault of the server.** 13 calls of a server tool by
   its bare name (`check` 4, `lookup` 4, `find_definition` 5), all in 4 of the 5
   `trigger-banquet-guest` sessions, which Claude Code answered "No such tool available" without
   reaching the server; and 4 `lookup` calls given a cursor with other arguments (one in each of
   `effect-war-chest` 5, `trigger-can-host` 4 and 5, `trigger-family-ready` 3), which the server
   refused, saying to repeat the arguments of the call that gave it or to leave it out. **No
   permission denial** in any session.
5. **The calls.** `Skill` 60 (once each), `Write` 105, `apply_format` 110, `check` 146, `lookup`
   95, `find_definition` 61, `find_references` 1, `Read` 8, `Edit` 6. Every session ended by
   itself, in 8 to 18 turns and 10 to 29 seconds (the first run: 11 to 23 turns, 19 to 42
   seconds); every judge session in one turn, 2 to 6 seconds.

### What it does and does not show

Every measure is at its ceiling, on the coded side and the judged side, and every target is met.
What that shows: the first run's three faults are fixed as far as these requests can tell (no
result out of the format, no clash in a base, the on-action expectation as the game documents
it), and on these twelve requests, Opus 5.5 with the skills and the agent server writes content
the checker finds nothing in, meeting every expectation, every time it was asked.

What it does not show:

1. **That the test can tell a better server or skill from a worse one.** A measure at its ceiling
   has no room to show either getting worse or better. The requests are twelve, written for this
   test by the same work that wrote the skill, each naming every name the result must define;
   nothing harder was tried. The first run's sessions met every expectation they could too (bar
   the two the corrected expectation failed): the faults it found were pychivalry's own, not the
   model's.
2. **More than one model.** Opus 5.5 wrote every result and Fable 5.2 judged every one; the
   results say nothing of another model, of VS Code's AI (the hand checklist's to see), or of the
   game loading the content (step 11's third measure, the in-game load: built and guarded, not
   run, [docs/game-log-capture.md](../../docs/game-log-capture.md#the-in-game-load)).
3. **That the judge can say no.** It said yes to all 180 questions here, as to all 180 in the
   first run. Nothing found a result wrong for it to say no to; only results graded by hand,
   wrong ones among them, can show the difference: the calibration (item 9.6).
4. **The repair loop.** No session had an error or a warning to repair (above).
5. **A release run.** 5 trials of each request, not the 10 of a run before a release.

The owner's answer (docs/decisions.md, decisions 131 and 132): harder requests are added now,
before the third preview ([below](#the-expert-requests-decisions-131-and-132)), and the third
preview's release run is made once, when the request list is final.

## The expert requests (decisions 131 and 132)

On the owner's word of 2026-11-24 (decision 131), harder requests were added before the third
preview, because both runs were at the ceiling: no session's check after writing found an error
or a warning, so the skill's repair loop and its five-round stop rule were never exercised, and
the judge never said no. Twelve were added, three of each type, at a new difficulty level,
`expert`, after the twelve the runs were made on, which are unchanged. Each sets a trap of a kind
that matters to a modder and that the game files ground, and each can be met with what the spec
package and the game define: its example result, in the format, has nothing the checker reports
over an empty base game and over the installed game 1.21.0.3, and meets every expectation.

| Request | What makes it hard | The first draft's mistake | Caught by |
| --- | --- | --- | --- |
| `event-granary-inspection` | A new event of the base's namespace in a new file; the base's effect found from its description and run on each adult vassal; the base's event changed in place to fire it | The new file does not declare the namespace again | checker: `structure/event-undeclared-namespace` |
| `event-envoy-chain` | A trigger, an effect and two events that must agree; a courtier saved in one event and used in the other | The effect run on the character, not on the saved courtier | expectation: the effect inside `scope:envoy` |
| `event-county-unrest` | A county of the sub-realm picked and saved; the county's opinion of its holder, renamed in 1.21.0.3, described in words | `county_opinion`, `add_county_opinion` | checker: `names/unknown-trigger` 2, `names/unknown-effect`; expectations |
| `decision-fund-granaries` | The base's trigger and two effects, only described, to find and use | Names guessed from the description | checker: `names/unknown-trigger`, `names/unknown-effect`; expectations |
| `decision-pardon-prisoners` | Being at peace and setting free described in words; the prisoners' iterator | `is_at_peace`, `release_prisoner` | checker: `names/unknown-trigger`, `names/unknown-effect`; expectations |
| `decision-house-feast` | The house's power score (renamed in 1.21.0.3) and its members, in the house's scope; an event too | `house_power`; the members walked from the character | checker: `names/unknown-trigger`, `scope/wrong-scope-for-effect`; expectations |
| `effect-realm-relief` | Counties changed in their own scope, gold to each county's holder (the link not named), prestige once | Gold given in the county's scope | checker: `scope/wrong-scope-for-effect`; expectations |
| `effect-granary-gift-edit` | One of three effects in a file changed in place; the other two and every other file left byte for byte | The effect written again in a new file, overriding the base's | expectation: defined once |
| `effect-heir-household` | The heir's own siblings, reached from the heir | The siblings walked from the ruler | expectation: `every_sibling` inside `primary_heir` |
| `trigger-loyal-realm` | Three counties meeting two conditions together, one renamed in 1.21.0.3 | `county_opinion` | checker: `names/unknown-trigger`; expectation |
| `trigger-granary-patron` | The base's two triggers, only described, one on the character and one on vassals | The triggers' conditions written again | expectations: both triggers used |
| `trigger-settled-ruler` | At peace, married, adult children, said in words; the heir in its own scope | `is_at_peace`, `has_spouse` | checker: `names/unknown-trigger` 2; expectations |

Three extensions of the request format carry them, each because code could not otherwise check
what the request asks: a relied-on name may be `unnamed`, described in words and absent from the
text (a test holds it so), and proved to exist like any other; an expectation `uses` or `resolves`
may say `within`, the key of a block it must be used inside, at any depth (an iterator, a link, a
saved scope, a field), which is how code tells the scope an effect or a condition is written in; a
definition may be required `count` times (`1`: changed in place, not defined a second time); and a
new kind, `kept`, holds a definition of the base byte for byte in a file the request changes
elsewhere. The closed set of judged dimensions is unchanged: the five cover what these requests
ask. The new base, `granary` (an event, three scripted effects, two scripted triggers, their
localization), has no finding over an empty base game or over the installed game, and the run's
own guard (`baseProblems`) passes it.

### What shows they tell results apart, without a model

- **A first draft of each** (`fixtures/requests/drafts/`), hand-made, with the mistake the request
  invites, written over its base the way an example is. `drafts.json` gives what fails each, and
  `requests.test.ts` holds each to exactly that: the errors and warnings the checker reports, by
  code, and the expectations it does not meet, with their problems (above). Eight of the twelve
  draw an error or a warning from the checker; the other four fail only expectations. Each draft
  draws the same codes over the installed game as over an empty one.
- **A result subtly wrong on a judged dimension** for each, beside a right one: the third
  calibration sheet (`fixtures/requests/calibration/expert/`), twenty-four hand-made results, two
  of each request, which is which written nowhere. Every one has nothing the checker reports and
  meets every expectation, which a test holds: the code-checked side cannot tell them apart, and
  only the judge, or a person, can. The owner's two sheets are unchanged. The owner grades it with
  the other two before the release run (decision 135): 88 answers to grade by hand, then 24 judge
  test sessions.

### The repair loop

No test can show a model repairing; only a real run can. What a test can show, `repair.test.ts`
does: on each of the eight drafts the checker catches, the skill's documented steps played by the
test, not chosen by a model. The built agent server, started as a trial's configuration starts it,
reports to `check` at warning and above exactly the draft's errors and warnings, each in a file the
draft wrote; after the repair (the example written over the draft) the same check reports none. So
a session that falls into one of those traps is told so by the check the skill has it run, and the
repair the request needs reaches a clean check. The requests expected to exercise the repair loop
in a real run are those eight: `event-granary-inspection`, `event-county-unrest`,
`decision-fund-granaries`, `decision-pardon-prisoners`, `decision-house-feast`,
`effect-realm-relief`, `trigger-loyal-realm` and `trigger-settled-ruler`. The other four test what
the session writes, not a repair: a check after writing finds nothing in their drafts.

### The tool errors of the second run

The second run's 17 tool errors, none a fault of the server, pointed at pychivalry's own wording:

1. **13 calls by a short name** (`check`, `lookup`, `find_definition`), which Claude Code answers
   with no such tool. The skills wrote every tool by its short name and said only that a client
   "may" list it under a prefix, giving one example; the server's instructions said the same. The
   first run had 10 such calls, the agent-use sessions 2. Each skill now lists Claude Code's full
   name of every tool it drives (`mcp__pychivalry__check` and so on), says that a call of the short
   name reaches nothing, and to call the same tool again by its listed name; the server's
   instructions say the same. `skill-files.test.ts` holds every skill to it, tool by tool.
2. **4 `lookup` calls given a cursor with other arguments.** `lookup`'s cursor was described as
   "the next_cursor of the previous result", which a session can read as the last result of any
   call; the paged tools' cursor said the same. Each now says a cursor only continues the answer
   it came from, with exactly the same arguments, and is left out for any other question;
   `lookup`'s description adds that a lookup of other names never takes one. A refused cursor now
   says what to do: repeat exactly the same arguments to continue, or call again without cursor;
   `lookup`'s refusal names its own arguments, the names and the language. The same calls are
   refused as before: no check is weaker.

### The release run (decision 132)

The third preview's release run is made once, on the owner's word, once the request list is
final: 10 trials whose harness held of each request, the MVP's repetitions before a release. With
the twenty-four requests that is 240 trials, each one authoring test session and one judge test
session: **480 test sessions**, and two more for each trial that does not hold and is tried again.
A record that lacks any request of the list is not a release run of it
([The targets](#the-targets-item-98)). It was planned after the owner's hand calibration of all
three sheets (decision 135) and his hand checklist, and after the development run of the expert
requests on tool schema version 5 ([below](#the-next-development-run-decisions-141-and-145)). On
his word of 2026-11-26 it was made after that development run and before the calibration and the
checklist (decision 178), once through, no trial tried again
([below](#the-third-previews-release-run-decision-132)).

## The expert requests' development run (decision 134)

On the owner's word of 2026-11-25 (decision 134), the twelve expert requests get a development run
of their own before the release run, to see that they tell results apart and that nothing in them
is a fault of pychivalry's: 5 trials of each, 60 trials, 120 test sessions of Claude Code 2.1.330
(Opus 5.5 writing, Fable 5.2 judging), each with session limit 3, the trials kept, from the main
clone at the merge of #155:
`SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=5 SCORED_SESSION_LIMIT=3 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_REQUESTS=<the twelve expert requests> SCORED_KEEP=true SCORED_CLAUDE=<another Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring`.

### Where it stopped

It stopped after 14 trials, 27 test sessions (14 authoring, 13 judge): `event-granary-inspection`
5, `event-envoy-chain` 5 and `event-county-unrest` 4. The 13 trials that held met every target:
no error, no warning, all in the format, every expectation met (21, 32 and 21 of them a trial),
every judged answer yes. The fourth `event-county-unrest` trial did not hold: its session named a
file outside its mod, once. Its own result was clean too (no error or warning, 21 of 21
expectations), but it was not judged, and under the rule of the time the run stopped there, the
nine other requests not yet run. Its record is not committed while the run is unfinished.

### What the session did, from its output stream

1. It loaded the write-content skill and looked up eleven names at once, `county_opinion` among
   them. The answer, a page of 11,565 characters, held two of the eleven: `is_ruler` whole and
   the head of `any_sub_realm_county`. It asked again in smaller groups, learned that
   `county_opinion` is only a modifier template in 1.21.0.3, and looked up `popular_opinion`,
   `change_popular_opinion` and `add_popular_opinion` together.
2. That answer, a page of 13,501 characters, held the first two whole and only the **head** of
   `add_popular_opinion`: where the game defines it, and its first 20 of 121 uses in the base
   game, each a place such as
   `{ "layer": "game", "file": "common/casus_belli_types/00_peasant_war_new.txt", "line": 168, ... }`.
   Its two readings, what the effect is with the game's documented usage
   (`scope:county = { add_popular_opinion = 10 }`), were left for the next page.
3. Its next call: `Read` of `<trial mod>/../game/common/casus_belli_types/00_peasant_war_new.txt`,
   lines 163 to 174, around the fourth of those uses: it wanted to see **how the game itself
   writes the effect**. The file and the line came from `lookup`'s uses. The folder `../game/`
   was its own guess: no result and nothing in the server's instructions says where the game
   folder is (the instructions name the mod's folder only), or that a place of the layer `game`
   cannot be read with a session's own file tools. Claude Code answered "File does not exist":
   the game is elsewhere on the machine. The read reached nothing, but the call named a file
   outside the mod, so the trial did not hold, as the rule says it must.
4. It then gave `lookup` the cursor with `add_popular_opinion` alone, which the server refused
   ("it was given for other names or language. A cursor only continues the answer of the call
   that gave it, repeated with exactly the same names or language; to ask anything else, call
   again without cursor"), called again with the same three names and the cursor, and got the
   readings it had looked for. It wrote the event and its localization, ran `apply_format` and
   `check` on both: no error, no warning, every expectation met.

The second trial of the same request did the same up to the refused cursor; it then read its own
mod's folder (a folder, refused by Claude Code, inside the mod: it held) and called
`find_definition`. The first and the third followed the cursor as asked. Those two refused
`lookup` calls are the run's only errors of a pychivalry tool; the kept streams show two, in two
trials, not three.

**No pychivalry tool gives the game's own text.** `lookup`, `find_definition`, `find_references`
and `list_definitions` give places (a layer, a file from that layer's folder, a line and a column),
never text; `format` and `apply_format` take a file of the mod only; `explain_code` gives the
catalogue's messages. A session that wants to see how the game writes a name can learn where,
never what, unless its own file tools reach the game's folder, which a scored trial's must not.

**How `lookup`'s pages went.** In every one of the 14 trials the first `lookup`, of 5 to 12
names, came back as one page holding 2 or 3 of them, the last cut short, some or all of its
readings left for the next page: each name's head, its definitions and its first 20 uses (each a
game place), comes before its readings, the part a session looks a name up for, and a few heads
fill a page. Of the run's 18 answers that took more than one page, 3 were followed with the
cursor; in the ten trials of `event-granary-inspection` and `event-envoy-chain` the first lookup
was the only one and the session never saw the rest of it ("Lookups are large; I'll query the
uncertain ones only," one `event-county-unrest` session wrote). Every result still met every
expectation, from what the sessions knew and what `check` confirmed.

### What was done, and what was not

1. **The run's stop rule** ([When a run stops](#when-a-run-stops)): a trial that does not hold
   stops the run only when the trials after it would say as little. What counts as held is not
   changed.
2. **How a trial that did not hold counts** ([The targets](#the-targets-item-98)): graded and
   judged when its session ended by itself, never counted as a success, counted against each
   target its own result fails, named by `task scored:targets` with why; a release run needs 10
   trials that held of each request.
3. **Continuing across commits** ([Continuing a run](#continuing-a-run)), so that this run goes on
   from its record, and `SCORED_RECORD`, so that a run of some requests only is filed under its
   own name.
4. **Not changed: what a session is given.** A tool that gives the game's own text of a place or
   a definition, game places written so that they do not look like files under the mod, and
   `lookup`'s pages kept whole by name with the readings first: each changes what a session sees,
   so each would make this run's trials two ways, which no record may hold. They are asked of the
   owner, to build when this run is finished and before the release run (docs/decisions.md,
   [Asked, awaiting the owner](../../docs/decisions.md#asked-awaiting-the-owner)). `lookup`'s
   refusal of another call's cursor stays as it is: a cursor holds no names, so a page of other
   names would be a wrong page, and both sessions found their way on from the message. A test
   holds the run's very shape (`bad-input.test.ts`): three names, the third cut after its head,
   the third alone with the cursor refused, the same three continuing it, and the third alone
   with no cursor answered whole.

### Continuing it

From the main clone holding the record as the run wrote it (its `records/scored/authoring.json`,
uncommitted), once this change is merged and nothing that a trial is made or graded with has
changed on `main` since the record's commit:

```sh
git pull && task build
SCORED_CONTINUE=true SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=5 SCORED_SESSION_LIMIT=3 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_REQUESTS=<the twelve expert requests, as before> SCORED_KEEP=true SCORED_CLAUDE=<the same Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring
```

It names the record's commit and the run's files that changed since, then makes 47 trials: two of
`event-county-unrest` (trials 5 and 6, the fourth tried again) and five of each of the nine
requests not yet run, none of `event-granary-inspection` or `event-envoy-chain`; up to 94 test
sessions. Made with the stand-in in Claude Code's place on a copy of the record, from a clean
checkout of this change, it was accepted and planned exactly so, and the record it wrote passes
`task records:check`. When it has finished (its exit 0; a request still short, or a stop, is
named in its last lines and continued the same way), the record is filed as
`records/scored/authoring-expert-run-1.json` and `records/scored/authoring.json` is given back as
committed ([records/README.md](../../records/README.md#authoring-records-scoredauthoring)).

### The finished run

Continued from its record on the owner's word of 2026-11-25, from the main clone at the merge of
#156, with the command above: 47 trials more (`event-county-unrest` 5 and 6, and five of each of
the nine requests not yet run) and 94 test sessions; with its first part's 14 trials and 27 test
sessions, **61 trials and 121 test sessions**. It finished with every request at 5 trials that
held; no stop rule was reached. Its record is filed as
[`records/scored/authoring-expert-run-1.json`](../../records/scored/authoring-expert-run-1.json),
byte for byte as the run wrote it ([records/README.md](../../records/README.md#authoring-records-scoredauthoring));
`authoring.json` stays the second run's (since the release run, `authoring-run-2.json`). The run
kept every trial's files, in one folder per part;
nothing of them is committed.

| Request | Type | Held | No error | No warning | In the format | Every expectation | Judge: yes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `event-granary-inspection` | event | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `event-envoy-chain` | event | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `event-county-unrest` | event | 5 of 6 | 5 | 5 | 5 | 5 | 20 of 20 |
| `decision-fund-granaries` | decision | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `decision-pardon-prisoners` | decision | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `decision-house-feast` | decision | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `effect-realm-relief` | scripted effect | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `effect-granary-gift-edit` | scripted effect | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `effect-heir-household` | scripted effect | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `trigger-loyal-realm` | scripted trigger | 5 of 5 | 5 | 5 | 5 | 5 | 12 of 15 |
| `trigger-granary-patron` | scripted trigger | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `trigger-settled-ruler` | scripted trigger | 5 of 5 | 5 | 5 | 5 | 5 | 10 of 10 |
| **All** | | **60 of 61** | **60** | **60** | **60** | **60** | **217 of 220** |

Against the owner's targets, as a development run: no error 60 of 60, no warning and in the
format 60 of 60 each, every expectation 60 of 60: met. Judged: `effects-as-asked` 45 of 45,
`scope-as-asked` 55 of 55, `text-as-asked` 30 of 30, `nothing-unasked` 35 of 35, and
`conditions-as-asked` **52 of 55 (94.5%): not met**, short of 95% by one answer. The trial that
did not hold, `event-county-unrest` 4, counts for nothing: its own result fails no target. It was
not judged, under the rule of the time; re-judging judges it.

### `trigger-loyal-realm`: the judge was wrong, from its memory of the game

The three answers that were not yes are all `conditions-as-asked` of `trigger-loyal-realm`:
trial 1 cannot-tell, trials 4 and 5 no. **The five results are the same logic**, differing only in
their comments:

```text
authoring_loyal_realm_trigger = {
	any_sub_realm_county = {
		count >= 3
		county_control >= 50
		popular_opinion >= 20
	}
}
```

The judge answered that logic yes twice (trials 2 and 3), cannot-tell once and no twice. Its
reasons (printed, never recorded) said in all five that the trigger for a county's opinion of its
holder is `county_opinion`: trials 1, 4 and 5 that `popular_opinion` is not a CK3 trigger, so the
opinion is not tested; trials 2 and 3 the same doubt, leaving the name to the checker as the
prompt asked. The game settles it:

1. **The spec package** (1.21.0.3): `popular_opinion` is in the triggers, documented as
   "Compares the county's current opinion of its holder", in the scope `landed_title`, compared
   with `<`, `<=`, `=`, `!=`, `>`, `>=`; `base_popular_opinion` is "Compares the county's base
   opinion of its holder"; `add_popular_opinion` "Change the current popular opinion of scoped
   title's holder", usage `scope:county = { add_popular_opinion = 10 }`. Its retired list has
   `county_opinion` (and `county_opinion_target`, and `county_holder_opinion`, whose note names
   `popular_opinion` as what 1.21.0.3 registers) removed from the triggers in 1.21.0.3, and
   `county_opinion_add` and four more `county_opinion` modifiers renamed `popular_opinion`. Those
   texts are the game's own documentation, which the package carries.
2. **The base game** compares `popular_opinion` in 206 lines of 57 script files and never writes
   `county_opinion` in a script file (outside script it is left only in one localization text,
   in each language, that links a game concept of that name, and in a comment of
   `gui/window_my_realm.gui`). It writes the very shape of the result:
   `events/story_cycles/story_cycle_conqueror_events.txt`, lines 329 to 332,
   `any_sub_realm_county = { exists = holder county_control >= county_control_baseline popular_opinion >= 0 ... }`;
   and `common/character_interactions/03_fp2_interactions.txt`, lines 2892 to 2895,
   `any_sub_realm_county = { count > 0 ... popular_opinion < 0 }`. Its trigger localization
   (`common/trigger_localization/00_province_triggers.txt`, line 28) shows it as
   "[popular_opinion|E] in [TITLE.GetName] is ...", and its game concept `popular_opinion` is
   "Popular Opinion": "The general populace of each county has an opinion of the character who
   holds their county".
3. **pychivalry's checker** over the installed game reports nothing in any of the five, and
   `names/unknown-trigger` ("Unknown trigger 'county_opinion'") in the request's first draft,
   which writes `county_opinion`. `lookup` answers `county_opinion` "removed from triggers in
   1.21.0.3" and `popular_opinion` with the game's description: the checker accepts no name that
   does not exist, and gives this one its meaning. No checker or spec fault.
4. **The request** asks for counties "with people whose opinion of their holder is at least 20",
   the game's own words for `popular_opinion` (the current opinion, not the base one), and leaves
   the name unnamed on purpose (its trap). **Its expectation**, `popular_opinion` used inside
   `any_sub_realm_county`, is the game's; every trial met it.

So, trial by trial: in all five the result, the expectation, the request's wording and the checker
are right. The judge is right in its answer in trials 2 and 3 (yes), though from the prompt's
rule rather than knowledge, and wrong in trials 1 (cannot-tell), 4 and 5 (no). The cause is the
judge's: it took whether a keyword exists, and what it means, from its memory of an earlier
version of the game. Judged right, `conditions-as-asked` is 55 of 55 and every target is met.

### What was done

1. **The judge's prompt, version 2** ([The judge](#the-judge)): the judge is given what
   pychivalry's checker reports in the result over the installed game and the game's own
   description of every trigger, effect, iterator and link the result writes, from the spec
   package, and told to take names and their meanings from them, never from memory. The prompt
   is versioned, the record names it by its hash, and `task scored:targets` says which version
   judged a record. What an authoring session is given is unchanged.
2. **The same judge in the calibration**: it reads the game (`CK3_GAME_PATH`) and gives its judge
   the same material; its record states the game. The owner's three sheets are unchanged and stay
   valid (they grade results, not a judge); their calibration measures version 2.
3. **Re-judging kept results** ([below](#re-judging-kept-results)), `task scored:rejudge`: the
   judge run again over a record's kept results, with no authoring session. Checked with the
   stand-in in Claude Code's place over this run's kept trials and the installed game: every
   stream is the record's session and every result grades as the record graded it.
4. **The labelled case** ([fixtures/requests/judge/](../../fixtures/requests/judge/README.md)):
   the five results' logic, hand-made, and `judge.test.ts` holding what the judge is given for it
   and for its first draft, word for word.

The record's measures stay as the run made them, judged with version 1.

### What the 61 kept trials show

Read from the record and the kept output streams, with no model; each session's first draft (the
mod as it stood at its first `check` after its first write) rebuilt from its `Write` and `Edit`
calls and graded with the checker and the expectations.

1. **The repair loop worked, once a session, where the checker caught a trap.** Four sessions,
   `decision-house-feast` 1 to 4, wrote the house's members walked from the character, the second
   half of that request's trap; their first `check` after writing reported
   `scope/wrong-scope-for-effect` ("Wrong scope for effect: character, expected dynasty_house"),
   each wrapped the iterator in the house (`house = { every_house_member = { ... } }`, one with
   `house ?=`) and checked again: clean. One round each against the five-round stop rule, which no
   session approached; no other session's check after writing reported an error or a warning.
   Eleven more sessions, all of decisions, drew only advice from their check after writing
   (`style/unusual-field-order`, and `fields/usually-present` in two): six rewrote their file for
   it and checked again, as did three of the four that repaired an error, and seven results kept
   a hint or an information finding, which no target counts.
2. **The other traps were not fallen into.** Every session of `event-county-unrest` and
   `trigger-loyal-realm` (eleven) looked `county_opinion` up before writing, learned it was
   removed, and wrote `popular_opinion`; four looked up `add_county_opinion` too. All five
   `decision-house-feast` sessions looked up `house_power` and wrote `house_power_score`. No
   session of `decision-pardon-prisoners` or `trigger-settled-ruler` named `is_at_peace`,
   `has_spouse` or `release_prisoner` at all. No first draft of the other requests failed an
   expectation of substance: the namespace declared again, the gift run inside `scope:envoy`, the
   gold given to the county's holder, the effect changed in place, the siblings walked from the
   heir, the base's triggers used. Of the twelve traps, one was fallen into, and the checker caught
   it.
3. **Tool errors: 12.** Nine `lookup` calls given a cursor with other names, refused by the server
   with what to do (nine sessions: `event-county-unrest` 2 and 4, `decision-pardon-prisoners` 4,
   `effect-granary-gift-edit` 3 and 5, `effect-realm-relief` 1 and 4, `trigger-loyal-realm` 4,
   `trigger-settled-ruler` 5); two `Read`s of the session's own mod folder, which Claude Code
   refused as a folder (`event-county-unrest` 2 and 6); and the one `Read` outside the mod
   (`event-county-unrest` 4). **No call by a tool's bare name** (13 in the second run, before
   #155's wording), and no permission denial.
4. **`lookup`'s pages.** The first `lookup` of every session asked for 2 to 20 names and came
   back with 1 to 3 of them on its first page, never all. Of the run's 133 `lookup` answers, 101
   had a next page and 23 were continued with their cursor: 78 never were, in 59 of the 61
   sessions. Every result still met every expectation: sessions asked again in smaller groups.
5. **The calls.** `Skill` 61 (once each), `lookup` 133, `check` 135 (1 to 5 a session; 51 sessions
   checked the base before writing), `apply_format` 122, `Write` 109, `find_definition` 54,
   `Read` 38 (every one but one of a file of the mod), `list_definitions` 28, `Edit` 21. Every
   session ended by itself, in 9 to 21 turns and 16 to 38 seconds; every judge session in one turn.

### What it does not show

That version 2 of the judge says yes where version 1 said no: only a judge session can show it.
The results are kept, so re-judging them needs no authoring session: 61 judge test sessions, the
60 trials that held and `event-county-unrest` 4, which ended by itself ([Re-judging kept
results](#re-judging-kept-results)). The calibration's three sheets then measure version 2 against
the owner's hand grades. The three changes to what a session is given that this run's first part
raised are proposals for the owner (docs/decisions.md,
[Asked, awaiting the owner](../../docs/decisions.md#asked-awaiting-the-owner)), with what these 61
trials say of each. Both were then answered on the owner's word: the results judged again
([below](#judged-again-with-version-2-decision-139)) and the three changes built
([What a session is given](#what-a-session-is-given-tool-schema-version-4)).

### Judged again with version 2 (decision 139)

On the owner's word of 2026-11-25 the run's kept results were judged again, with no authoring
session: `task scored:rejudge` over `records/scored/authoring-expert-run-1.json` and the run's two
kept folders, 61 judge test sessions of Claude Code 2.1.330 on Fable 5.2, each with session limit
3, with version 2 of the judge's prompt
(`SCORED_FROM=records/scored/authoring-expert-run-1.json SCORED_KEPT=<first kept folder>:<second kept folder> SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<the same Claude Code> CK3_GAME_PATH=<game dir> task scored:rejudge`).
Its record, as the run wrote it, is
[`records/scored/authoring-expert-run-1-judge-2.json`](../../records/scored/authoring-expert-run-1-judge-2.json),
beside the record it judged again, which stays as made. Every stream and result matched the
record before any session; `event-county-unrest` 4, not judged under the rule of its time, was
judged.

| | Version 1 (the run) | Version 2 (judged again) |
| --- | --- | --- |
| Trials, held | 61, 60 | 61, 60 |
| No error, no warning, in the format, every expectation | 60 of 60 each | 60 of 60 each |
| `effects-as-asked` | 45 of 45 | 45 of 45 |
| `scope-as-asked` | 55 of 55 | 55 of 55 |
| `text-as-asked` | 30 of 30 | 30 of 30 |
| `nothing-unasked` | 35 of 35 | 35 of 35 |
| `conditions-as-asked` | 52 of 55 (94.5%): not met | **55 of 55: met** |
| The four targets | 3 of 4 met | **all 4 met** |

`task scored:targets` with `SCORED_RECORD` set to the new record reads it so. **The judge again
answered yes to every question, 220 of 220.** Version 2 no longer says no where the game says yes
(the three answers on `trigger-loyal-realm` now yes); no run has yet shown that it says no where it
should. That rests on the owner's three hand-graded calibration sheets (decision 135), whose
results include ones that are wrong on purpose.

## What a session is given (tool schema version 4)

On the owner's word of 2026-11-25 (decision 140), before the release run, the three proposals the
development run raised were built (#158): what every session of a run is given changed, and the
agent server's tool schema version is 4.

1. **`lookup` answers every name whole.** Each name asked is answered whole in one result, its
   readings first (what it is, the game's description, its scopes, what it takes, its removal or
   replacement), then its definitions (at most 3 places a group) and its uses (counted, the first
   3), or it is named in `not_answered`, to look up in another call. There is no cursor. A field
   of more than three folders comes in brief, and `folder` gives a folder's field in full. The
   run's 61 first `lookup` calls, replayed with no model over the installed game
   (`packages/mcp/src/lookup-whole.test.ts`): 45 answered whole in one call and the rest in 2 or 3,
   where each first page had held 1 to 3 of their 2 to 20 names, and no name is ever cut.
2. **`source`**, read-only: the base game's own text (or the mod's) around a place another
   result named, by its layer, file and line, at most 40 lines, of a file the index read, never by
   an address. `event-county-unrest` 4's session wanted exactly this, the game's use of
   `add_popular_opinion`, and reached for its own `Read`.
3. **Places that say their layer.** Every place every tool names has its `layer`; one outside the
   mod says `"read_with": "source"`. The server's instructions and the three skills say that a
   game place is read with `source`, never with a session's own file tools.

**What a trial is offered.** The run's list of the server's tools (`SERVER_TOOLS` in `run.ts`)
gains `source`, so a session is offered nine `mcp__pychivalry__*` tools, and a start that does not
offer one is a harness problem, as before. What counts as held is unchanged: a `Read`, `Edit` or
`Write` that names a file outside the mod, refused or not, makes a trial not held.

**How a record marks what its sessions were given.** A record now names the agent server's tool
schema version, `server.schema_version` (4), beside its `entry` and `arguments`. Every record made
before has none: its sessions were given version 3 or earlier. `task scored:targets` and the run's
own reading say first which version a record's sessions were given, and, for any but the
committed one, that its measures are not comparable with a record of the committed version
without saying so; a run continuing a record refuses one of another version, or of none (the
server is compared), so a record never holds sessions of two versions. The judge's version is named
the same way, by its prompt's hash. So the records committed then, `authoring-run-1.json`, the
second run's (then `authoring.json`, now `authoring-run-2.json`), `authoring-expert-run-1.json`
and its re-judged copy, are read as made with version 3 or earlier, and the next run's as made with
version 4.

### Tool schema version 5 (decision 144)

On the owner's word of the same day, `lookup` takes `evidence` (decision 144): with exactly one
name, its answer also holds that name's readings with the spec package's evidence behind each
part, as `pychivalry lookup --json` prints them, as many as fit the result and the rest counted.
Off by default, it changes no answer a session gets without asking; of the skills, only the
explain-error skill names it. It is still a change of the tools' shapes, so the agent server's
tool schema version is 5 (`SERVER_SCHEMA_VERSION` in `run.ts`), and every record a run makes
from now on states `server.schema_version` 5. No record was made on version 4. **The next
development run will be at version 5 and is not to be compared with records of version 4 or
earlier**: `task scored:targets` says so first, and a run refuses to continue a record of
another version. The command line's `source` (decision 143) changes nothing a session is given:
a scored session has no terminal.

### The spec package in format 9 (2026-11-25)

The spec package a session's tools read changed on 2026-11-25 from format 8 to format 9
(docs/decisions.md, row 147), the same game version, 1.21.0.3. Every record already names the
package it was made on, by its SHA-256 (`spec`: `version`, `sha256`, `package_format`): the five
committed scored records name format 8 (`b72678cc...`), and a run made now names format 9
(`61343931...`). The tools' shapes did not change, so the tool schema version stays 5, but what
they answer did, where the package says more: `lookup` gives a modifier's localization key
`MOD_<NAME>` (or the executable's own literal) before a format record's key, `has_trait`'s value
names traits and trait groups (confirmed now), laws root at a character and `history/titles` at a
landed title, scripted modifiers have no root, a saved value (`save_scope_value_as`) and the 409
names the game saves from its own code are saved scopes, and `check` no longer reports what
format 8's gaps made it report (docs/decisions.md, row 150). So:

- **A record made on format 8 and one made on format 9 are not compared without saying so**,
  as with two tool schema versions. The next development run (below) is the first made on
  format 9.
- `SCORED_CONTINUE=true` refuses to continue a record made on another spec, and
  `task scored:rejudge` refuses to judge again the kept results of one: both compare the
  record's `spec` with the committed package before any session. The committed records stay as
  made; judging their results again would need the format 8 package back.
- `task scored:targets` reads a record as before; its figures are those of the package the
  record names.

### The skills changed: an AI weight for every option (decision 159)

On the owner's word of 2026-11-25 the write-content skill has an eighth rule: every option of an
event with several options is given an AI weight, written with the keywords whose keyword role
`lookup` reads as `ai_weight` (the skill names none itself; the hint
`style/option-without-ai-weight` names them), and its stop rule and its report count an option
without one as left. The fix-error skill fixes that hint, which has no fix, as it fixes the other
`style/` findings when the person asks for them. What a session is given has therefore changed
again, beside the package of format 9:

- **The next development run is not compared with earlier records without saying so.** Every
  authoring record already names the skills its sessions were given, each by the SHA-256 of its
  folder (`results.task.skills`, beside `skills_in`; confirmed on the committed records): they
  name the write-content skill `97d7dab5...` and the fix-error skill `330cac49...`, and a run
  made now names the new hashes.
- `SCORED_CONTINUE=true` refuses to continue a record made with other skills (they are compared
  by hash, above), so a record never holds sessions given two versions of the skills.
- What a trial is graded by does not change: the authoring grade counts errors and warnings, and
  the hint is neither; the judge's prompt and questions are unchanged. The requests' example
  results and the expert sheet's hand-made results now weight every option too (decision 160;
  [fixtures/requests/calibration/expert/README.md](../../fixtures/requests/calibration/expert/README.md)
  says which results changed).

### The next development run (decisions 141 and 145)

Before the release run, a development run of the twelve expert requests measures what a session
is given: 5 trials of each, **120 test sessions** (60 authoring of Opus 5.5, 60 judge of Fable 5.2
with version 2 of its prompt), each with session limit 3, the trials kept, written to its own
record. It was not started until the owner said (decision 145); he did on 2026-11-26 (decision
165), and it was made from the main clone at the merge of #163 with this command
([below](#the-expert-requests-second-development-run-decision-165)):

```sh
SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=5 SCORED_SESSION_LIMIT=3 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_REQUESTS=event-granary-inspection,event-envoy-chain,event-county-unrest,decision-fund-granaries,decision-pardon-prisoners,decision-house-feast,effect-realm-relief,effect-granary-gift-edit,effect-heir-household,trigger-loyal-realm,trigger-granary-patron,trigger-settled-ruler SCORED_RECORD=records/scored/authoring-expert-run-2.json SCORED_KEEP=true SCORED_CLAUDE=<the same Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring
```

A trial that does not hold and is tried again by a continuing run adds two sessions each. Its
record states `server.schema_version` 5; the first expert run's record, of version 3, is not
continued and stays as made. What to read from it beside the targets: how many first lookups
were answered whole, how often `source` was called and on what, whether `lookup`'s `evidence`
was asked for at all, whether any `Read` left the mod, and the tool errors. They are read below.

## The expert requests' second development run (decision 165)

On the owner's word of 2026-11-26 (decision 165), the run of the section above: the twelve expert
requests, 5 trials each, **120 test sessions** of Claude Code 2.1.330 (60 authoring of Opus 5.5, 60
judge of Fable 5.2 with version 2 of the judge's prompt), each with session limit 3, the trials
kept, from the main clone at the merge of #163, with the command above. It ran once through: no
trial was tried again and no stop rule was reached. Its record is
[`records/scored/authoring-expert-run-2.json`](../../records/scored/authoring-expert-run-2.json),
as the run wrote it. It is the first record whose sessions were given tool schema version 5
(`source`, `lookup` whole by name with `not_answered`, places that say their layer, `lookup`'s
`evidence` on request), the spec package in format 9 and the write-content skill's eighth rule (an
AI weight for every option), all of which the record names; the first expert run's sessions were
given none of them. **So it is not compared with `authoring-expert-run-1.json` without saying
so**, and every figure below that sets the two side by side says which is which.

| Request | Type | Held | No error | No warning | In the format | Every expectation | Judge: yes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `event-granary-inspection` | event | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `event-envoy-chain` | event | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `event-county-unrest` | event | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `decision-fund-granaries` | decision | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `decision-pardon-prisoners` | decision | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `decision-house-feast` | decision | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `effect-realm-relief` | scripted effect | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `effect-granary-gift-edit` | scripted effect | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `effect-heir-household` | scripted effect | 5 of 5 | 5 | 5 | 5 | 5 | 20 of 20 |
| `trigger-loyal-realm` | scripted trigger | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `trigger-granary-patron` | scripted trigger | 5 of 5 | 5 | 5 | 5 | 5 | 15 of 15 |
| `trigger-settled-ruler` | scripted trigger | 5 of 5 | 5 | 5 | 5 | 5 | 10 of 10 |
| **All** | | **60 of 60** | **60** | **60** | **60** | **60** | **220 of 220** |

Against the owner's targets, as a development run (`task scored:targets` with `SCORED_RECORD` set to
the record, which also says first that its sessions were given the committed tool schema version 5
and that it was judged with the committed version 2): no error 60 of 60, no warning and in the
format 60 of 60 each, every expectation 60 of 60, and every judged dimension 100% yes
(`effects-as-asked` 45 of 45, `scope-as-asked` 55 of 55, `text-as-asked` 30 of 30,
`nothing-unasked` 35 of 35, `conditions-as-asked` 55 of 55): **every target met**. Every trial held
(the first expert run: 60 of 61), every session ended by itself, none was denied a permission, and
every judge session answered in one turn.

### What the 60 kept trials show

Read from the record and the kept output streams, with no model, and set beside the first expert
run's 61 kept trials read the same way (that run's figures in brackets). Each session's first
draft, the mod as it stood at its first `check` after its first `Write` or `Edit`, was rebuilt from
its `Write`, `Edit` and `apply_format` calls over the request's base and graded with the checker
and the request's expectations over the installed game; replayed to its end, every session's
rebuilt mod is its kept result byte for byte, in both runs. The first run's drafts were graded
with today's checker and spec package, not those it ran with.

1. **`lookup` answered most first lookups whole.** The first `lookup` of every session asked for
   2 to 20 names (median 7, both runs). In 40 of the 60 sessions it answered every name whole in
   one call (the first run: none; each of its 61 first pages held 1 to 3 names and had a next
   page). The other 20 named 1 to 10 names each in `not_answered`, 56 in all, never a name cut
   short: 14 of those sessions looked some of them up again (9 all of them), 40 of the 56 names in
   all. Of the 16 never asked again, 7 were written in the result unlooked-up, each a field or word
   the base mod or another reading had shown (`base` in two, `count` in two, `name`, `option` and
   `type` in one), and the check after writing found nothing in them. Of all 104 `lookup` answers,
   27 named something in `not_answered` and none was cut (the first run: 133 calls, 101 answers
   with a next page, 23 continued with their cursor). **No cursor was given, so no cursor was
   refused**: the first run's nine refused cursors are gone.
2. **`source` was called 3 times, in 3 sessions, never refused**, each on the game layer, each
   time to see how the base game writes what the session was about to write:
   `decision-pardon-prisoners` 1 and 3 on `common/casus_belli_types/05_fp3_wars.txt` line 1042,
   the game's own `every_prisoner = { limit = { ... } release_from_prison = yes }`, and
   `decision-house-feast` 5 on `common/decisions/00_artifact_decisions.txt` line 3, a decision's
   `picture`. Each answer held 7 to 9 lines and under 600 characters. The other 57 sessions did
   not call it: the readings were enough. `find_references` and `explain_code` were called by no
   session, in either run.
3. **`lookup`'s `evidence` was never asked for**, in any of the 104 calls. Only the explain-error
   skill names it, and every session loaded the write-content skill.
4. **No `Read`, `Edit` or `Write` outside the mod** (the first run: one, the `Read` that made
   `event-county-unrest` 4 not hold). All 38 `Read`s (38 in the first run) were of the mod's own
   files, none of a folder (the first run: two).
5. **Tool errors: 9, every one a call of a pychivalry tool by its bare name** (the first run: 12,
   none by a bare name; 9 refused cursors, 2 `Read`s of a folder and the `Read` outside the mod).
   Seven were in three sessions' first calls of a pychivalry tool, straight after the skill loaded
   (`decision-fund-granaries` 3 and 5, `list_definitions` twice each; `event-granary-inspection` 5,
   `list_definitions` twice and `check`), and two were single calls later on
   (`event-granary-inspection` 2 and 4, `list_definitions` of the English localization). Claude
   Code answered "No such tool available" each time, and each session called the same tool again
   at once by its listed name, as the skills say to. Every one of the nine bare calls passed
   `limit` as a string (`"10"`, `"5"`), and every call again by the listed name passed it as a
   number. The skills' wording on tool names is the one the first run had, but for its list of
   Claude Code's names, which gained `find_references` and `source`: see
   [What was done after it](#what-was-done-after-it).
6. **Every option of every event with several options got an AI weight** (rule 8). The 15 event
   sessions each wrote one event with two options, 30 options, and every one has
   `ai_chance = { base = N }`, the two options of an event always the same: 50 in fourteen events,
   100 in one (`event-granary-inspection` 2). Every session looked `ai_chance` up before writing it
   (13 of them with `folder` set to `events`, as the rule says; `event-county-unrest` 1 and 4
   without), wrote the weights in its first draft, and said in its report which weight it gave,
   twelve of them that the request named no preference between the options. No check after
   writing reported `style/option-without-ai-weight`. In the first run, made before the rule, none
   of its 16 such events' 32 options had a weight.
7. **No repair round was needed.** No session's check after writing reported an error or a
   warning, so the repair loop and its five-round stop rule were never used (the first run: four
   sessions, `decision-house-feast` 1 to 4, drew `scope/wrong-scope-for-effect` and repaired it in
   one round each). Fourteen sessions, all of decisions, drew only advice after writing
   (`fields/usually-present` for a decision's `picture`, `style/unusual-field-order`, and
   `style/empty-block`). `decision-pardon-prisoners` 2 to 5 wrote `any_prisoner = { }` to ask for at
   least one prisoner and drew `style/empty-block`; 3 and 4 rewrote it as
   `any_prisoner = { count >= 1 }`, the same test, which the first session had written from the
   start, and 2 and 5 kept it. The results keep 14 information findings and 3 hints, none counted
   by a target (the first run: 2 and 5). 54 sessions checked the base before writing (51 of 61).
8. **The traps: no first draft fell into one.** Every one of the 60 rebuilt first drafts had no
   error and no warning and met every expectation of its request, so none fell into the mistake
   its request's hand-made draft shows (the first run: four, `decision-house-feast` 1 to 4, whose
   drafts walked the house's members from the character, drawing `scope/wrong-scope-for-effect` and
   missing `every_house_member` inside `house`; its other 57 drafts as clean). Where the first run
   fell in, its sessions had asked `lookup` for `every_house_member` before writing and never seen
   its reading, which was on no page they got; in this run every `decision-house-feast` session
   got it whole before writing, an iterator of the scope `dynasty_house`, and wrote the walk
   inside `house`. The other traps were looked up, not fallen into, in both runs: every
   `event-county-unrest` and `trigger-loyal-realm` session looked `county_opinion` up before
   writing (10 of 10; 11 of 11 before), learned it was removed and wrote `popular_opinion`;
   `decision-house-feast` sessions looked `house_power` up (4 of 5; 5 of 5 before) or went
   straight to `house_power_score`, which all wrote; no session of `decision-pardon-prisoners` or
   `trigger-settled-ruler` named `is_at_peace`, `has_spouse` or `release_prisoner`, in either run.
9. **Calls, turns and time.** `check` 136 (1 to 5 a session), `apply_format` 120, `lookup` 104,
   `Write` 102, `Skill` 60 (once each), `find_definition` 41, `list_definitions` 38 (8 of them by
   the bare name), `Read` 38, `Edit` 21, `source` 3, `format` 1: 664 calls, 6 to 21 a session,
   median 9 (the first run: 701 for 61 sessions, 7 to 19, median 10; `lookup` 133). Every session
   ended by itself in 8 to 23 turns, median 11 (9 to 21, median 12), and 11 to 34 seconds, median
   20 (16 to 38, median 23); 784 turns and 20.8 minutes of session time in all (823 and 24.5
   minutes). Every judge session answered in one turn, in 2 to 11 seconds (2 to 17).

### What it shows, and what it does not

- **It is a development run**, 5 trials of each request, as MVP.md's repetitions say for
  development; a release run has 10 of each. It shows that what a session is given at tool schema
  version 5, with the format 9 package and the AI-weight rule, meets every target on the twelve
  expert requests, at the ceiling of every measure, and that the changes did what they were built
  for: first lookups answered whole or named, no cursor misused, no file read outside the mod, every
  option weighted. It does not show that a better or worse server or skill would score differently
  on these requests: every measure is at its ceiling, as in the first expert run once judged again.
- **The judge again said yes to every question**, 220 of 220. That agrees with everything code
  checks, and version 2 of its prompt no longer says no where the game says yes (decision 139); no
  run has yet shown that it says no where it should. That still rests on the owner's three
  hand-graded calibration sheets (decision 135), whose results include ones wrong on purpose.
- **The traps caught no first draft this time** (four of 61 in the first run, all of one
  request). The requests still hold traps a first draft written from memory falls into (each
  hand-made draft shows its own failing the code-checked side), but these sessions looked the
  names up first, as the skill says, and got their readings whole; so on these twelve requests the
  repair loop was not exercised at all, and the run cannot say how a session repairs. Twelve
  requests, 5 trials each and one model are too few to say more than that.
- Its figures beside the first expert run's are of two different sets of tools, package and
  skills, as said above, and of one model each time; they say what changed in these sessions, not
  why, beyond what the streams themselves show.

### What was done after it

Nothing in the kept trials shows a fault of pychivalry's own: no pychivalry tool answered with an
error, none refused a call, and no answer was cut. **No code was changed**; the one test that
lists every committed authoring record with the judge's version it was judged with
(`judge.test.ts`) names this record too, judged with version 2. The nine tool errors
are Claude Code's answer to a name it does not list, and never reached the agent server; the
skills and the server's instructions already give every tool's listed name and say to call it
again by that name, which each session did at its next call. Whether the skills' steps should also write each tool by its
Claude Code name, which would change what sessions are given (the skills' hashes) and so the
comparison of the release run with this one, was asked of the owner; he answered yes on
2026-11-26 (decision 168, [below](#the-skills-changed-again-every-tool-by-its-full-name-decision-168)).

### The skills changed again: every tool by its full name (decision 168)

On the owner's word of 2026-11-26 (decision 168), after the run above: the three skills write
every tool by Claude Code's full name, `mcp__pychivalry__<tool>`, in every step and rule, not only
in their list at the top, and say how another client's names are made (`pychivalry-` before the
tool's own name in VS Code's Copilot harness, `mcp_pychivalry_` in VS Code's own). No short name
is written alone; `skill-files.test.ts` holds it, skill by skill and tool by tool. What a session
is given has changed again:

- **The release run (decision 132) is not directly comparable with this second expert run.**
  Every authoring record names the skills its sessions were given, each by the SHA-256 of its
  folder (`results.task.skills`): `authoring-expert-run-2.json` names the skills before this
  change, and a run made now names new hashes for all three. Its tool errors by a short name, nine
  in five sessions here, are the figure this change was made for; any other difference is not to
  be put down to it without saying so.
- `SCORED_CONTINUE=true` refuses to continue a record made with other skills (they are compared
  by hash), so no record holds sessions given both versions.
- What a trial is graded by does not change: the authoring grade, the request's expectations and
  the judge's prompt and questions are the same.

The same pull request changed `style/empty-block` (decision 167): an empty `any_` iterator, such
as the `any_prisoner = { }` that `decision-pardon-prisoners` 2 and 5 kept, is reported as a
condition that asks for at least one, and its fix writes `count >= 1` in it rather than taking it
away. A hint is counted by no target, so no grade moves; a session reading the hint now reads
what the empty block means.

## The third preview's release run (decision 132)

On the owner's word of 2026-11-26 (decision 178), given before his hand calibration and his hand
checklist: the release run of decision 132, the whole request list, all 24 requests, 10 trials
each, **480 test sessions** of Claude Code 2.1.330 (240 authoring of Opus 5.5, 240 judge of Fable
5.2 with version 2 of the judge's prompt), each with session limit 3, the trials kept, from the main
clone at the merge of #168 (`c09fe1d`): tool schema version 5, the spec package in format 9, the
skills writing every tool by its full name (decision 168) and `style/empty-block` as decisions 167
to 177 left it. With this command, and `SCORED_KEEP=true`:

```sh
SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=10 SCORED_SESSION_LIMIT=3 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_CLAUDE=<another Claude Code> SCORED_RECORD=records/scored/authoring-release-run-1.json CK3_GAME_PATH=<game dir> task scored:authoring
```

It ran once through, in about two hours: no trial was tried again and no stop rule was reached.
`SCORED_RECORD` had it write beside the committed record rather than over it while it ran; it is a
run of the whole list, so it is filed as
[`records/scored/authoring.json`](../../records/scored/authoring.json), byte for byte as the run
wrote it (its `command` names the file it was written to), and the record it replaces, the second
run's, is kept as `authoring-run-2.json` ([records/README.md](../../records/README.md#authoring-records-scoredauthoring)).
It is the second record of tool schema version 5 and the first of the skills of decision 168, so
**it is not compared with `authoring-expert-run-2.json` without saying so**: below, its expert
requests are set beside that run's for what changed in these sessions, not as one measure.

| Request | Type | Difficulty | Held | No error | No warning | In the format | Every expectation | Judge: yes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `event-merchant-debt` | event | easy | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `event-sleepless-night` | event | medium | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `event-letter-from-spouse` | event | hard | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `decision-give-alms` | decision | easy | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `decision-night-vigil` | decision | medium | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `decision-hold-banquet` | decision | hard | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `effect-reward` | scripted effect | easy | 10 of 10 | 10 | 10 | 10 | 10 | 20 of 20 |
| `effect-war-chest` | scripted effect | medium | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `effect-children-gift` | scripted effect | hard | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `trigger-can-host` | scripted trigger | easy | 10 of 10 | 10 | 10 | 10 | 10 | 20 of 20 |
| `trigger-family-ready` | scripted trigger | medium | 10 of 10 | 10 | 10 | 10 | 10 | 20 of 20 |
| `trigger-banquet-guest` | scripted trigger | hard | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `event-granary-inspection` | event | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `event-envoy-chain` | event | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `event-county-unrest` | event | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `decision-fund-granaries` | decision | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `decision-pardon-prisoners` | decision | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `decision-house-feast` | decision | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `effect-realm-relief` | scripted effect | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `effect-granary-gift-edit` | scripted effect | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `effect-heir-household` | scripted effect | expert | 10 of 10 | 10 | 10 | 10 | 10 | 40 of 40 |
| `trigger-loyal-realm` | scripted trigger | expert | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `trigger-granary-patron` | scripted trigger | expert | 10 of 10 | 10 | 10 | 10 | 10 | 30 of 30 |
| `trigger-settled-ruler` | scripted trigger | expert | 10 of 10 | 10 | 10 | 10 | 10 | 20 of 20 |
| **All** | | | **240 of 240** | **240** | **240** | **240** | **240** | **800 of 800** |

Against the owner's targets (`task scored:targets`, which reads the committed record by default
and says first that its sessions were given the committed tool schema version 5 and that it was
judged with the committed version 2): **a release run**, 10 trials that held of every request of
the list; no error 240 of 240, no warning and in the format 240 of 240 each, every expectation 240
of 240, and every judged dimension 100% yes (`effects-as-asked` 180 of 180, `text-as-asked` 120 of
120, `nothing-unasked` 140 of 140, `conditions-as-asked` 210 of 210, `scope-as-asked` 150 of 150):
**every target met**, and every target met again over the twelve requests that are not expert. Every
trial held, every session ended by itself, none was denied a permission, and every judge session
answered in one turn. **The judge said yes to every one of its 800 questions**: its ability to say
no is not yet calibrated against grading by hand ([below](#what-the-release-run-shows-and-what-it-does-not)).

### What the 240 kept trials show

Read from the record and the kept output streams, with no model, as the second expert run's were
(the same reading, which gives that run's published figures when run on its kept trials); its figures
are in brackets, set beside this run's 120 sessions of the same twelve expert requests, and the
figures over all 240 sessions come first. The first drafts were not rebuilt this time: what point 8
says of the traps is read from the sessions' own calls.

1. **`lookup` answered most first lookups whole.** The first `lookup` of every session asked for 2
   to 19 names (median 7). In 165 of the 240 sessions it answered every name whole in one call: 83
   of the 120 expert sessions (40 of 60) and 82 of the other 120. The other 75 named 1 to 10 names
   each in `not_answered`, 309 in all, never a name cut short: 66 of those sessions looked some of
   them up again (34 all of them), 223 of the 309 names in all (expert: 37 sessions, 115 names, 30
   asking some again and 16 all, 78 names; before 20, 56, 14, 9 and 40). Of the 86 never asked
   again, 45 were written in the result unlooked-up, each a field or word of the folder that the base
   mod or another reading had shown (`name` and `type` 8 times each, `desc`, `title` and `option` 5,
   `namespace` and `character_event` 3, `base` and `count` 2, `left_portrait`, `right_portrait`,
   `theme` and `trigger` once), and the check after writing found nothing in them. Of all 395
   `lookup` answers, 111 named something in `not_answered` and none was cut (expert: 201 and 55;
   before 104 and 27). No cursor was given, so none was refused.
2. **`source` was called 9 times, in 9 sessions, never refused** (expert: 2; before 3), each on
   the game layer, each to see how the base game writes what the session was about to write:
   `event-letter-from-spouse` 1, 5 and 7 on the game's `yearly_playable_pulse`
   (`common/on_action/yearly_on_actions.txt` line 973, and the merchant pack's
   `common/on_action/dlc/gdp/gdp_merchant_on_actions.txt` line 27), the on-action the request hooks;
   `decision-give-alms` 5, `decision-hold-banquet` 6 and `decision-house-feast` 6 on
   `common/decisions/00_artifact_decisions.txt` line 3, a decision's `picture`;
   `decision-night-vigil` 8 and 9 on the head of `common/decisions/00_lifestyle_decisions.txt`
   (lines 20 and 21, 39 and 40 lines shown); `decision-pardon-prisoners` 10 on
   `common/casus_belli_types/05_fp3_wars.txt` line 1042, the game's own `release_from_prison`, as
   two sessions did before. Each answer held 6 to 40 lines and 430 to 1,424 characters.
   `explain_code` was called by no session; `find_references` once (`decision-give-alms` 5, on a
   picture's file path, which it answered that nothing in the mod or the game writes) and `format`
   once (`effect-granary-gift-edit` 2, on the file it was about to change).
3. **`lookup`'s `evidence` was never asked for**, in any of the 395 calls (none of 104 before).
   Only the explain-error skill names it, and every session loaded the write-content skill, once.
4. **No `Read`, `Edit` or `Write` outside the mod** (none before). All 99 `Read`s were of the mod's
   own files (expert: 75; before 38), none of a folder.
5. **Tool errors: 2, both a call of `list_definitions` by its bare name** (before: 9, in 5 of 60
   sessions, every one by a bare name). Both are `event-granary-inspection` sessions, 3 and 8, the
   request with the most bare calls before, and both have one shape, the shape of seven of the nine
   before: in its first message after the skill loaded, the session called three tools at once,
   `list_definitions` of the folder `events` by the bare name with `limit` as a string (`"5"`), and
   `mcp__pychivalry__list_definitions` and `mcp__pychivalry__check` by their listed names. Claude
   Code answered "No such tool available", and each session called
   `mcp__pychivalry__list_definitions` of `events` by its listed name in its next message, with
   `limit` a number. So **the skills writing every tool by its full name in every step (decision
   168) did not take the bare-name errors away, but cut them** from 9 in 60 sessions of the twelve
   expert requests to 2 in 120 sessions of the same requests, and none in the 120 sessions of the
   other twelve (the second run, on those twelve with tool schema version 3 and the skills of then:
   13 in 4 of 60 sessions). No pychivalry tool answered with an error.
6. **Every option of every event with several options got an AI weight** (rule 8). The 60 event
   sessions each wrote one event with several options, 130 options in all, and every one has
   `ai_chance = { base = N }`, the options of an event always the same: 50 in the 48 events of two
   options of five requests, 100 in two of `event-granary-inspection`'s, and in
   `event-sleepless-night`'s three options 100 in nine events and 10 in one (before: 15 events, 30
   options, 50 in fourteen and 100 in one). Every event session looked `ai_chance` up before
   writing its event, 55 of them with `folder` set to `events`. No check after writing reported
   `style/option-without-ai-weight`.
7. **No repair round was needed.** No session's check after writing reported an error or a
   warning, so the repair loop and its five-round stop rule were never used (none before either).
   42 sessions, all of decisions (all ten of `decision-night-vigil` and `decision-fund-granaries`,
   nine of `decision-hold-banquet` and `decision-pardon-prisoners`, three of `decision-give-alms`,
   one of `decision-house-feast`), changed a file after their first check after writing for advice:
   the field order (`style/unusual-field-order`), a decision's `picture` (`fields/usually-present`)
   or, in `decision-pardon-prisoners` 1 to 7 and 9, the empty `any_prisoner = { }` that asks for at
   least one prisoner. `style/empty-block` now says so and suggests `count >= 1` (decision 167), and
   each of the eight wrote it; the other two wrote `any_prisoner = { count >= 1 }` from the start,
   so all ten results hold it (before: four drew the hint, whose message did not yet say what the
   block means, and two kept the empty block). The results keep 52 information findings, every one
   a decision without a `picture`, and 1 hint (`decision-hold-banquet` 7, a field order its check at
   `min_severity` warning counted in its totals and did not list), none counted by a target
   (before: 14 and 3). 217 sessions checked the mod before writing (expert: 102 of 120; before 54
   of 60); every session checked after writing, 1 to 5 checks a session, median 2.
8. **The traps were looked up, not fallen into.** Every `event-county-unrest` and
   `trigger-loyal-realm` session looked `county_opinion` up before writing (20 of 20; 10 of 10
   before), learned it was removed and wrote `popular_opinion`; `decision-house-feast` sessions
   looked `house_power` up (6 of 10; 4 of 5 before) or went straight to `house_power_score`, which
   all ten wrote; no session of `decision-pardon-prisoners` or `trigger-settled-ruler` named
   `is_at_peace`, `has_spouse` or `release_prisoner`. No check after writing found an error or a
   warning, so none of the eight traps the checker catches was in anything a session checked; in
   the four requests whose trap only an expectation catches, no session wrote or changed a file
   after its first check after writing, so what it first checked is what it handed in, and every
   one meets every expectation.
9. **Calls, turns and time.** `check` 557 (1 to 5 a session), `apply_format` 473 (in every session:
   417 wrote the file, 56 found it already in the format, none refused), `Write` 406, `lookup` 395,
   `Skill` 240 (once each), `find_definition` 219, `Read` 99, `Edit` 80, `list_definitions` 58 and 2
   by the bare name, `source` 9, `find_references` 1, `format` 1: 2,540 calls, 6 to 20 a session,
   median 10 (expert: 1,301, 6 to 20, median 9; before 664, 6 to 21, median 9). Every session ended
   by itself in 8 to 22 turns, median 12 (expert: median 11; before 8 to 23, median 11), and 10 to 35
   seconds, median 19 (expert: 11 to 35, median 21; before 11 to 34, median 20); 3,020 turns and
   82.1 minutes of session time in all (expert: 1,541 and 42.4; before 784 and 20.8). Every judge
   session answered in one turn, in 2 to 12 seconds (2 to 11 before).

### What the release run shows, and what it does not

- **It is the release run**: 10 trials of each of the 24 requests, as MVP.md's repetitions before a
  release ask, every trial held, and every measure at its ceiling. It shows that what a session is
  given at `c09fe1d` (tool schema version 5, the format 9 package, the skills of decision 168) meets
  every one of the owner's targets as a release run, with and without the expert requests. It does
  not show that a better or worse server or skill would score differently: no measure has room
  left, and no session needed to repair an error, so the run says nothing of how a session repairs.
- **The judge's ability to say no is not yet calibrated.** It said yes to all 800 of its questions,
  which agrees with everything code checks (no error, no warning, every expectation met in every
  result) and with version 2 of its prompt no longer saying no where the game says yes (decision
  139). No run has shown that it says no where it should: that is what the owner's three
  hand-graded calibration sheets measure, which decision 135 placed before this run and which the
  owner chose to grade after it (decision 178). The judged half of the targets therefore rests on a
  judge whose agreement with hand grading is not yet known.
- **It measures Claude Code only.** How VS Code's own AI follows the same skills is the hand
  checklist's to show ([docs/guide/ai-checklist.md](../../docs/guide/ai-checklist.md)), which has
  not been run; nor has the by-hand check of a preview. The in-game load, the third measure, waits
  for build step 11.
- **Its expert half beside the second expert run** is of other skills (every tool by its full
  name) and of a changed `style/empty-block` message, on the same tools and package, one model each
  time; the figures say what changed in these sessions, not why, beyond what the streams show.

### What was done after the release run

Nothing in the kept trials shows a fault of pychivalry's own: no pychivalry tool answered with an
error, none refused a call, and no answer was cut. **No code was changed.** The two tool errors are
Claude Code's answer to a name it does not list, which never reached the agent server; the skills
already write every tool by its listed name and say to call it again by that name, which both
sessions did at their next message. The record is filed as `authoring.json` and the second run's
kept as `authoring-run-2.json`; the test that lists every committed authoring record with the
judge's version it was judged with (`judge.test.ts`) names both, and `authoring-targets.test.ts`
reads the release run's targets from the committed record. The extension's version is 0.3.0, and
the third preview was published the same day on the owner's word, also before his calibration
and his checklist (decision 180;
[docs/preview-release-0.3.0.md](../../docs/preview-release-0.3.0.md)).

## What the next run is given: tool schema version 7 and new skills (decision 193)

Since the release run, what a session is given changed three times, and the next scored run is
the first made on all three:

1. **Tool schema version 6** (decision 188, #171): the agent server's tenth tool, `call_graph`,
   which says for each name where it is defined, what calls it and what it calls, answered by
   name as `lookup` is; every other tool is unchanged. A trial is offered the ten
   `mcp__pychivalry__` tools of `SERVER_TOOLS` in `run.ts`, and every record a run makes states
   `server.schema_version` 6 (`SERVER_SCHEMA_VERSION`). The committed records were made on
   version 5 or earlier: `task scored:targets` says so first, and a run refuses to continue one.
   This holds for both tests, the agent-use test (whose sessions are given no skill) and the
   authoring test.
2. **Tool schema version 7** (build step 11): the eleventh tool, `analyze_log`, which reads the
   game's own `error.log` against the error catalogue and ties its messages to the mod's files
   ([docs/game-log.md](../../docs/game-log.md)); every other tool is unchanged. A trial is offered
   the eleven tools of `SERVER_TOOLS`, and every record a run makes now states
   `server.schema_version` 7. A scored session has no game log to read: its server is started
   with `--no-log-folders` (`mcpConfig` in `run.ts`), so it looks for none of the developer's own,
   and the trial's mod holds none; the tool can only answer that it found none, and no task of
   either test asks for it.
3. **The skills changed** (decision 193, the owner's word of 2026-11-27): the fix-error skill
   asks `call_graph` for the callers of a scripted effect, a scripted trigger or an event before
   it edits it, and its report says what the change affects; the write-content skill, after its
   draft and before the checker's rounds, reads back each event chain or call it wrote with
   `call_graph`. Both folders hash differently, so an authoring run made now names new hashes for
   them in `results.task.skills`; the explain-error skill's is unchanged. The release run's
   record names the skills of decision 168.

So **the next scored run is measured on the new skills and tool schema version 7**, and is not
compared with `authoring.json`, or any committed record, without saying so: `SCORED_CONTINUE=true`
refuses a record of another server version or of other skills, so no record holds sessions given
both. What a trial is graded by does not change: the authoring grade, the requests' expectations
and the judge's prompt and questions are the same. No run has been made on them; one starts only
on the owner's word.

## Re-judging kept results

A judge can be run again over the results a run kept, with no authoring session: when the judge
changes, the results already made need not be made again to see what the new judge says of them.
Like the runs it starts test sessions, one judge test session per trial judged, and only on the
owner's word:

```sh
SCORED_FROM=records/scored/<record>.json SCORED_KEPT=<kept folder>[:<another>] SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<the record's Claude Code> CK3_GAME_PATH=<game dir> task scored:rejudge
```

| Variable | Meaning | Default |
| --- | --- | --- |
| `SCORED_FROM` | The authoring record whose results are judged again: a `.json` file directly in `records/scored/` | none: it must be given |
| `SCORED_KEPT` | The folders its run kept its trials in (`SCORED_KEEP=true` printed each), separated by `:` (`;` on Windows); each trial is `<request>-<n>/` with its `mod/` and `stream.jsonl` | none: it must be given |
| `SCORED_SESSION_LIMIT` | The session limit of each judge test session | none: it must be given |
| `SCORED_RECORD` | Where the record is written: a `.json` file directly in `records/scored/`, never the record read | `<record>-judge-<version>.json` beside it |

`SCORED_JUDGE_MODEL`, `SCORED_JUDGE_TIMEOUT_MINUTES`, `SCORED_CLAUDE` and `SCORED_KEEP` apply as in
the authoring run (`rejudge.ts`).

**Before any session** it refuses, naming every reason, unless the record is an authoring record
whose figures agree; the request list, the base mods and the spec package are the ones it was made
with; `CK3_GAME_PATH` is the game it read (by its manifest); the Claude Code is the version that made
it; and every trial has its kept folder, whose stream is the record's session (its tool calls,
turns, time, start and end) and whose result, graded again over the game, has the record's
validity and expectations to the letter. The trials of the record it writes are therefore the
record's, sessions, results and grades, with only the judge new.

**What it judges**: every trial whose authoring session was set up as the run asks and ended by
itself, by the run's rule of today, also one that did not hold for what its session did (a file
named outside its mod). The judge is given what a run's judge is given. A judge session that does
not hold stops it as a run is stopped ([When a run stops](#when-a-run-stops)), and then it writes
nothing: a record judged partly with one prompt and partly with another is never made.

**The record**: the record read, with the judge's prompt, schema, model, limits and arguments of
this run, each trial's judge and `harness_held` anew, the measures summed again, this run's
command, and a note saying what was re-judged, when, at which commit and with which version of the
judge's prompt; its `tool` and `made_at` stay the record's, as a continued record's do, since they
say what made the sessions and the results. `rejudge.test.ts` holds it with the stand-in: a kept
run whose judge said no, judged again with no authoring session, every trial the record's but its
judge; and each refusal before any session.

## Calibrating the judge (item 9.6)

The judge is calibrated once against results graded by hand, and the agreement is recorded
(`calibration.ts`). Like the runs, it starts test sessions, one judge session per graded result,
and only on the owner's word:

```sh
SCORED_SESSION_LIMIT=3 SCORED_GRADES=<grades file> SCORED_RECORD=records/scored/<record>.json CK3_GAME_PATH=<game dir> task scored:calibrate
```

The judge it calibrates is the runs' judge, given what a run's judge is given: each result with
what pychivalry's checker reports in it over the installed game, and the game's own description
of every keyword it writes ([The judge](#the-judge)). So it reads the game too, as a run does, and
its record states the game.

| Variable | Meaning | Default |
| --- | --- | --- |
| `SCORED_GRADES` | The hand grades, from the repository root | none: it must be given |
| `CK3_GAME_PATH` | The base game's `game` folder, which the checker reads each result over for the judge | none: it must be given |
| `SCORED_RECORD` | Where the record is written: a `.json` file directly in `records/scored/`, from the repository root, so that each sheet's calibration has a record of its own; anywhere else is refused before any session | `records/scored/calibration.json` |

`SCORED_SESSION_LIMIT`, `SCORED_CLAUDE`, `SCORED_JUDGE_MODEL`, `SCORED_JUDGE_TIMEOUT_MINUTES` and
`SCORED_KEEP` apply as in the authoring run.

**Three sheets wait for the owner** ([docs/guide/judge-calibration.md](../../docs/guide/judge-calibration.md),
which gives the command of each):

1. `fixtures/requests/calibration/grades.json`: ten **hand-made** results of six requests, some
   right, some deliberately wrong and some not answerable from their files (26 answers, 10 judge
   test sessions, record `records/scored/calibration-hand-made.json`). Graded first: it is the
   only sheet whose right answers include no and cannot tell by design.
2. `fixtures/requests/calibration/run-2/grades.json`: twelve **real** results of the second run,
   trial 1 of each request, taken by number and not picked (36 answers, 12 judge test sessions,
   record `records/scored/calibration-run-2.json`). Each is the trial's mod with the skills
   folder taken out; a test holds each to the mod's own files, its base whole, in the format and
   holding nothing of the machine the run was made on.
3. `fixtures/requests/calibration/expert/grades.json`: twenty-four **hand-made** results of the
   twelve expert requests, two of each, some right and some wrong on a judged dimension, every one
   passing everything code checks (88 answers, 24 judge test sessions, record
   `records/scored/calibration-expert.json`). Graded last, before the release run, as the other
   two are (decision 135).

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

**The record**, `records/scored/calibration.json` or the file `SCORED_RECORD` names, suite
`scored:calibration`: the game the checker read, the grades file by
its hash, the judge's prompt, schema, model, session limit and arguments, each item's hand grades
and the judge's answers with whether each agrees, and per dimension and over all: the grades, those
the judge answered, those it agreed with, the agreement (agreed over answered), how often the
person and the judge each said "cannot tell", and the full table of hand answer against judge
answer. A judge session with a harness problem stops it, as in the runs.
