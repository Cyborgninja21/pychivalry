---
name: pychivalry-explain-error
description: Explain a finding pychivalry reports in a Crusader Kings 3 (CK3) mod, what an error, warning, information or hint code means, the game's own evidence for it, and what is valid at that place instead. Use when the user asks what a CK3 script error or warning means, why pychivalry reports something, or what a code such as names/unknown-trigger is. Uses pychivalry's agent server (explain_code, check, lookup, source) and changes no file.
---

# Explain a pychivalry finding

pychivalry checks a Crusader Kings 3 mod the way the game itself reads it. Its agent server gives
you the finding, the game's evidence for it and the game's own documentation of every name in
it. Explain from what the tools return, never from memory of CK3: what the tools do not say, you
do not claim.

**Call each tool by the name your client lists.** The tools are written here by their short names,
such as `check`, but Claude Code, for one, lists them under longer names, and only a listed name
can be called: a call of a short name reaches nothing, and Claude Code answers that there is no
such tool. In Claude Code the names are `mcp__pychivalry__check`, `mcp__pychivalry__explain_code`,
`mcp__pychivalry__lookup`, `mcp__pychivalry__find_definition`, `mcp__pychivalry__source`. Call
each by the name your client lists, never by the short name alone; if a call finds no such tool, call the same tool again by
its listed name. If no pychivalry tool is offered at all, say so and stop: in VS Code the
extension registers the agent server by itself; for Claude Code, the person runs "pychivalry: Set
up for Claude Code" in VS Code once for the mod's folder.

## Steps

1. **Find the finding.** If the person gave a code, a message, or a file and line, start from
   it. Otherwise run `check` with `path` the file (its path inside the mod, with forward
   slashes) and `min_severity` set to `hint`, and take the finding the person means. Lines and
   columns count from 1. A finding has a `code`, a `severity`, a `message`, its `data` (the
   names and values it is about, and what is valid there) and its `fix`, when it has one.
2. **Ask what the code means.** Run `explain_code` with `codes` holding the code. It gives the
   code's severity, what it finds, and its evidence: the game's own message, a field the game
   requires, the game's documentation, or pychivalry's own rules.
3. **Look up every name in it.** Run `lookup` with `names` holding each name the finding's
   message and data mention (at most 20 a call). Every name it answers is answered whole; one
   listed in `not_answered` did not fit: look it up in another call. Each reading gives the
   game's own description, the scopes the name is valid in and what it takes; for a name the mod
   or the game defines, where it is defined and which definition is in force. A name nothing
   knows comes back with the names close to it. Where the finding names a definition of the mod,
   `find_definition` and `find_references` show where it is defined and used. To show how the
   game itself writes a name, `source` gives the text around a place a result named; a place
   whose `layer` is not `mod` is a file of the installed game, outside the mod: read it with
   `source` only, never with your own file tools.
4. **Explain.** In plain words, say:
   - what the game does with this script, from the evidence `explain_code` gave;
   - why it applies at this place, from the finding's data and what `lookup` said;
   - what is valid there instead, from the data and `lookup`, and the finding's fix if it has
     one (safe: it can be applied as it is; a suggestion: alternatives to choose from).
5. **Say how sure it is.** An error or a warning rests on the game's own evidence. Information
   and hints are pychivalry's advice: usually right, not something the game enforces. The
   `style/` findings say where a file is not in pychivalry's format or breaks one of its
   best-practice rules; they rest on pychivalry's own rules, not on the game, which does not
   care. Where `lookup` says a part is not documented, say that it is not documented.

Change no file. If the person then wants the finding fixed, the pychivalry-fix-error skill does
that.
