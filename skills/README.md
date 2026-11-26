# pychivalry: skills

The skills an AI harness loads when a task calls for them (build step 9, items 9.1 to 9.3 of
[docs/PLAN.md](../docs/PLAN.md)). A skill is a short set of written instructions: these drive
pychivalry's agent server and command line, and hold no CK3 knowledge of their own.

| Skill | What it is for |
| --- | --- |
| [pychivalry-explain-error](pychivalry-explain-error/SKILL.md) | Explain a finding: what its code means, the game's evidence, what is valid instead. Changes no file |
| [pychivalry-fix-error](pychivalry-fix-error/SKILL.md) | Fix the errors and warnings of a mod: check, look up, edit, check again, at most 5 rounds, then format |
| [pychivalry-write-content](pychivalry-write-content/SKILL.md) | Write events with their localization, decisions, scripted effects and scripted triggers by the rules of item 9.2, every option of an event with several options given an AI weight (decision 159) |

## The one form both harnesses load

Each skill is a folder named for the skill holding one `SKILL.md`: a frontmatter of two fields,
`name` (the folder's name: lowercase letters, digits and hyphens, at most 64) and `description`
(what it is for and when to use it, at most 1,024 characters, no angle brackets), then the
instructions in Markdown. That is the form VS Code 1.147 and Claude Code 2.1.220 both read; a
field one of them does not know is left out
([references/editors-and-agents.md](../docs/references/editors-and-agents.md#skills-checked-for-build-step-9-2026-11-23)).

- **VS Code's own AI** reads them inside the installed extension: the bundle copies this folder
  to `dist/bundle/skills/`, and the extension's manifest lists each `SKILL.md` under
  `contributes.chatSkills`. VS Code hands them on to its Copilot harness. Nothing to set up.
- **Claude Code** reads its own folders only. "pychivalry: Set up for Claude Code" copies them
  into Claude Code's folder of personal skills (`skills/` of `$CLAUDE_CONFIG_DIR`, or of
  `~/.claude`), never into the mod; activation keeps those copies up to date after an update,
  and "pychivalry: Remove from Claude Code" takes them away again. pychivalry writes and removes
  only its own copies there ([docs/guide/commands.md](../docs/guide/commands.md)).

## What holds them

`packages/vscode/src/skill-files.test.ts`, in `task ci`:

- the folder holds exactly these three, and the manifest contributes each;
- each `SKILL.md` is in the form above, its frontmatter read the same by both harnesses;
- each names only the agent server's tools and the command line's commands and options that
  exist, read from their own registries (`TOOLS` of `@pychivalry/mcp`, `COMMANDS` of
  `@pychivalry/cli`), and names the tools it drives;
- each writes every tool, in every step and rule as in its list at the top, by the name Claude
  Code lists it under (`mcp__pychivalry__check`), never by its short name alone (decision 168),
  and says how another client's names are made: `pychivalry-` before the tool's own name in VS
  Code's Copilot harness, `mcp_pychivalry_` in VS Code's own (read from VS Code 1.147 and its
  Copilot extension), so that a session there calls the tool whose name ends in the same one;
- everything a skill writes as code is pychivalry's own vocabulary (a tool, an argument or
  field of a tool, a check code, a command line), a name the spec package has, or a role of its
  part D4 (the word `lookup` reads a keyword's role in, such as the AI weight of an event's
  option), and no such name is written outside code: a skill makes no claim about a CK3 keyword
  the spec cannot back.
  The skills hold no script example for that reason; the AI learns each name from `lookup`;
- the authoring skill states the rules of item 9.2 in order, for the four kinds of content, and
  an eighth (decision 159): every option of an event with several options gets an AI weight,
  written with the keywords `lookup` gives that role, never named by the skill itself; the
  fix-error skill fixes `style/option-without-ai-weight`, which has no fix, as it fixes the other
  `style/` findings when the person asks for them;
- each says when to read the game's own text with the agent server's `source`, that a place
  outside the mod is never read with the harness's own file tools, and that `lookup` names the
  names it did not answer (tool schema version 4, decision 140);
- only the explain-error skill names `lookup`'s `evidence`, the spec package's evidence of one
  name, for when a person asks why a name is wrong or where its reading comes from (tool schema
  version 5); the other two have every fact they need in the plain answer, which stays small.

The editor tests (`task vscode:test`) show VS Code listing the three, handing them to its
Copilot harness, and the set-up copying, keeping up to date and removing Claude Code's copies.
Whether a signed-in AI follows them is the scored authoring run's to measure and the hand
checklist's to see ([docs/guide/ai-checklist.md](../docs/guide/ai-checklist.md)).
