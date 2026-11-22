# pychivalry: references

Every source pychivalry draws on: what it is, how far it is trusted, what may be copied from
it into this repository, and where the notes on it are. A step that uses a new source adds its
row here and, where there is something to record, a notes page beside this one.

## The rule

Everything is grounded in the game: its executable, its files, its own documentation and its
own output. A community tool or the wiki may supply a hint or an idea for a rule. Nothing rests
on one alone, and neither is a source of vocabulary.

## Order of trust

Where two sources disagree about a fact, the higher one wins, and the spec package records
which source each fact came from.

| Rank | Source | Why it ranks there |
| --- | --- | --- |
| 1 | The game executable | It is what runs. |
| 2 | The game's own output: its documentation dumps and its error log | The game describing itself, for the build it was run on. |
| 3 | Paradox's documentation files shipped with the game | Written by the developers, field by field; can lag the code. |
| 4 | What the base game's own files do | Measured use. It shows what is accepted, not what is required. |
| 5 | Wiki-era hints: the pre-2.0 schema files and the wiki | Written by hand from observation; often right, sometimes out of date. |

A name the derivation produced is never dropped because a lower source omits it. The doubt is
written down instead.

## Sources

| Source | What it gives | Reaches pychivalry as | May be copied into this repository | Notes |
| --- | --- | --- | --- | --- |
| The game executable | Trigger, effect, link, list, on-action and modifier names; error message texts | The spec package; and, for the override rules and the check inventory, message texts the spec does not carry and the source file each sits beside, read from the Linux build | Only through the spec package; a message text may be quoted as evidence | [spec-package.md](spec-package.md), [game-files.md](game-files.md#the-linux-executable) |
| The game's documentation dumps | Scopes per trigger and effect, usage lines, modifier use areas, data types | The spec package | Only through the spec package | [spec-package.md](spec-package.md) |
| Paradox's `.info` files | Field types, defaults, the scope a block receives | The spec package | Facts, through the spec package. Whether their text may be carried is an open question for the owner | [game-files.md](game-files.md) |
| The base game's script, GUI and localization files | Measured use: value types, observed values, how often a field is set, GUI block names | The spec package; and read at run time from the user's own install | Never as files. Counts and facts only | [game-files.md](game-files.md) |
| The game's command-line options and load-path settings | How to start the game into a save with a console command; which folders load | Notes; the in-game test harness of step 11; the override rules of step 3 | Facts only | [game-files.md](game-files.md) |
| The install's layout: the `game`, `jomini` and `clausewitz` folders, and the DLC descriptors | Where the base game's files are, and how a DLC names its folder | The override rules ([overrides.md](../overrides.md)); the base-game index of step 3 | Facts only | [game-files.md](game-files.md#the-installs-folders) |
| The spec package | Everything above, built and checksummed | `spec/` in this repository | Yes: it is committed here | [spec-package.md](spec-package.md) |
| The pre-2.0 schema files | Value types, descriptions, required flags, rule codes, written from the wiki | Hints inside the spec package, each marked as a wiki-era hint | Only through the spec package | [wiki-era-schemas.md](wiki-era-schemas.md) |
| The CK3 wiki | Descriptions and explanations | Hints only, through the files above | No | [wiki-era-schemas.md](wiki-era-schemas.md) |
| ck3-tiger and the CWTools rule files | Ideas for rules | A rule in the check inventory, once it proves true against the game | ck3-tiger is GPL-3.0: nothing. The CWTools rules are MIT: only with their notice kept, and only a rule proved against the game (licences read 2026-11-21) | [community-tools.md](community-tools.md) |
| Release 2.3.0 | Tests, fixtures, records, lessons, the behaviour to match | Test data carried over; baselines | Tests, fixtures and records, yes. Code, never | [release-2.3.0.md](release-2.3.0.md) |
| VS Code, Claude Code and the Model Context Protocol documentation | How the extension, the agent server and the skills must be built | Design choices in MVP.md and PLAN.md | Facts only | [editors-and-agents.md](editors-and-agents.md) |
| The language-server protocol and the WHATWG Encoding Standard | How positions are counted and lines end; how invalid UTF-8 is replaced, and what Windows-1252 decodes to | The parser's position model and its decoding ([encoding.md](../encoding.md)) | Facts only | [editors-and-agents.md](editors-and-agents.md#text-and-positions) |
| The XDG Base Directory Specification and Windows' known folders | Where a user's cache files belong on Linux and on Windows | The location of the index cache (build step 3) | Facts only | [editors-and-agents.md](editors-and-agents.md#cache-folders) |

## How to add a reference

1. Add its row to the table above: what it gives, how it reaches pychivalry, and what may be
   copied.
2. Place it in the order of trust. If it does not fit a rank, say why in its notes page.
3. Write a notes page when there is a fact worth keeping: a version, a count, a quirk, a date
   checked. State when each fact was checked; these go stale.
4. Record nothing that names a private machine or path.
