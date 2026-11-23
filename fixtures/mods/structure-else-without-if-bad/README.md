# structure-else-without-if-bad

The fixture pair of `structure/else-without-if`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-else-without-if-good`, from which it differs only in the defect. A scripted effect whose
`else` follows an effect, not an `if` or `else_if`.

A correct tool reports one finding, at the `else`. `expected.json` holds the findings.
