---
name: pychivalry-write-content
description: Write new Crusader Kings 3 (CK3) mod content that the game accepts, events with their localization, decisions, scripted effects and scripted triggers. Use when the user asks to write, add, create or draft CK3 script for a mod. Looks every name up first with pychivalry's agent server, runs its checker and repairs from the findings for at most 5 rounds, formats what it writes, and never claims success while an error is left.
---

# Write new CK3 content

pychivalry checks a Crusader Kings 3 mod the way the game itself reads it. Its agent server knows
every trigger, effect, scope link, modifier, on-action and record field of the game, with the
game's own documentation, and its checker says whether what you wrote is valid. You draft; the
tools decide. Never trust memory of CK3 for a name: models remember names that the game does not
have, or had once.

**Call each tool by the name your client lists.** Every tool is written here by the name Claude
Code lists it under, `mcp__pychivalry__` and the tool's own name: `mcp__pychivalry__check`,
`mcp__pychivalry__lookup`, `mcp__pychivalry__find_definition`,
`mcp__pychivalry__list_definitions`, `mcp__pychivalry__find_references`,
`mcp__pychivalry__source`, `mcp__pychivalry__explain_code`, `mcp__pychivalry__format`,
`mcp__pychivalry__apply_format`. Only a listed name can be called: a call of a short name reaches
nothing, and Claude Code answers that there is no such tool. Another client lists the same tools
under its own prefix (VS Code's Copilot harness `pychivalry-`, VS Code's own `mcp_pychivalry_`,
each before the tool's own name): there, call the tool whose name ends in the same tool's name.
If a call finds no such tool, call the same tool again by its listed name. If no pychivalry tool
is offered at all, say so and stop: in VS Code the extension registers the agent server by
itself; for Claude Code, the person runs "pychivalry: Set up for Claude Code" in VS Code once for
the mod's folder.

## The rules

These hold for every request, whatever else it asks.

1. **Look names up before using them.** Before you write a trigger, an effect, a scope link, a
   modifier, an on-action, a field or a value, `mcp__pychivalry__lookup` it (up to 20 names a
   call): it says whether the game has it, where it is valid (its scopes, the folders a field
   belongs to), what it takes, and the game's own description. Every name
   `mcp__pychivalry__lookup` answers is answered whole; a name that did not fit is listed in
   `not_answered`: look it up in another call. A name `mcp__pychivalry__lookup` does not know is
   not written; the names close to it that it offers are candidates, each looked up in turn. A
   name the mod or the game defines (an event, a trait, a scripted effect) is checked with
   `mcp__pychivalry__find_definition`.
2. **Write events with their localization.** The texts an event shows are written in its script
   as localization keys (`mcp__pychivalry__lookup` of a field says whether it holds one), and
   every key you write is defined in the mod's localization, with real text, in the same change.
   A `localization/missing-key` finding means this rule is not met: its fix names the file and
   the line to add (and creates the file when the mod has none); write the real text instead of
   the key the stub repeats. The same holds for the keys of a decision.
3. **Run the checker.** After writing, run `mcp__pychivalry__check` with `path` each file you
   wrote or changed and `min_severity` set to `warning`.
4. **Repair from the findings.** Fix each error and warning from what the finding, its `fix` and
   its data say, and from `mcp__pychivalry__lookup` and `mcp__pychivalry__explain_code`: the
   pychivalry-fix-error skill says how. Then check again.
5. **Stop at zero errors, or after 5 rounds.** A round is one `mcp__pychivalry__check` and the
   repairs made from it. Stop when the files you wrote show zero errors, no `style/` warning
   (rule 7) and no option without an AI weight (rule 8), or when the fifth round's
   `mcp__pychivalry__check` is done, whichever comes first.
6. **Never claim success with errors left.** If an error, a `style/` warning or an option
   without an AI weight is left after the fifth round, say that the content is not finished, and
   list what is left: code, file, line and message.
7. **Format what you write.** pychivalry writes every file with Windows line breaks and the
   UTF-8 byte-order mark, and lays it out one way. Run `mcp__pychivalry__apply_format` on each
   file you wrote or changed: it writes the file in the format (`written` true), or says it
   already is (`changed` false), or why it is left as it is (`reason`). Do not write the text of
   `mcp__pychivalry__format` back yourself: your own file tool may write bare line feeds or leave
   the byte-order mark out, and the file then stays out of the format. No `style/` finding may be
   left: `style/not-formatted` and `style/not-utf8` are warnings, and count as errors here. Read
   a file again before editing it after `mcp__pychivalry__apply_format` wrote it. When
   `pychivalry` runs in a terminal you can use, `pychivalry format <file>` does the same.
8. **Give every option an AI weight.** In an event with more than one option, write in every
   option how much the AI wants it, with one of the keywords whose keyword role in
   `mcp__pychivalry__lookup`'s answer is `ai_weight`: look each up with `folder` set to `events`
   before writing it (rule 1). An option without one is the hint
   `style/option-without-ai-weight`. `mcp__pychivalry__check` counts it in its `totals` whatever
   `min_severity` is, and `mcp__pychivalry__check` with `codes` set to that code and
   `min_severity` set to `hint` lists each, naming the keywords that give the weight. How much
   each option weighs is a choice: take it from what the request says of the options, give every
   option the same weight when it says nothing, and say which choice you made.

## What you can write

| Content | Where it goes |
| --- | --- |
| An event, with its localization | A file in `events` of the mod, its texts in `localization` |
| A decision | A file in `common/decisions`, its texts in `localization` |
| A scripted effect | A file in `common/scripted_effects` |
| A scripted trigger | A file in `common/scripted_triggers` |

Content of another kind is outside this skill: say so, and check whatever you write all the
same.

## Steps

1. **Read the request,** and note each thing it asks the content to do: who it is for, when it
   happens, what it shows, what each choice does. Where the request leaves a choice open, make
   it, and say which choice you made.
2. **Learn the folder from the game.** `mcp__pychivalry__list_definitions` with `kind` the folder
   (`events`, `common/decisions`, ...) lists what the mod and the base game define there.
   `mcp__pychivalry__lookup` each field you mean to write, with `folder` set to that folder: its
   reading as a field of that folder gives Paradox's own documentation of it, its value type,
   whether it holds a localization key and, where they are few, the values the base game writes.
   Run `mcp__pychivalry__check` on the mod once before you start: what it already reports is not
   yours to fix unless asked, and you will not mistake it for your own.
3. **See how the game itself writes it,** when the readings leave you unsure:
   `mcp__pychivalry__lookup` and `mcp__pychivalry__find_references` name places where the base
   game uses a name, and `mcp__pychivalry__source` shows the text around one (its `layer`, `file`
   and `line`, as the place gives them). A place whose `layer` is not `mod` is a file of the
   installed game, outside the mod, and says `read_with`: read it with `mcp__pychivalry__source`
   only, never with your own file tools, which cannot reach it.
4. **Name things so they clash with nothing.** Give everything you define a name of the mod's
   own, with a prefix the mod already uses if it has one. `mcp__pychivalry__find_definition` on
   each new name must find nothing: a definition of the same name replaces the base game's or
   another file's.
5. **Draft,** looking up every name before you write it (rule 1), writing the localization
   with the script (rule 2), and giving every option of an event with several options its AI
   weight (rule 8).
6. **Format, check and repair,** as rules 3 to 8 say, round by round:
   `mcp__pychivalry__apply_format` on each file you wrote or changed, then
   `mcp__pychivalry__check`.
7. **Report.** The files you wrote and the names you defined; the last `mcp__pychivalry__check`'s
   totals for those files; the choices you made; and anything left, as rule 6 says. Say also
   what a clean check does not prove: that the content does what was asked when it runs in the
   game.
