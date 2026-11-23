# structure-event-triggered-animation-without-animation-bad

The fixture pair of `structure/event-triggered-animation-without-animation`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-event-triggered-animation-without-animation-good`, from which it differs only in the
defect. A portrait's `triggered_animation` with a `trigger` and neither `animation` nor
`scripted_animation`.

A correct tool reports one finding, at the `triggered_animation`. `expected.json` holds the
findings. The localization file defines every key the script names.
