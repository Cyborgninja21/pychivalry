# names-unknown-trigger-bad

The fixture pair of `names/unknown-trigger` ([docs/checks.md](../../../docs/checks.md#42-unknown-names)),
with `names-unknown-trigger-good`, from which it differs only in the defects. Keys in trigger
blocks that are no trigger there: a made-up name, an effect (`add_gold`), an iterator over a
list the game does not have, a trigger the game removed in 1.21.0.3 (`has_special_building`),
and a scripted trigger that nothing defines.

A correct tool reports five errors with the game's message "Unknown trigger '%s'", each with
its data: the buckets an effect is in, the iterator's prefix and list, the version a removed
trigger went in and its replacement. It is silent on everything else in the file: triggers,
`NOT`, `ROOT` (read as the link `root`), `trigger_if` with its `limit`, `any_vassal` with its
`count` parameter, and the scripted trigger the mod defines. `expected.json` holds the findings.

The event is hidden (`hidden = yes`), so that the advice checks of item 4.7 have nothing to say
about it.
