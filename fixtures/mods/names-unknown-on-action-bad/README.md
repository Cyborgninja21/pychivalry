# names-unknown-on-action-bad

The fixture pair of `names/unknown-on-action` ([docs/checks.md](../../../docs/checks.md#42-unknown-names)),
with `names-unknown-on-action-good`, from which it differs only in the defects. The places
part D6 of the spec package confirms hold an on-action's name: an on-action's `on_actions`
list, its `random_on_action` weights and its `fallback`, and the `on_action` of the effect
`trigger_event`, in an on-action's effect and in an event's `immediate`.

A correct tool reports five errors with the game's message "Unknown on action: %s", one for
each name defined nowhere. It is silent on the rest: on-actions the mod defines, `on_birth_child`
(an on-action of the engine's own, in the package's on-actions bucket), and a saved scope
(`scope:fixture_saved_on_action`), which is no name. `expected.json` holds the findings.
