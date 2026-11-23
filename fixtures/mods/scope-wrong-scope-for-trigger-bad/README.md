# scope-wrong-scope-for-trigger-bad

The fixture pair of `scope/wrong-scope-for-trigger` ([docs/checks.md](../../../docs/checks.md#44-scope)),
with `scope-wrong-scope-for-trigger-good`, from which it differs only in the defects. Triggers
written in a scope their scope data does not list: in a decision, whose root is a character,
`tier` at the root, `is_adult` and the iterator `any_vassal` after the link `primary_title`,
`has_trait` in the iterator `any_held_title`, and `has_county_modifier` after the link
`capital_province`; in an event whose `scope = province` makes its root a province, `is_adult`.

A correct tool reports six errors with the game's message "Wrong scope for trigger: %s,
expected %s", each with the trigger's name, the scope it is in and the scopes it supports. It is
silent on the triggers that fit, on `is_adult` inside `any_vassal` (a character again), and on
`tier` after `scope:fixture_target`, a saved scope whose type the spec package does not give.
`expected.json` holds the findings.
