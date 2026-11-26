# scope-undefined-event-target-bad

The fixture pair of `scope/undefined-event-target` ([docs/checks.md](../../../docs/checks.md#46-event-targets-and-localization)),
with `scope-undefined-event-target-good`, from which it differs only in the defects. Read over
the base-game stub [event-targets-and-localization](../../game/event-targets-and-localization/README.md).

An event reads saved scopes, as a key and as a value. A correct tool is silent on a scope saved
in the same file, one saved in another file of the mod (a scripted effect), one the base game
saves (`scope:fixture_base_saved`), a value saved with `save_scope_value_as` (an entry of the
spec package's `save_keys` since format 9, its name in the block's `name`), a name a parameter
builds (`save_scope_as = fixture_target_built_$WHAT$`), a name that is itself a parameter
(`scope:$TARGET$`), and a name the game saves from its own code (`scope:actor`, part O1 of the
spec package, format 9).

It reports two findings, information, with the game's message "Undefined event target '%s'":
`scope:fixture_target_never_saved` and `scope:fixture_target_never_saved_either`, which nothing
in the mod or the base game saves or writes. With no base game read it reports nothing.
`expected.json` holds the findings.
