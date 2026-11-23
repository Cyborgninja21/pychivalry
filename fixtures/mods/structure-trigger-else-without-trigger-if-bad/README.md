# structure-trigger-else-without-trigger-if-bad

The fixture pair of `structure/trigger-else-without-trigger-if`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-trigger-else-without-trigger-if-good`, from which it differs only in the defect. A
scripted trigger whose `trigger_else` follows a trigger, not a `trigger_if` or `trigger_else_if`.

A correct tool reports one finding, at the `trigger_else`. `expected.json` holds the findings.
