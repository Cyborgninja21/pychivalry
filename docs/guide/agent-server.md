# The agent server

pychivalry's agent server gives an AI agent, such as Claude Code or VS Code's built-in AI, the
same checks and lookups as the command line, as tools that return structured data. It speaks the
Model Context Protocol (MCP) over standard input and output: the agent's harness starts it as a
local process. It opens no network port, holds no model and no key, and only reads.

**No key, no login, no model call.** pychivalry contains no API key, no token and no login,
and never will. None of its packages makes a network call or a model call: the agent server is
a local program that reads your mod and game files and answers questions. The AI is always
another program that connects to it: Claude Code, or VS Code's built-in AI, signed in however
you already signed it in. pychivalry's developers also run a test of the server, the scored
agent-use test. It is a developer's test script: not shipped, not part of the extension, and
never run by CI. It starts the Claude Code already installed on the developer's own machine, as
a separate test session with the agent server attached, and grades in code what that session
did to a copy of a test mod. It gives Claude Code no credentials and removes any key or token
variable from the session's environment; each test session counts against that developer's own
Claude plan, like any session they open themselves. Nothing of it runs on your machine.

**It ships inside the extension.** Installed, the extension registers the server with VS Code's
own AI (the Copilot harness), one server for each folder you open, bound to that folder as the
mod and given the game folder `pychivalry.gamePath` names; VS Code's AI sees it with nothing more
to do ("MCP: List Servers" lists `pychivalry`). For Claude Code, run "pychivalry: Set up for
Claude Code" once in the mod's folder ([Commands](commands.md)). Both start the same command line:
VS Code's own executable, run as Node, on the server's copy in the extension's storage folder,
whose path does not change when the extension updates:

```text
<VS Code> <storage>/agent-server/pychivalry-mcp.mjs --mod <mod folder> --spec <storage>/agent-server/spec [--vanilla <game folder>]
```

Outside the extension it runs from a build of this repository, as below.

## Starting it

```text
node packages/mcp/dist/main.js [--mod <folder>] [--vanilla <game folder> | --no-vanilla] [--spec <file or folder>]
```

| Argument | What it does |
| --- | --- |
| `--mod <folder>` | The mod it works on. By default, the folder it is started in, which is the workspace folder when a harness starts it |
| `--vanilla <game>` | The game's `game` folder, the one holding `common/`. Without it, the game is looked for in every Steam library |
| `--no-vanilla` | Work without the base game: names the game defines are then not judged, never reported unknown |
| `--spec <file>` | Another spec package file, or its folder; by default the one pychivalry ships |

Arguments it cannot use stop it before it starts, with the reason on standard error and exit
code 2. For Claude Code without the extension, a project's `.mcp.json` can start a build of the
repository:

```json
{
    "mcpServers": {
        "pychivalry": {
            "command": "node",
            "args": ["<repository>/packages/mcp/dist/main.js", "--mod", "<mod folder>"]
        }
    }
}
```

## What it reads and writes

It reads the mod folder, the game folder, the spec package and its index of the base game. It
writes nothing into the mod or the game. The only thing it ever writes is that index, in your
cache folder ([Settings](settings.md)), and only when none is there for the installed game: a
server finds the index the command line saved and loads it in a second or two. The first request
loads it; later requests reuse it.

Every request reads the mod's files as they are now. An agent fixes a finding by editing the
files itself, through its own harness, and checks again.

## The tools

Every tool is read-only and declares the shape of what it takes and returns. Lines and columns
count from 1, as an editor shows them.

| Tool | Takes | Returns |
| --- | --- | --- |
| `check` | `path`: a file or folder of the mod (the whole mod when left out); `min_severity` (`error` by default; `hint` lists everything); `codes`: codes, families (`names/*`) or `*`; `limit` (50 by default, at most 200); `cursor`; `unused_keys` (false by default) | `totals` by severity and by code over every finding of the path, always; `matched`; the `findings` (file, place, severity, code, message, data); `next_cursor`; what the per-file cap left out; the game read; notes |
| `lookup` | `names` (at most 20); `language` (`l_english`); `cursor` | For each name, the command line's `lookup --json` answer: every reading of the spec package, with its description, scopes and what it takes; where the mod and the base game define and use it, and which definition is in force; for a name nothing knows, names close to it |
| `find_definition` | `name`, or `file`, `line` and `column` of a place in the mod | The name written there, and its definitions by kind, the one in force first, with the rule that decides |
| `find_references` | `name`; `limit`; `cursor` | The count by layer, then the places it is written, the mod's first |
| `list_definitions` | `kind`: the folder that holds the definitions (`common/scripted_effects`, `events`) or a localization language (`localization:l_english`); `limit`; `cursor` | The count by layer, then the definitions, the mod's first, each with whether it is in force |
| `explain_code` | `codes`: codes, families or `*` | What each code means: its severity, what it finds, the game's evidence with the game's own message, and whether it is off by default |

