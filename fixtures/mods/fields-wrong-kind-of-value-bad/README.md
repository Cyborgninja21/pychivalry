# fields-wrong-kind-of-value-bad

The fixture pair of `fields/wrong-kind-of-value` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`fields-wrong-kind-of-value-good`, from which it differs only in the defects: in
`common/decision_group_types`, whose `sort_order` the base game writes only as whole numbers,
`important_decision_group` only as `yes` or `no`, and `gui_tags` only as a list, a record
writes a word for the number (`ten`), `maybe` for the yes-or-no, and one word for the list.

A correct tool reports three findings at information, pychivalry's own advice. It is silent on
a named script value where the number goes (`fixture_order_value`, which the mod defines in
`common/script_values`). `expected.json` holds the findings.
