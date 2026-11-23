# structure-story-effect-group-without-effect-bad

The fixture pair of `structure/story-effect-group-without-effect`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-story-effect-group-without-effect-good`, from which it differs only in the defect. A
story cycle whose `effect_group` has an interval and no `triggered_effect`, `first_valid` or
`random_valid`.

A correct tool reports one finding, at the `effect_group`. `expected.json` holds the findings.