Three more tools come with the steps that build them: `format` (step 8), `call_graph` (step 10)
and `analyze_log` (step 11).

**Tool names.** The names here, and in the server's own instructions, are the bare ones. A
client may list them under a prefix of its own: Claude Code lists `check` as
`mcp__pychivalry__check`. An agent calls each tool by the name its client lists.

`check` is the one to start with. Its totals come first and count every finding of the path,
whatever the filters keep, so the agent sees the whole picture before the list. Every check runs
except `localization/unused-key`, which is off by default: `unused_keys` turns it on.

A finding's `message` is the game's own, as the game writes it; its `data` names what it is
about and, where pychivalry knows it, what is valid there:

- `scope/wrong-scope-for-effect`, `scope/wrong-scope-for-trigger`: the keyword (`name`), the
  scope it is in (`scope`), the scopes it takes (`expected`), and `links_from_scope`, the links
  that lead from that scope to one of them (`capital_county`, `primary_title`, ...; chains of
  two, `culture_head.primary_title`, where no one link does), at most 12, with
  `links_from_scope_total` when there are more.
- `scope/link-on-wrong-scope`: the link (`link`), the scope it was applied to, the scopes it
  starts from (`expected`) and `links_from_scope` the same way.
- `fields/missing-required-field` and `fields/wrong-kind-of-value`: the field, its measured
  `value_type` and `values`, the values the base game writes in it (at most 20, the most written
  first; `values_total` when there are more). They are measurements of the base game, not rules
  of the game.

## Results stay small

A result never holds more than about 10,000 tokens: Claude Code cuts a tool's result off at
25,000. A list that does not fit gives `next_cursor`; the same call with `cursor` set to it gives
the next page. `lookup` pages the same way when one name's answer is long (`trait` is a trigger,
an effect, a link, a list, a field of nine folders and a scope type): the rest of a name comes
back as `{ "name": ..., "continued": true, "readings": [...] }`. `explain_code` names the codes it
left out, to ask for again.

## Bad input

A call the server cannot answer comes back as a result marked as an error, never as a protocol
error, and its text says what is wrong and what would be valid:

```text
min_severity: "fatal" is not one of the valid values: error, warning, information, hint
codes: names/no-such-check matches no code of this build; the codes are definitions/clash, ...; a whole family is written definitions/*, ...
kind: scripted_effects holds no definition in the mod or the base game; did you mean common/scripted_effects; ...
cursor: it was given for other arguments; repeat the arguments of the call that gave it, or leave it out to start from the first
```

## An example exchange

An agent checks a mod with an unknown trigger, two findings at a time:

```json
{ "name": "check", "arguments": { "limit": 2 } }
```

```json
{
    "files_checked": 2,
    "totals": {
        "by_severity": { "error": 5, "warning": 0, "information": 0, "hint": 0 },
        "by_code": { "names/unknown-trigger": 5 }
    },
    "matched": 5,
    "findings": [
        {
            "file": "common/scripted_triggers/fixture_triggers.txt",
            "line": 16, "column": 2, "end_line": 16, "end_column": 25,
            "severity": "error",
            "code": "names/unknown-trigger",
            "message": "Unknown trigger 'fixture_made_up_trigger'",
            "data": { "name": "fixture_made_up_trigger" }
        },
        {
            "file": "common/scripted_triggers/fixture_triggers.txt",
            "line": 17, "column": 2, "end_line": 17, "end_column": 10,
            "severity": "error",
            "code": "names/unknown-trigger",
            "message": "Unknown trigger 'add_gold'",
            "data": { "name": "add_gold", "buckets": ["effects"] }
        }
    ],
    "next_cursor": "MjoyMDVkZjU5NTg3M2E",
    "capped": { "max_per_file": 1000, "files": 0, "dropped": 0 },
    "game": { "build": "1.21.0.3", "from_cache": true },
    "notes": []
}
```

`add_gold` is in the effects bucket, not the triggers one (`data.buckets`). The agent asks what
the code means and what the game's evidence is; each value of a message is a named slot
(`<trigger>`):

```json
{ "name": "explain_code", "arguments": { "codes": ["names/unknown-trigger"] } }
```

```json
{
    "codes": [
        {
            "code": "names/unknown-trigger",
            "family": "names",
            "severity": "error",
            "finds": "A key in a trigger block that is no trigger there.",
            "evidence": { "kind": "catalogue", "id": "unknown_trigger_X", "text": "Unknown trigger '<trigger>'" },
            "message": "Unknown trigger '<trigger>'",
            "off_by_default": false
        }
    ],
    "unknown": [],
    "not_shown": []
}
```

Then it looks up a trigger it means to use instead (`lookup` with `"names": ["is_adult"]`): the
answer's first reading is the trigger, `"Is the scope character adult?"`, valid in the
`character` scope and taking `yes/no`. It edits the file, then calls `check` again, which reads
the file as it now is. Had it wanted the rest of the list first, the same call with
`"cursor": "MjoyMDVkZjU5NTg3M2E"` would have given the third finding on.
