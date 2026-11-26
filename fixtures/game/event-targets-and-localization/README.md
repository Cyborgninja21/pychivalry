# event-targets-and-localization

A base game for the checks of item 4.6 ([docs/checks.md](../../../docs/checks.md#46-event-targets-and-localization)),
which stay silent when no base game is read. It holds what a mod over it may lean on:

- `game/common/scripted_effects/fixture_base_effects.txt` saves the scope `fixture_base_saved`,
  so a mod's `scope:fixture_base_saved` is no undefined event target, and sets the variable
  `fixture_base_variable`, so a mod's read of it is no `variables/read-without-set`;
- `game/localization/english/fixture_base_l_english.yml` defines `fixture_base_key`, a key a mod
  may use without defining it, and `fixture_base_replaced`, a key a mod may define again: the
  base game's own text, which the mod replaces, is not an unused key of the mod.

Used by the fixture pairs `scope-undefined-event-target`, `localization-missing-key`,
`localization-unused-key` and `variables-read-without-set` (`packages/core/src/check/testing.ts`,
`checkFixture` with this stub).
