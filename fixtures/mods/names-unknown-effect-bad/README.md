# names-unknown-effect-bad

The fixture pair of `names/unknown-effect` ([docs/checks.md](../../../docs/checks.md#42-unknown-names)),
with `names-unknown-effect-good`, from which it differs only in the defects. Keys in effect
blocks that are no effect there: a made-up name, a trigger (`is_adult`), an iterator over a
list the game does not have, an effect the game removed in 1.21.0.3
(`add_special_building_slot`), and a scripted effect that nothing defines.

A correct tool reports five errors with the game's message "Unknown effect '%s'", each with its
data. It is silent on the rest: effects, `if` with its `limit` and `else`, `every_vassal` with
its `limit`, `random_list` with its weighted entries and their `trigger`, `hidden_effect`, and
the scripted effect the mod defines. `expected.json` holds the findings.
