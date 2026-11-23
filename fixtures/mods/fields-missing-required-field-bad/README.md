# fields-missing-required-field-bad

The fixture pair of `fields/missing-required-field` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`fields-missing-required-field-good`, from which it differs only in the defects. The spec
package marks three fields required, each with the game's own message: a casus belli's
`on_invalidated_desc`, an interaction category's `index` and a tutorial lesson's `chain`. Each
record here lacks its one.

A correct tool reports three errors, each with that field's own message: "Casus belli {}
missing on_invalidated_desc", "Invalid or undefined index for character interaction category
'{}'" and "Missing or invalid tutorial chain for tutorial lesson '%s'", filled with the
record's key. `expected.json` holds the findings.
