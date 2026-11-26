# call-graph

A mod with a known call graph, for the call graph of docs/PLAN.md item 10.6
([docs/call-graph.md](../../../docs/call-graph.md)). Read on its own, with no base game: every
definition it calls is its own, but one event it fires that nothing defines.

It writes each of the five kinds of link the plan names, and two more the spec package marks as
calls:

| Kind | Links |
| --- | --- |
| An event triggering an event | `fixture_calls.1` fires `fixture_calls.2` from an option (`trigger_event = id`); `fixture_calls.2` fires `fixture_calls.3` (`trigger_event = { id = ... }`); `fixture_calls.3` fires `fixture_calls.9`, which nothing defines |
| A scripted effect call | `fixture_calls.2`, `fixture_call_decision` and `fixture_call_effect` call a scripted effect |
| A scripted trigger call | `fixture_calls.1`, `fixture_call_decision` and `fixture_call_outer_trigger` test `fixture_call_trigger` |
| An on-action firing an event or an on-action | `fixture_on_action_a` fires `fixture_calls.1` (`events`), `fixture_calls.2` (`random_events`) and `fixture_on_action_b` (`on_actions`); `fixture_on_action_b` fires `fixture_calls.3` from its `effect` |
| A decision firing an event | `fixture_call_decision` fires `fixture_calls.1` |
| Others | An event firing an on-action (`trigger_event = { on_action = ... }`); a scripted effect firing an event |

`expected.json` holds every link a correct call graph reads, each with its caller, its callee,
the place the callee is written, the statement and the part of the spec package that makes it a
call. The test is `packages/core/src/calls/graph.test.ts`.
