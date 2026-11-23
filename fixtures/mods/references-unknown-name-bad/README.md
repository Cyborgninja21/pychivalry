# references-unknown-name-bad

The fixture pair of `references/unknown-name`
([docs/checks.md](../../../docs/checks.md#47-advice-that-holds-on-121)), with
`references-unknown-name-good`, from which it differs only in the defect. An event portrait whose
`animation` is `fixture_missing`, which nothing defines; the mod defines `fixture_idle` in
`gfx/portraits/portrait_animations`.

A correct tool reports one finding, at the `fixture_missing`. `expected.json` holds the findings.
The localization file defines every key the script names.
