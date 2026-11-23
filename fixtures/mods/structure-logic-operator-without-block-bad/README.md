# structure-logic-operator-without-block-bad

The fixture pair of `structure/logic-operator-without-block`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-logic-operator-without-block-good`, from which it differs only in the defect. A scripted
trigger with `NOT = is_adult`: a single value where the operator takes a block of triggers.

A correct tool reports one finding, at the `NOT`. `expected.json` holds the findings.
