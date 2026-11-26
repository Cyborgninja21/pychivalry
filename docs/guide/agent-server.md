# The agent server

pychivalry's agent server gives an AI agent, such as Claude Code or VS Code's built-in AI, the
same checks and lookups as the command line, as tools that return structured data. It speaks the
Model Context Protocol (MCP) over standard input and output: the agent's harness starts it as a
local process. It opens no network port, holds no model and no key, and only reads, but for one
tool, `apply_format`, which writes a file of the mod you name in pychivalry's format.

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

**Skills tell the AI how to use it.** The extension also gives your AI three skills, written
instructions it loads when a task calls for one: explain a finding, fix the mod's errors, and
write new content (events with their localization, decisions, scripted effects and scripted
triggers), each driving the tools below. VS Code's AI has them from the extension; "Set up for
Claude Code" copies them for Claude Code ([Commands](commands.md#the-skills)).

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
writes nothing into the game, and into the mod only what `apply_format` is asked to write: the
one file named, in pychivalry's format (below). Beside that, the only thing it writes is that
index, in your cache folder ([Settings](settings.md)), and only when none is there for the
installed game: a server finds the index the command line saved and loads it in a second or
two. The first request loads it; later requests reuse it. While VS Code has a mod open, the
server asks its language server instead, which holds the index already and answers with the
server's own tools, so the two hold one copy between them; the answers are the same either way,
and when the language server cannot answer, the server loads the index itself
([Settings](settings.md)).

Every request reads the mod's files as they are now. An agent fixes a finding by editing the
files itself, through its own harness, and checks again. A finding with a mechanical fix
carries its edits (below); the server applies none of them.

## The tools

Every tool but `apply_format` is read-only, and each declares the shape of what it takes and
returns; `apply_format` is declared not read-only, so a harness may ask you before it runs. Lines
and columns count from 1, as an editor shows them.

