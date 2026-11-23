# scope-wrong-scope-for-effect-bad

The fixture pair of `scope/wrong-scope-for-effect` ([docs/checks.md](../../../docs/checks.md#44-scope)),
with `scope-wrong-scope-for-effect-good`, from which it differs only in the defects. Effects
written in a scope their scope data does not list, in a character event: `add_county_modifier`
at the root, `add_gold` and the iterator `every_vassal` after the link `primary_title`, and
`add_trait` in an option after the link `capital_province`.

A correct tool reports four errors with the game's message "Wrong scope for effect: %s,
expected %s", each with the effect's name, the scope it is in and the scopes it supports. It is
silent on the effects that fit, on `add_gold` inside `every_vassal` (a character again), and on
`if` with its `limit`, whose blocks keep the scope. `expected.json` holds the findings.
