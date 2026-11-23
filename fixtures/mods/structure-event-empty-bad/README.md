# structure-event-empty-bad

The fixture pair of `structure/event-empty`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-event-empty-good`, from which it differs only in the defect. An event with nothing in
it.

A correct tool reports three findings at the event's key: this check's, and
`structure/event-without-desc` and `structure/event-without-option`, since an empty event is not
hidden and has neither. `expected.json` holds the findings.
