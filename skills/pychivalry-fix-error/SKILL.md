---
name: pychivalry-fix-error
description: Fix the errors and warnings pychivalry reports in a Crusader Kings 3 (CK3) mod, by checking, looking up what is valid, editing, and checking again until none is left or 5 rounds have passed, then formatting what was changed. Use when the user asks to fix, repair or clean up CK3 script errors, warnings or pychivalry style findings in a mod. Uses pychivalry's agent server (check, explain_code, lookup, find_definition, find_references, list_definitions, format, apply_format).
---

# Fix what pychivalry finds

pychivalry checks a Crusader Kings 3 mod the way the game itself reads it, and its agent server
says what is wrong, what is valid instead and, often, the exact edit that fixes it. The server
only reads, but for `apply_format`, which writes a file you name in pychivalry's format: you make
every other edit with your own edit tool, and your harness shows the person the edits. Repair
from what the tools return, never from memory of CK3.

**Call each tool by the name your client lists.** The tools are written here by their short names,
such as `check`, but Claude Code, for one, lists them under longer names, and only a listed name
can be called: a call of a short name reaches nothing, and Claude Code answers that there is no
such tool. In Claude Code the names are `mcp__pychivalry__check`, `mcp__pychivalry__explain_code`,
`mcp__pychivalry__lookup`, `mcp__pychivalry__find_definition`, `mcp__pychivalry__find_references`,
`mcp__pychivalry__list_definitions`, `mcp__pychivalry__format`, `mcp__pychivalry__apply_format`.
Call each by the name your client lists, never by the short name alone; if a call finds no such
tool, call the same tool again by its listed name. If no pychivalry tool is offered at all, say so
and stop: in VS Code the extension registers the agent server by itself; for Claude Code, the
person runs "pychivalry: Set up for Claude Code" in VS Code once for the mod's folder.

## The rules

1. **Fix at the cause.** A finding's fix may edit another file than the finding's own (a
   localization key goes in a localization file; a misspelt name may be fixed where it is
   defined). Follow the fix and the finding's data, not the line alone.
2. **Never delete content to silence a finding,** and change nothing a finding does not ask
   for. If a name the mod defines is renamed, every use of it is renamed with it:
   `find_references` lists them.
3. **Check again after every round of edits.** Every `check` reads the files as they are now.
4. **Stop when `check` reports no error and no warning, or after 5 rounds.** A round is one
   `check` and the edits made from it.
5. **Never claim success while an error or a warning is left.** Say what is left, with its code,
   file, line and message, and why it was not fixed.

## Steps

1. **See everything first.** Run `check` (the whole mod, or `path` a file or folder of it) with
   `min_severity` set to `warning`. The `totals` count every finding by severity and by code,
   whatever is listed; the findings come a page at a time (follow `next_cursor`). Lines and
   columns count from 1, and an end column is the column just after the end.
2. **For each finding with a `fix`:**
   - `safety` is `safe`: apply its one alternative as it is, every one of its `edits` (each
     replaces the text from `line` and `column` to `end_line` and `end_column` of its `file`
     with `new_text`; an edit with `create` true makes the file). The edits of a fix are given
     against the file as it was before any of them: apply a file's edits from its last to its
     first.
   - `safety` is `suggestion`: choose the one alternative that is right here, by what `lookup`
     says of the names in it and what the person asked for; if none is clearly right, make no
     edit and say so.
3. **For a finding with no fix:** run `explain_code` on its code, and `lookup` on the names its
   message and data mention: the scopes a name is valid in, what it takes, the values a field
   takes, and, for a name nothing knows, the names close to it. For a name the mod or the game
   defines, `find_definition` shows where, and `list_definitions` with `kind` the folder lists
   what is defined there. Edit only when the tools show what is right.
4. **Check again,** and repeat from step 2 for what is left, within the 5 rounds.
5. **Leave the files in the format.** pychivalry writes every file with Windows line breaks and
   the UTF-8 byte-order mark, and lays it out one way. A file not in the format is the warning
   `style/not-formatted`, with a safe fix; a file that is not valid UTF-8 is the warning
   `style/not-utf8`, with a fix that converts it. Run `apply_format` on each file you changed:
   it writes the file in the format (`written` true), or says it already is (`changed` false),
   or why it is left as it is (`reason`: a parse error to fix first, or a file not UTF-8, which
   the fix of `style/not-utf8` converts). Do not write the text of `format` back yourself: your
   own file tool may write bare line feeds or leave the byte-order mark out. Read a file again
   before editing it after `apply_format` wrote it. When `pychivalry` runs in a terminal you can
   use, `pychivalry format <file>` does the same, and `pychivalry check --fix .` in the mod's
   folder applies every safe fix of the whole mod (run it only when the person wants every safe
   fix applied).
6. **Report.** What you changed and why, file by file; the last `check`'s totals; and anything
   left, as rule 5 says.

Information and hints are pychivalry's advice, not the game's: fix them only when the person
asks. Unused localization keys can be thousands of hints; `check` with `unused_keys` false leaves
them out.
