# structure-casus-belli-without-outcome-bad

The fixture pair of `structure/casus-belli-without-outcome`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`structure-casus-belli-without-outcome-good`, from which it differs only in the defect. A casus
belli with its descriptions and none of `on_victory`, `on_defeat`, `on_white_peace`. The mod
defines the group it names.

A correct tool reports three findings at the record's key: this check's, and two of
`fields/usually-present`, since every base-game casus belli sets `on_victory` and `on_defeat`.
`expected.json` holds the findings. The localization file defines every key the script names.
