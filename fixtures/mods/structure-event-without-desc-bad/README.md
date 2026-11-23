# structure-event-without-desc-bad

The fixture pair of `structure/event-without-desc`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-event-without-desc-good`, from which it differs only in the defect. An event that is not
hidden, with a title and an option and no `desc`.

A correct tool reports one finding, at the event's key. `expected.json` holds the findings. The
localization file defines every key the script names.
