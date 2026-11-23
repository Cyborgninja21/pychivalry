# presentation-outline-and-hints

A mod for the language server's use of the presentation data (docs/PLAN.md item 8.8): the
outline rules, the snippets and field order in completion, and the inline hints. Read over an
empty game stub. What a correct server answers:

| Where | Answer |
| --- | --- |
| Outline of `events/presentation_events.txt` | `namespace` as the plain outline has it; each event an `Event` with its `type` as detail, and under it its `immediate` (`Function`) and its options (`EnumMember`), each labelled with its `name` key, in the order written |
| Outline of `common/decisions/presentation_decisions.txt` | The decision a `Function`, with no `title`, so the plain detail; under it `is_shown`, `effect`, `ai_will_do` |
| Outline of `common/scripted_effects/presentation_effects.txt` | The plain outline: that folder has no outline rule |
| Completion at the top level of the events file | The snippets `namespace`, `event` and `hidden event`, to an editor that takes snippets; none to one that does not |
| Completion in the decision's body | The fields in the decisions' field order, the next one preselected, and the field snippets of the folder for the fields offered there |
| Inlay hints of the events file | `The Fixture Begins` after `presentation_fixture.1`; `Agree` and `Refuse, at length` after the two options; `: character` after `liege` and after `every_vassal`; nothing after `presentation_fixture.2`, which has no title |
| Inlay hints of the decisions file | `Take the Fixture Decision` after `presentation_decision`, the key part D5 says a decision without `title` has |

The localization file starts with a byte-order mark, as the game requires. The test is
`packages/lsp/src/presentation-features.test.ts`.
