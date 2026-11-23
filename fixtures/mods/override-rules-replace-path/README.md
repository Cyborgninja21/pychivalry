# override-rules-replace-path

A mod whose `descriptor.mod` names `replace_path = "common/decisions"`, read over the game stub
[fixtures/game/override-rules](../../game/override-rules/README.md): rule 8 of
[docs/overrides.md](../../../docs/overrides.md) (build step 3, item 3.2).

`replace-path-hides-lower-layers-in-listings`, a settled row of the spec package's rules table,
says what it hides: the game's files directly in `common/decisions`, written byte for byte as
the descriptor writes the folder; a subfolder is listed under its own path and is not hidden.
So the game's `fixture_base_decision` is not read, `fixture_shared_decision` is the mod's, and
`fixture_sub_decision`, in a subfolder, is still the game's. `expected.json` lists the three
decisions.
