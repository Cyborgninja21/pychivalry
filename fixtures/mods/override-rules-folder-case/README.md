# override-rules-folder-case

A mod that writes the folder `common/script_values` as `Common/Script_Values`, read over the
game stub [fixtures/game/override-rules](../../game/override-rules/README.md): the folder half of
rule 9 of [docs/overrides.md](../../../docs/overrides.md) (build step 3, item 3.2; experiment
8b). It is its own mod because on Windows one folder cannot hold both `common/` and `Common/`.

pychivalry finds the file without regard to letter case and classifies it as a script value.
Whether the game reads it is the file system's: the engine folds no case, so on Windows the file
is read (`path-case-windows`) and on Linux the folder is not found and the file is not read
(`path-case-linux`), both `derived` rows of the spec package's rules table. `expected.json`
gives the answer on each platform.
