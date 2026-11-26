# Fixtures

Test mods and game stubs written by hand for the tests. Everything here is committed and is all
public CI runs on. The other kinds of test data, the five real mods and the base game among
them, are described in [docs/test-data.md](../docs/test-data.md).

| Folder | What it holds | First filled by |
| --- | --- | --- |
| [mods/](mods/README.md) | Small mods, one behaviour each: the parser's broken inputs, the index's override cases, and a pair for every check (51 pairs by the end of build step 4; 70 since step 8's `style/` pairs and the checks of the spec package's format 9; 83 since step 10's thirteen pairs of the GUI parser, with the GUI index's mod `gui-index`) | Build step 2 |
| [game/](game/README.md) | Stubs of a base game, for tests that look names up in the game: the override rules, the checks that need a base game, lookup, `planted-defects`, the base game of the planted-defect mod, and `gui-index`, GUI types and templates (step 10) | Build step 3 |
| [format/](format/README.md) | The formatter's golden files: for each rule of `docs/formatting.md` a file written to break it and what the formatter makes of it, byte for byte | Build step 8 |
| [defects/](defects/README.md) | The planted-defect mod of the scored agent-use test: 36 planted defects, every error and warning code at least once (the `style/` family's two warnings among them), and 29 look-alike lines, with its manifest and its fixed reference copy, read over the game stub `planted-defects` | Build step 6 (made harder after item 6.11; in the format, with `style/` defects, in step 8) |
| [requests/](requests/README.md) | The content requests of the scored authoring test: twelve requests, three each of events, decisions, scripted effects and scripted triggers, with the names each relies on, its expectations and its judged dimensions; the two mods a trial starts as; an example result of each, for the tests only; the ids retired after the first run; and, for the judge's calibration, ten hand-made results with a sheet and twelve real results of the second scored run with a sheet of their own. Since the second run, twelve expert requests more (24 in all) on a third base, `granary`, each with a hand-made first draft that falls into its trap, and a third sheet of twenty-four hand-made results of them | Build step 9 |

One more part arrives later: `logs/`, captured game error logs (step 11).

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
7. **In pychivalry's format.** Every script and localization file of a fixture mod and of the
   planted-defect mod is in the format: Windows line breaks (`\r\n`), the UTF-8 byte-order
   mark, the formatter's layout (the owner's word of 2026-11-23). The exceptions are exactly what
   a fixture exists to test, kept byte for byte and said in its README: a file with a parse
   error, a file not valid UTF-8, a file written to break a formatting rule (the bad half of a
   `style/` pair, the planted mod's formatting defect), and a localization file left without
   the byte-order mark to show what the game does without it. A test holds this
   (`packages/core/src/format/fixtures.test.ts`), and `.gitattributes` keeps those files'
   bytes exact on every platform. The golden files of `format/` hold what each formatting rule
   is tested on. A GUI file (`.gui`, build step 10) is not in the formatter; it is written with
   Windows line breaks and the mark all the same, its bytes kept exact. Everything else is LF and UTF-8: the READMEs, `descriptor.mod` and
   `expected.json` files, and the game stubs under `game/`, which stand for the base game, not
   for a mod (their localization files start with the mark, as the game asks for).
8. **No two paths that differ only in letter case in one folder tree.** Windows cannot check
   them out side by side; a fixture about letter case puts the other spelling in a mod of its
   own.
