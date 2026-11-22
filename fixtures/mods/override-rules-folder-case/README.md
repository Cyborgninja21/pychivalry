# override-rules-folder-case

A mod that writes the folder `common/script_values` as `Common/Script_Values`, read over the
game stub [fixtures/game/override-rules](../../game/override-rules/README.md): the folder half of
rule 9 of [docs/overrides.md](../../../docs/overrides.md), which is open (build step 3, item 3.2;
experiment 8b). It is its own mod because on Windows one folder cannot hold both `common/` and
`Common/`.

pychivalry finds the file without regard to letter case and classifies it as a script value;
whether the game reads a folder spelled that way is not known, so the definition has no winner.
`expected.json` lists it.
