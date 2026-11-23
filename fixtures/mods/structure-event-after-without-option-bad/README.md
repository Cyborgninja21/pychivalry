# structure-event-after-without-option-bad

The fixture pair of `structure/event-after-without-option`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-event-after-without-option-good`, from which it differs only in the defect. An event
that is not hidden, with an `after` and no `option`.

A correct tool reports two findings: this check's at the `after`, and
`structure/event-without-option` at the event's key, since an event that is not hidden and has no
option is that check's defect too. `expected.json` holds the findings. The localization file
defines every key the script names.
