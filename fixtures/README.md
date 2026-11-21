# Fixtures

Test mods and game stubs written by hand for the tests. Everything here is committed and is all
public CI runs on. The other kinds of test data, the five real mods and the base game among
them, are described in [docs/test-data.md](../docs/test-data.md).

| Folder | What it holds | First filled by |
| --- | --- | --- |
| [mods/](mods/README.md) | Small mods, one behaviour each | Build step 2 |
| [game/](game/README.md) | Stubs of a base game, for tests that look names up in the game | Build step 3 |
| [defects/](defects/README.md) | The planted-defect mod of the scored agent-use run, with its manifest and its fixed reference copy | Build step 6 |

Two more parts arrive later: `requests/`, the content requests of the scored authoring run
(step 9), and `logs/`, captured game error logs (step 11).

## Rules

1. **Written by hand.** A fixture is not a file copied out of the game or out of a published
   mod. Take the few lines a test needs and write them.
2. **One behaviour each.** A fixture that tests two things hides which one broke.
3. **Small.** A fixture mod is a handful of files. A case of a few lines that only the parser
   reads stays as a table in the test file beside the parser.
4. **Game-shaped.** A fixture mod has the folder layout the game expects (`common/`, `events/`,
   `localization/` and so on) and a `descriptor.mod`, because a file is classified by its path
   inside the mod.
5. **Named for what it shows.** Lower-case words joined by hyphens, saying the behaviour:
   `missing-localization-key`, not `test3`.
6. **Explained.** Each fixture mod has a `README.md` of a few lines: what it shows, and what a
   correct tool reports on it.
7. **LF line endings and UTF-8,** except where the fixture exists to test another encoding or
   line ending, which its README says and `.gitattributes` protects.
