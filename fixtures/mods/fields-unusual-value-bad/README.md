# fields-unusual-value-bad

The fixture pair of `fields/unusual-value`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`fields-unusual-value-good`, from which it differs only in the defect. A nickname with `is_bad =
no`; the base game writes only `yes` in `is_bad`.

A correct tool reports one hint, at the `no`. `expected.json` holds the findings.
