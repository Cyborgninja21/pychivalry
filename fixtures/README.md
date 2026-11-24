# Fixtures

Test mods and game stubs written by hand for the tests. Everything here is committed and is all
public CI runs on. The other kinds of test data, the five real mods and the base game among
them, are described in [docs/test-data.md](../docs/test-data.md).

| Folder | What it holds | First filled by |
| --- | --- | --- |
| [mods/](mods/README.md) | Small mods, one behaviour each: the parser's broken inputs, the index's override cases, and a pair for every check (51 pairs by the end of build step 4) | Build step 2 |
| [game/](game/README.md) | Stubs of a base game, for tests that look names up in the game: the override rules, the checks that need a base game, lookup, and `planted-defects`, the base game of the planted-defect mod | Build step 3 |
| [format/](format/README.md) | The formatter's golden files: for each rule of `docs/formatting.md` a file written to break it and what the formatter makes of it, byte for byte | Build step 8 |
| [defects/](defects/README.md) | The planted-defect mod of the scored agent-use test: 32 planted defects, every error and warning code at least once, and 29 look-alike lines, with its manifest and its fixed reference copy, read over the game stub `planted-defects` | Build step 6 (made harder after item 6.11) |

Two more parts arrive later: `requests/`, the content requests of the scored authoring test
(step 9), and `logs/`, captured game error logs (step 11).

The base game itself is not a fixture: the game-file suites read the local install, and their
classifications of what it raises live beside the suites, in `tools/data/`
([docs/test-data.md](../docs/test-data.md#the-base-game)).

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
   line ending, or is in pychivalry's format (`\r\n` and the byte-order mark: the `style/`
   pairs, the golden files of `format/`, `names-unknown-trigger-*`), which its README says and
   `.gitattributes` protects. Localization files start
   with the byte-order mark, as the game asks for, and Prettier leaves them alone; a file that
   leaves it out shows what the game does without it, and its README says so.
8. **No two paths that differ only in letter case in one folder tree.** Windows cannot check
   them out side by side; a fixture about letter case puts the other spelling in a mod of its
   own.
