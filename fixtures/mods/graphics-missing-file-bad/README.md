# graphics-missing-file-bad

The fixture pair of `graphics/missing-file` ([docs/checks.md](../../../docs/checks.md#step-10-graphics)),
with `graphics-missing-file-good`, from which it differs only in the defects. It is read over the
game stub [graphics](../../game/graphics/README.md), which holds a texture in the install's
`game/` folder, one in a DLC pack and one in `jomini/`.

Two folders whose fields the spec package documents as file paths (part C1, `.info` type
`file_path`): a decision's `picture` `reference` and `extra_picture`, and an event background's
`reference`. Five of their textures are a file of neither the mod nor the base game:

- a decision's picture, and its extra picture (a `.png`);
- a picture named through the file's `@constant`, which is judged at the field that names it;
- a picture that matches the base game's `fixture_base_picture.dds` only in letter case, which
  the rules table's `path-case` row for Linux (the fixture's platform) compares exactly: the
  finding names the file's own spelling in its data (`other_case`);
- an event background's picture.

A correct tool reports five warnings with the game's message "Failed to load texture %s - file
not found", and nothing when no game folder is set. `expected.json` holds the findings.
