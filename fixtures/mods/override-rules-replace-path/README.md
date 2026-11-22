# override-rules-replace-path

A mod whose `descriptor.mod` names `replace_path = "common/decisions"`, read over the game stub
[fixtures/game/override-rules](../../game/override-rules/README.md): rule 8 of
[docs/overrides.md](../../../docs/overrides.md), which is open (build step 3, item 3.2).

What `replace_path` hides is not known, so every game file under `common/decisions`, and in its
subfolders, is a file the game may or may not read, and no decision in them has a winner. The
mod's own file under the path is read. `expected.json` lists the three decisions.
