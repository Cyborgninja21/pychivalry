# The call graph

Which definitions call which (docs/PLAN.md items 10.6 and 10.7): an event that fires another, an
effect that runs a scripted effect, an on-action that fires an event, a decision that fires one.
The core reads it from the spec package and the workspace index (`packages/core/src/calls/`), and
three surfaces give the same links: the command line's `pychivalry calls`, the agent server's
`call_graph` and the editor's call hierarchy ([Commands](guide/commands.md#options-of-calls),
[The agent server](guide/agent-server.md#the-tools)). The fix-error and write-content skills ask
`call_graph` too: the first for a definition's callers before it changes a scripted effect, a
scripted trigger or an event, the second for the calls of the content it wrote (decision 193,
[skills/README.md](../skills/README.md)). This page says what makes a link, what the graph of the
base game holds, and how it is tested.

## What makes a link

A link goes from the definition a statement is written in (the caller) to the definition the
statement names (the callee). Which statements are calls is the spec package's, never a list in
the code; two parts say it:

1. **A key read as a definition a mod can call by name.** The table `vanilla_indexed_dirs` (part
   C4) lists "the base game's folders whose definitions a mod can call by name": scripted effects,
   scripted triggers, scripted lists, scripted modifiers, script values, modifier definition
   formats and on-actions. Where the context reader (the engine checks' own, `check/context.ts`)
   reads a key in a trigger, effect or modifier block as a definition of one of them that the mod
   or the base game defines, the key is a call (`basis: callable`): `my_effect = yes` in an effect
   block, `my_trigger = yes` in a trigger block.
2. **A value naming a definition the game fires.** Part D6 (`field_references`) says, field by
   field and parameter by parameter, which database a value names. A row is a call when its
   database is one whose definitions the game fires: the folders of part D4's `fire_condition` row
   (the condition "the record must pass to fire": events) and the on-action database (the one D6's
   vocabulary adds the package's on-actions bucket to). So `trigger_event = { id = x }` (row
   `effects::trigger_event.id`), `trigger_event = x` (`effects::trigger_event`), `trigger_event =
   { on_action = x }`, an on-action's `events`, `random_events`, `first_valid`, `on_actions` and
   `random_on_action`, a council task's `monthly_on_action` and the travel effects' event and
   on-action parameters are calls (`basis: field-reference`). A trigger that names a decision
   (`can_execute_decision`) names no database the game fires, so it is no call.

A D6 row is read when its status is `confirmed` or `measured-only`, and each link carries the row
and its status: the plain form `trigger_event = x` is measured only (the base game's values are
event ids; no rank 1 to 3 evidence names the database), and it is most of the base game's
event-to-event links. Where two rows read the same value (an event option's `trigger_event` is
both the effect's value and the option's field), the link is one, from the confirmed row or else
the keyword's own. Not read: an `unknown` or `not-a-key` row; a row of D6's kind `other` (a
scripted effect's parameter, whose value is the call's, not the definition's); a definition
written inline in its file (`scripted_trigger name = { }`), which the index files under no
folder; a script value named as a value (`add_gold = my_value`), which no part marks as a call
there.

A value is read as `references/unknown-key` reads one: a plain name, never a scope chain, a
`$PARAM$`, an `@constant`, a link (`root`) or a word the row accepts (`sentinels`). A callee that
nothing defines is a link too, which says so (`defined: false`).

**The caller** is the innermost definition of the index whose text holds the statement: an event,
an on-action, a decision, a scripted effect, a character's history; a nested definition of part D3
(an activity's phase) before its parent. A statement in no definition makes no link.

**Every definition counts.** Where the mod replaces a definition of the base game, both are read,
each link with its layer; which one is in force is `find_definition`'s and `lookup`'s answer.

## The five kinds of the plan, and the others

A link's kind is its caller's database and its callee's, read from the index. The five kinds
docs/PLAN.md names are five of them:

| The plan's kind | Link kinds |
| --- | --- |
| An event triggering an event | `events -> events` |
| A scripted effect call | `<any> -> common/scripted_effects` |
| A scripted trigger call | `<any> -> common/scripted_triggers` |
| An on-action firing an event or another on-action | `common/on_action -> events`, `common/on_action -> common/on_action` |
| A decision firing an event | `common/decisions -> events` |

Every other link the package marks as a call is listed beside them: an event firing an on-action,
a scripted effect or a character interaction firing an event, a scripted modifier, a script value
or a scripted list called by name.

## The base game

The whole graph of game 1.21.0.3 (its 4,832 script files), measured on 2026-11-26 by a one-off
script over the core's `CallGraph.all()` (not committed; Linux, x64, 10 logical CPUs, 62 GiB,
Node 22.23), the base game's index loaded from its on-disk cache:

| Measure | Value |
| --- | ---: |
| Links | 107,715 |
| Definitions in them (callers and callees) | 33,085 |
| Definitions that call | 26,047 |
| Link kinds (caller and callee databases) | 248 |
| Callees nothing defines | 0 |
| Time to read the whole graph | 18.2 s |
| Memory the graph added (JavaScript heap) | 224 MiB |
| Peak memory of the process, the index with it | 2.27 GiB |

| Kind | Links |
| --- | ---: |
| An event triggering an event (`events -> events`) | 4,121 |
| A scripted effect call (`-> common/scripted_effects`) | 33,246 |
| A scripted trigger call (`-> common/scripted_triggers`) | 57,660 |
| An on-action firing an event (`common/on_action -> events`) | 6,863 |
| An on-action firing an on-action (`common/on_action -> common/on_action`) | 458 |
| A decision firing an event (`common/decisions -> events`) | 452 |
| Every other link to an event or an on-action | 2,941 (2,287 to events and 654 to on-actions; 13,723 and 1,112 in all) |
| Script values, scripted modifiers and formats called by name | 1,974 |

By what makes them calls: 92,880 keys read as definitions called by name, 10,533 values of
confirmed D6 rows and 4,302 of measured-only rows.

A surface never reads the whole graph. What calls a name is read from the files the index says
use the name, and what it calls from the files that define it, each file once while the files are
unchanged: the callers of the base game's most called name, the scripted trigger
`is_available_ai_adult` (1,543 links), took 2.8 s the first time; its callees, 2 ms.

## How it is tested

- **The known graph.** The fixture mod [call-graph](../fixtures/mods/call-graph/README.md) writes
  every kind of link, and its `expected.json` holds each one with its caller, callee, place,
  statement and basis; `packages/core/src/calls/graph.test.ts` holds the graph equal to it (all
  five kinds and two others, and a callee nothing defines), and each name's callers and callees
  to the graph's own links.
- **The same answers on every surface.** `packages/lsp/src/call-answers.test.ts` asks the command
  line's `calls --json`, the agent server's `call_graph` and the language server's call hierarchy
  about every definition of the fixture, and of the lookup fixture over its game stub (game
  places in their layer): the same callers and callees at the same places, but for a callee
  nothing defines, which the editor has no file to show.
- **Each surface** has its own tests: `packages/cli/src/calls.test.ts` (text, JSON, the filters,
  exit codes), `packages/mcp/src/calls.test.ts` (whole names, a name too large for one result,
  names left for another call, game places with `read_with`).
