# structure-event-triggered-animation-without-trigger-bad

The fixture pair of `structure/event-triggered-animation-without-trigger`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-event-triggered-animation-without-trigger-good`, from which it differs only in the
defect. A portrait's `triggered_animation` with an `animation` and no `trigger`. The mod defines
the animation it names (`gfx/portraits/portrait_animations`).

A correct tool reports one finding, at the `triggered_animation`. `expected.json` holds the
findings. The localization file defines every key the script names.
