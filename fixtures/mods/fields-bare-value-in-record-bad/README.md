# fields-bare-value-in-record-bad

The fixture pair of `fields/bare-value-in-record` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`fields-bare-value-in-record-good`, from which it differs only in the defects: two bare values
written directly in a record body that holds `key = value` statements.

A correct tool reports two errors with the game's message "Unexpected token '%s' found at '%s',
'=' expected", each at the token the game's reader meets where it expects the `=` after the
bare value it took for a key: the next field, `important_decision_group`, and the `}` that
closes the second record. A list of values inside a field (`gui_tags = { ... }`) is not
reported. `expected.json` holds the findings.
