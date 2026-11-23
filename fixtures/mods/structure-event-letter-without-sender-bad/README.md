# structure-event-letter-without-sender-bad

The fixture pair of `structure/event-letter-without-sender`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-event-letter-without-sender-good`, from which it differs only in the defect. A letter
event (`type = letter_event`) without `sender`.

A correct tool reports one finding, at the event's key. `expected.json` holds the findings. The
localization file defines every key the script names.
