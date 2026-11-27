---
name: pychivalry-fix-error
description: Fix the errors and warnings pychivalry reports in a Crusader Kings 3 (CK3) mod, by checking, looking up what is valid, asking what calls a scripted effect, scripted trigger or event before changing it, editing, and checking again until none is left or 5 rounds have passed, then formatting what was changed. Use when the user asks to fix, repair or clean up CK3 script errors, warnings or pychivalry style findings in a mod. Uses pychivalry's agent server (check, explain_code, lookup, find_definition, find_references, list_definitions, call_graph, source, format, apply_format).
---

# Fix what pychivalry finds

pychivalry checks a Crusader Kings 3 mod the way the game itself reads it, and its agent server
says what is wrong, what is valid instead and, often, the exact edit that fixes it. The server
only reads, but for `mcp__pychivalry__apply_format`, which writes a file you name in
pychivalry's format: you make every other edit with your own edit tool, and your harness shows
the person the edits. Repair from what the tools return, never from memory of CK3.

**Call each tool by the name your client lists.** Every tool is written here by the name Claude Code
lists it under, `mcp__pychivalry__` and the tool's own name: `mcp__pychivalry__check`,
`mcp__pychivalry__explain_code`, `mcp__pychivalry__lookup`, `mcp__pychivalry__find_definition`,
`mcp__pychivalry__find_references`, `mcp__pychivalry__list_definitions`,
`mcp__pychivalry__call_graph`, `mcp__pychivalry__source`, `mcp__pychivalry__format`,
`mcp__pychivalry__apply_format`. Only a listed name can be called: a call of a short name reaches
nothing, and Claude Code answers that there is no such tool. Another client lists the same tools
under its own prefix (VS Code's Copilot harness `pychivalry-`, VS Code's own `mcp_pychivalry_`, each
before the tool's own name): there, call the tool whose name ends in the same tool's name. If a call
finds no such tool, call the same tool again by its listed name. If no pychivalry tool is offered at
all, say so and stop: in VS Code the extension registers the agent server by itself; for Claude
Code, the person runs "pychivalry: Set up for Claude Code" in VS Code once for the mod's folder.

## The rules

1. **Fix at the cause.** A finding's fix may edit another file than the finding's own (a
   localization key goes in a localization file; a misspelt name may be fixed where it is
   defined). Follow the fix and the finding's data, not the line alone.
2. **Never delete content to silence a finding,** and change nothing a finding does not ask
   for. If a name the mod defines is renamed, every use of it is renamed with it:
   `mcp__pychivalry__find_references` lists them.
3. **Check again after every round of edits.** Every `mcp__pychivalry__check` reads the files as
   they are now.
4. **Stop when `mcp__pychivalry__check` reports no error and no warning, or after 5 rounds.** A
   round is one `mcp__pychivalry__check` and the edits made from it.
5. **Never claim success while an error or a warning is left.** Say what is left, with its code,
   file, line and message, and why it was not fixed.
6. **Ask what calls a definition before you change it.** Before you edit a scripted effect, a
   scripted trigger or an event, a definition in `common/scripted_effects`,
   `common/scripted_triggers` or `events`, run `mcp__pychivalry__call_graph` with `names` the
   name it is defined under (an event by its id) and `direction` set to `callers`. It lists every
   definition that calls it, in the mod and the base game, each with its `kind` and its place: a
   change to the definition reaches each of them, and your report says which. Every name it
   answers is answered whole; one listed in `not_answered` did not fit: ask about it in another
   call. A name with more callers than one answer holds comes with `detail` set to `cut`: its
   counts are whole, its callers listed in part.

## Steps

1. **See everything first.** Run `mcp__pychivalry__check` (the whole mod, or `path` a file or
   folder of it) with `min_severity` set to `warning`. The `totals` count every finding by
   severity and by code, whatever is listed; the findings come a page at a time (follow
   `next_cursor`). Lines and columns count from 1, and an end column is the column just after
   the end.
2. **For each finding with a `fix`:**
   - `safety` is `safe`: apply its one alternative as it is, every one of its `edits` (each
     replaces the text from `line` and `column` to `end_line` and `end_column` of its `file`
     with `new_text`; an edit with `create` true makes the file). The edits of a fix are given
     against the file as it was before any of them: apply a file's edits from its last to its
     first.
   - `safety` is `suggestion`: choose the one alternative that is right here, by what
     `mcp__pychivalry__lookup` says of the names in it and what the person asked for; if none is
     clearly right, make no edit and say so.
3. **For a finding with no fix:** run `mcp__pychivalry__explain_code` on its code, and
   `mcp__pychivalry__lookup` on the names its message and data mention: the scopes a name is
   valid in, what it takes, the values a field takes (give `folder` the finding's folder for a
   field), and, for a name nothing knows, the names close to it. Every name
   `mcp__pychivalry__lookup` answers is answered whole; one listed in `not_answered` did not fit:
   look it up in another call. For a name the mod or the game defines,
   `mcp__pychivalry__find_definition` shows where, and `mcp__pychivalry__list_definitions` with
   `kind` the folder lists what is defined there. To see how the game itself writes a name,
   `mcp__pychivalry__source` shows the text around a place `mcp__pychivalry__lookup` or
   `mcp__pychivalry__find_references` named. A place whose `layer` is not `mod` is a file of the
   installed game, outside the mod, and says `read_with`: read it with `mcp__pychivalry__source`
   only, never with your own file tools, which cannot reach it. Edit only when the tools show
   what is right.
4. **Check again,** and repeat from step 2 for what is left, within the 5 rounds.
5. **Leave the files in the format.** pychivalry writes every file with Windows line breaks and
   the UTF-8 byte-order mark, and lays it out one way. A file not in the format is the warning
   `style/not-formatted`, with a safe fix; a file that is not valid UTF-8 is the warning
   `style/not-utf8`, with a fix that converts it. Run `mcp__pychivalry__apply_format` on each
   file you changed: it writes the file in the format (`written` true), or says it already is
   (`changed` false), or why it is left as it is (`reason`: a parse error to fix first, or a file
   not UTF-8, which the fix of `style/not-utf8` converts). Do not write the text of
   `mcp__pychivalry__format` back yourself: your own file tool may write bare line feeds or leave
   the byte-order mark out. Read a file again before editing it after
   `mcp__pychivalry__apply_format` wrote it. When `pychivalry` runs in a terminal you can use,
   `pychivalry format <file>` does the same, and `pychivalry check --fix .` in the mod's folder
   applies every safe fix of the whole mod (run it only when the person wants every safe fix
   applied).
6. **Report.** What you changed and why, file by file; for each scripted effect, scripted trigger
   or event you changed, what calls it, as `mcp__pychivalry__call_graph` listed it (rule 6), and
   so what the change affects; the last `mcp__pychivalry__check`'s totals; and anything left, as
   rule 5 says.

Information and hints are pychivalry's advice, not the game's: fix them only when the person
asks. When the person asks to clean up the `style/` findings, the hints among them are fixed as
the warnings are: one with a `fix` as step 2 says, one without as step 3 says. Of those,
`style/option-without-ai-weight` has no fix, since how much the AI wants an option is the
author's to say: write in each option it names one of the keywords it names, looked up first,
with the weight the person asks for, or the same weight for every option of the event when they
name none, and say which you gave. Unused localization keys can be thousands of hints;
`mcp__pychivalry__check` with `unused_keys` false leaves them out.
