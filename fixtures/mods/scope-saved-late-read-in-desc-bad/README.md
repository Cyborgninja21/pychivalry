# scope-saved-late-read-in-desc-bad

The fixture pair of `scope/saved-late-read-in-desc`
([docs/checks.md](../../../docs/checks.md#47-advice-carried-over-provisionally)), with
`scope-saved-late-read-in-desc-good`, from which it differs only in the defect. An event whose
`desc` selects on `scope:fixture_mood` (its `switch`), a scope the event saves only in its option.

A correct tool reports one finding, at the `scope:fixture_mood`. `expected.json` holds the
findings. The localization file defines every key the script names.
