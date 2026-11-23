# structure-switch-without-branches-bad

The fixture pair of `structure/switch-without-branches`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-switch-without-branches-good`, from which it differs only in the defect. A `switch` with
a `trigger` and a `fallback` and no case.

A correct tool reports one finding, at the `switch`. `expected.json` holds the findings.