| Tool | Takes | Returns |
| --- | --- | --- |
| `check` | `path`: a file or folder of the mod (the whole mod when left out); `min_severity` (`error` by default; `hint` lists everything); `codes`: codes, families (`names/*`) or `*`; `limit` (50 by default, at most 200); `cursor`; `unused_keys` (true by default; `false` turns it off) | `totals` by severity and by code over every finding of the path, always; `matched`; the `findings` (file, place, severity, code, message, data, fix); `next_cursor`; what the per-file cap left out; the game read; notes |
| `lookup` | `names` (at most 20); `language` (`l_english`); `folder` (`common/decisions`: a field's reading in that folder in full); `evidence` (false by default; true with exactly one name) | Every name answered whole, in the order asked: first its readings, every reading the spec package has with what it is, the game's own description, its scopes, what it takes, its version and its removal or replacement (a field's kind, value type and the values the base game writes); then where the mod and the base game define it, which definition is in force, and at most 3 places of each kind; then how many places use it, by layer, and the first 3; for a name nothing knows, names close to it. `not_answered` names the names that did not fit in the result, to look up in another call; there is no cursor. With `evidence`, the one name's answer also holds `evidence`: its readings as `pychivalry lookup --json` prints them, with the spec package's evidence behind each part ([below](#evidence)) |
| `find_definition` | `name`, or `file`, `line` and `column` of a place in the mod | The name written there, and its definitions by kind, the one in force first, with the rule that decides |
| `find_references` | `name`; `limit`; `cursor` | The count by layer, then the places it is written, the mod's first |
| `list_definitions` | `kind`: the folder that holds the definitions (`common/scripted_effects`, `events`), a localization language (`localization:l_english`), or since build step 10 GUI types (`gui`) and templates (`gui:templates`); `limit`; `cursor` | The count by layer, then the definitions, the mod's first, each with whether it is in force |
| `source` | A place as results write it: `layer`, `file` (its path inside the layer) and `line`; `end_line`; `context` (10 lines by default, at most 20) | The text around it, at most 40 lines, each its number, a tab and its text, of a script, localization or GUI file pychivalry reads, in the base game or the mod: to see how the game itself writes a name. Never by an address on disk: an absolute path, `..`, a link or a file outside its layer is refused. The same lines, and the same refusals, as `pychivalry source <layer> <file> <line>` on the terminal ([Commands](commands.md#options-of-source)), from the same code |
| `explain_code` | `codes`: codes, families or `*` | What each code means: its severity, what it finds, the game's evidence with the game's own message, and whether it is off by default or can be turned off |
| `format` | `file`: a script or localization file of the mod the game reads; `cursor` | The file formatted by pychivalry's rules ([Formatting](formatting.md)), as a proposal: nothing is written. `formatted` (false for a file with a parse error or not valid UTF-8, with the `reason`), `changed`, `bom` and `line_ending` (`crlf`), `total_lines`, and the `text` from `first_line`, without the byte-order mark, a page at a time with `next_cursor`; no text when nothing changes |
| `apply_format` | `file`: a script or localization file of the mod the game reads | The same formatting **written to the file**, as `pychivalry format <file>` writes it: Windows line breaks and the UTF-8 byte-order mark, whitespace only, never a token or a comment changed. `written` (false when the file is already in the format, or is left as it is), `formatted`, `changed`, `reason`, `bom`, `line_ending`, `total_lines`. It exists because an AI harness's own file tools may not write Windows line breaks or the mark: the first scored authoring run left every file it wrote out of the format |

Two more tools come with the steps that build them: `call_graph` (step 10) and `analyze_log`
(step 11). The tools' shapes are schema version 5 since `lookup` took `evidence` (step 9): its
answers are otherwise unchanged, and without `evidence` no answer holds more than under version
4, which came with `source`, `lookup` answering every name whole and places that say their layer
(step 9; version 3 came with `apply_format`, version 2 with `format`, step 8).

### Evidence

`lookup`'s answer gives each reading's facts, not the evidence behind them, so that every name a
session asks about fits one result. When an agent has to show where a fact comes from, why a name
is wrong for one, it asks for one name with `"evidence": true`. The answer is the same, and holds
`evidence` beside it:

- `spec`: the spec package the evidence is from, its version and checksum;
- `readings`: the name's readings whole, in order, as `pychivalry lookup --json` prints them in
  its `readings`: what the game's own documentation, output, `.info` files and base game say of
  each part, and where the package read it (with `folder`, only that folder's field readings, as
  the answer has them). Every place in them is written as every other place here, from line 1,
  with its layer and `read_with`;
- `readings_total`: how many readings the name has;
- `left_out`: null when every reading is given; otherwise the readings after those given, whose
  evidence did not fit the result, never cut inside one: how many, the characters they hold, and
  `ask`, what to ask instead (`folder`, for a field of many folders). Of the spec package's 15,852
  names, the evidence of 15,758 fits whole.

It is given for one name a call; asked for with more, `lookup` says so and how to ask, and
answers nothing. Off by default, it adds nothing to any other answer.

**Places.** Every place a tool names, a finding's, a definition's, a use's, is written the same
way: its `layer`, its `file` (the path inside that layer, with `/`), and `line`, `column`,
`end_line` and `end_column`. A place of the layer `mod` is a file of your mod. A place of any
other layer (`game`, `jomini`, `clausewitz`, `dlc:<pack>`) is a file of the installed game,
outside the mod, and says `"read_with": "source"`: an agent reads it with `source`, never with
its own file tools, which in a scored test session must not leave the mod.

**Tool names.** The names here, and in the server's own instructions, are the bare ones. A
client may list them under a prefix of its own: Claude Code lists `check` as
`mcp__pychivalry__check`. An agent calls each tool by the name its client lists.

`check` is the one to start with. Its totals come first and count every finding of the path,
whatever the filters keep, so the agent sees the whole picture before the list. Every check runs,
`localization/unused-key` too: `unused_keys: false` turns that one off. The `style/` findings
rest on pychivalry's own rules, not on the game: its formatting rules say where a file is not in
pychivalry's format, and their fixes, like `format`'s text, change only whitespace; its
best-practice rules flag a file that is not UTF-8 (a warning, which says how the file was read,
with a fix that converts it), an empty block, a block nested too deep, fields in an unusual order,
a localization key with a character other than a letter, a digit, `_` or `.`, a condition that
always holds where it changes nothing (an `always = yes` in an `AND`, with a safe fix that takes it
away) and an option of an event with several options that gives the AI no weight (`ai_chance`,
`ai_will_select`). A fix too long for a result
comes with its edits left out and `edits_omitted`: `format` gives a formatting fix's text, and
the command line's `check --fix` applies any safe fix.

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
- `variables/read-without-set`: the variable (`variable`), the keyword or link that reads it
  (`keyword`), its namespace and kind (`namespace`, `holds`), and `set_by`, the keywords that set
  a variable of that namespace and kind, from the spec package's table of the keywords of
  variables.

A finding's `fix` is null, or its mechanical fix as data, the same the editor's quick fixes and
the command line's `--json` give:

- `safety`: `safe` when only one outcome can be right (a misspelling with one valid name near
  it, a removed keyword with its one documented replacement, a missing `=` the parser already
  read); `suggestion` when the right fix is a choice, which the agent makes.
- `basis`: what it rests on (`retired`, `nearest-name`, `scope-links`, `parser`, ...).
- `alternatives`: at most five, nearest or most likely first, with `alternatives_total` when
  there are more; each a `title` and its `edits`, each edit a `file` of the mod with a place
  (`line`, `column`, `end_line`, `end_column`, counted from 1) and the `new_text` that replaces
  it. An edit may be in another file than the finding's (a localization stub goes into the
  mod's localization file), or make a new file (`create`, its `new_text` the whole file, the
  byte-order mark the game needs first).

The server applies no fix: an agent applies a fix with its own edit tool, every edit of the one
alternative it chose, each place read against the file as it was before any of them, then
checks again. A finding with no fix (`fix: null`) is one whose right change is a choice the data
does not make: an event with no option, a definition two files share.

## Results stay small

A result never holds more than about 10,000 tokens: Claude Code cuts a tool's result off at
25,000. Fixes count: a page of `check` holds as many findings, fixes and all, as fit. A list
that does not fit gives `next_cursor`; the same call with `cursor` set to it gives
the next page, and a cursor continues only the answer it came from. `lookup` never pages: each
name it answers is answered whole, and the names that did not fit are listed in `not_answered`,
to look up in another call. A name that is a field of more than three folders (`trait` is a
trigger, an effect, a link, a list, a field of nine folders and a scope type) has its fields in
brief, `folder` giving one folder's field in full; a name whose answer is still too large for a
result has its fields listed by folder (`detail`). The rest of a name's uses is
`find_references`, a page at a time. A name's `evidence` gives as many whole readings as fit and
counts the rest in `left_out`. `source` shows at most 40 lines, and lines whose text, written as
JSON, would pass 12,000 characters are left out and said to be. `explain_code` names the codes it
left out, to ask for again.

## Bad input

A call the server cannot answer comes back as a result marked as an error, never as a protocol
error, and its text says what is wrong and what would be valid:

```text
min_severity: "fatal" is not one of the valid values: error, warning, information, hint
codes: names/no-such-check matches no code of this build; the codes are definitions/clash, ...; a whole family is written definitions/*, ...
kind: scripted_effects holds no definition in the mod or the base game; did you mean common/scripted_effects; ...
cursor: it was given for other arguments. A cursor only continues the answer of the call that gave it, repeated with exactly the same arguments; to ask anything else, call again without cursor
file: the path may hold no empty, . or .. part; give the path inside its layer, as a result names it
evidence: given with 2 names, and it is given for one name a call. Ask lookup with that one name and evidence true, once for each name whose evidence you need, and look the other names up in one call without evidence
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
            "layer": "mod",
            "file": "common/scripted_triggers/fixture_triggers.txt",
            "line": 16, "column": 2, "end_line": 16, "end_column": 25,
            "severity": "error",
            "code": "names/unknown-trigger",
            "message": "Unknown trigger 'fixture_made_up_trigger'",
            "data": { "name": "fixture_made_up_trigger" },
            "fix": null
        },
        {
            "layer": "mod",
            "file": "common/scripted_triggers/fixture_triggers.txt",
            "line": 17, "column": 2, "end_line": 17, "end_column": 10,
            "severity": "error",
            "code": "names/unknown-trigger",
            "message": "Unknown trigger 'add_gold'",
            "data": { "name": "add_gold", "buckets": ["effects"] },
            "fix": null
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
`character` scope and taking `yes/no`, and its uses list places of the base game such as
`{ "layer": "game", "file": "common/...", "line": 12, ..., "read_with": "source" }`; to see how
the game writes it there, it calls `source` with that layer, file and line. It edits the file,
then calls `check` again, which reads the file as it now is. Had it wanted the rest of the list first, the same call with
`"cursor": "MjoyMDVkZjU5NTg3M2E"` would have given the third finding on.
