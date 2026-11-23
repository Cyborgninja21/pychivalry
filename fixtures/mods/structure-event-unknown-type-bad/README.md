# structure-event-unknown-type-bad

The fixture pair of `structure/event-unknown-type`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-event-unknown-type-good`, from which it differs only in the defect. A hidden event whose
`type` is `fixture_event`, no type the events `.info` lists.

A correct tool reports two findings at the value: this check's, and the hint
`fields/unusual-value`, since the base game writes only the four documented types in `type`.
`expected.json` holds the findings.
