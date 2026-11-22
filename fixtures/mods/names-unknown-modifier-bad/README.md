# names-unknown-modifier-bad

The fixture pair of `names/unknown-modifier` ([docs/checks.md](../../../docs/checks.md#42-unknown-names)),
with `names-unknown-modifier-good`, from which it differs only in the defects. A culture era's
`character_modifier`, a block the spec marks as holding modifiers, with a made-up modifier and
a modifier the game removed in 1.21.0.3 (`tax_mult`).

A correct tool reports two errors with the game's message "Unknown modifier type '{}' at {}",
the removed one with the version it went in. It is silent on the rest: modifiers, a name that
fills a modifier template (`stationed_archers_damage_mult`), and `fixture_slot_add`, which only
the template `%s_add` fills, a template the spec marks as no proof alone, so the name is
neither proved nor refuted. `expected.json` holds the findings.
