# localization-unused-key-bad

The fixture pair of `localization/unused-key` ([docs/checks.md](../../../docs/checks.md#46-event-targets-and-localization)),
with `localization-unused-key-good`, from which it differs only in the defect. Read over the
base-game stub [event-targets-and-localization](../../game/event-targets-and-localization/README.md).

A correct tool reports one hint, advice: `fixture_unused_key`, which nothing in the mod or the
base game uses. It is silent on a key a scripted effect shows (one of them dotted, which script
writes as a scope chain), one another text substitutes
(`$fixture_unused_in_text$`), one only an interface file shows (`gui/fixture_unused.gui`, which
the index reads since build step 10), the two keys a game concept has by its name (part D5), and
`fixture_base_replaced`, the base game's own key, which the mod's `replace` folder defines again.
With no base game read the check reports nothing.
`expected.json` holds the findings.
