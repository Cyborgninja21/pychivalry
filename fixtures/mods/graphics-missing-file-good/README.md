# graphics-missing-file-good

The good half of the fixture pair of `graphics/missing-file`
([docs/checks.md](../../../docs/checks.md#step-10-graphics)), read over the game stub
[graphics](../../game/graphics/README.md). Every texture it names is a file: the mod's own
(`gfx/interface/illustrations/decisions/fixture_mod_picture.dds`), the base game's, a DLC
pack's (through the file's `@constant`) and `jomini/`'s.

It also writes what the check does not decide, and so is silent on: a bare file name with no
folder, a path with a `..` segment, and a video (`.bk2`) in a file-path field, which is not a
texture. A correct tool reports no warning on it.
