# structure-namespace-outside-events-bad

The fixture pair of `structure/namespace-outside-events`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-namespace-outside-events-good`, from which it differs only in the defect. A
scripted-effects file that declares `namespace = fixture`.

A correct tool reports one finding, at the `namespace`. `expected.json` holds the findings.
