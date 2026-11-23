# structure-switch-without-trigger-bad

The fixture pair of `structure/switch-without-trigger`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-switch-without-trigger-good`, from which it differs only in the defect. A `switch` with
a case and a fallback and no `trigger`.

A correct tool reports one finding, at the `switch`. `expected.json` holds the findings.
