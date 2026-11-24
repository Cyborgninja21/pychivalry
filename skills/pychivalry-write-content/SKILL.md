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

The tools are named here by their bare names. Your client may list them under a prefix of its
own (Claude Code lists `check` as `mcp__pychivalry__check`): call each by the name your client
lists. If no pychivalry tool is offered at all, say so and stop: in VS Code the extension
registers the agent server by itself; for Claude Code, the person runs "pychivalry: Set up for
Claude Code" in VS Code once for the mod's folder.

## The rules

These hold for every request, whatever else it asks.

1. **Look names up before using them.** Before you write a trigger, an effect, a scope link, a
   modifier, an on-action, a field or a value, `lookup` it (up to 20 names a call): it says
   whether the game has it, where it is valid (its scopes, the folders a field belongs to), what
   it takes, and the game's own description. A name `lookup` does not know is not written; the
   names close to it that `lookup` offers are candidates, each looked up in turn. A name the mod
   or the game defines (an event, a trait, a scripted effect) is checked with `find_definition`.
2. **Write events with their localization.** The texts an event shows are written in its script
   as localization keys (`lookup` of a field says whether it holds one), and every key you
   write is defined in the mod's localization, with real text, in the same change. A `localization/missing-key` finding means this rule is not
   met: its fix names the file and the line to add (and creates the file when the mod has
   none); write the real text instead of the key the stub repeats. The same holds for the keys
   of a decision.
3. **Run the checker.** After writing, run `check` with `path` each file you wrote or changed
   and `min_severity` set to `warning`.
4. **Repair from the findings.** Fix each error and warning from what the finding, its `fix` and
   its data say, and from `lookup` and `explain_code`: the pychivalry-fix-error skill says how.
   Then check again.
5. **Stop at zero errors, or after 5 rounds.** A round is one `check` and the repairs made from
   it. Stop when the files you wrote show zero errors and no `style/` warning (rule 7), or when
   the fifth round's `check` is done, whichever comes first.
6. **Never claim success with errors left.** If an error or a `style/` warning is left after the
   fifth round, say that the content is not finished, and list what is left: code, file, line
   and message.
7. **Format what you write.** pychivalry writes every file with Windows line breaks and the
   UTF-8 byte-order mark, and lays it out one way. Run `format` on each file you wrote and write
   its text back when `changed` is true (`bom` and `line_ending` say how the file must be
   written), so that no `style/` finding is left: `style/not-formatted` and `style/not-utf8` are
   warnings, and count as errors here. When `pychivalry` runs in a terminal you can use,
   `pychivalry format <file>` writes the file formatted in place.

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
2. **Learn the folder from the game.** `list_definitions` with `kind` the folder (`events`,
   `common/decisions`, ...) lists what the mod and the base game define there. `lookup` each
   field you mean to write: a reading that is a field of that folder gives Paradox's own
   documentation of it, its value type, whether it holds a localization key and, where they are
   few, the values the base game writes. Run `check` on the mod once before you start: what it
   already reports is not yours to fix unless asked, and you will not mistake it for your own.
3. **Name things so they clash with nothing.** Give everything you define a name of the mod's
   own, with a prefix the mod already uses if it has one. `find_definition` on each new name
   must find nothing: a definition of the same name replaces the base game's or another file's.
4. **Draft,** looking up every name before you write it (rule 1), and writing the localization
   with the script (rule 2). Write new files with the UTF-8 byte-order mark and Windows line
   breaks.
5. **Check, repair and format,** as rules 3 to 7 say, round by round.
6. **Report.** The files you wrote and the names you defined; the last `check`'s totals for
   those files; the choices you made; and anything left, as rule 6 says. Say also what a clean
   check does not prove: that the content does what was asked when it runs in the game.
