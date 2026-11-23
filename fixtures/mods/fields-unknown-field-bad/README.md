# fields-unknown-field-bad

The fixture pair of `fields/unknown-field` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`fields-unknown-field-good`, from which it differs only in the defect: a decision group with a
field, `fixture_made_up_field`, that the record schema of `common/decision_group_types` does
not list and that Paradox's `.info` files do not document.

A correct tool reports one warning with the game's message "Unknown {} in {}". It is silent on
the fields the schema lists, on an `@constant` used as a value, and on a field written in
another letter case (`Important_Decision_Group`), which is read as the field it spells.
`expected.json` holds the finding.
