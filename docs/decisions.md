# pychivalry: decision log

Every decision about the rebuild, with the date it was made, oldest first. The table in
[MVP.md](MVP.md#decisions-already-made) states the decisions as they stand today, in full; this
log says when each was made and records the changes since.

How it is kept:

- A new decision adds a row here and, where it changes what is being built, a row in MVP.md's
  table.
- A changed decision adds a new row here that names the row it replaces. Rows are never edited
  or removed.
- A choice an agent made while building, that the owner has not confirmed, goes in
  [Awaiting confirmation](#awaiting-confirmation) and moves to the log when it is confirmed or
  changed.
- A question a step has put to the owner, not yet answered, goes in
  [Asked, awaiting the owner](#asked-awaiting-the-owner) and moves to the log when it is
  answered.
- Decisions the plan will ask for, and when, are listed in
  [PLAN.md](PLAN.md#decisions-the-plan-will-bring-to-the-owner).

## Log

| # | Date | Area | Decision |
| --- | --- | --- | --- |
| 1 | 2026-11-21 | Language | TypeScript throughout. |
| 2 | 2026-11-21 | Old code | A clean rewrite. Nothing is copied from `legacy/` as code; its tests, fixtures and records are carried over as test data. |
| 3 | 2026-11-21 | Core features | Engine-true errors, a command-line checker and the everyday editor features are all core. None is deferred. |
| 4 | 2026-11-21 | AI | AI first, in four senses: built for agents to use, AI help inside VS Code, built by agents, and AI writing mod content end to end. |
| 5 | 2026-11-21 | Identity | A new extension named `pychivalry`, starting at 1.0.0. It does not update `ck3-language-support` 2.x in place. |
| 6 | 2026-11-21 | Spec delivery | The built spec package is a file committed in this repository with its checksum. |
| 7 | 2026-11-21 | Game versions | One game version at a time: the current one. |
| 8 | 2026-11-21 | VS Code floor | Recent editors only. |
| 9 | 2026-11-21 | Authoring bar | A round limit of 5; pass-rate targets are set after the first scored run. |
| 10 | 2026-11-21 | CI | A new root workflow arrives with the repository skeleton. |
| 11 | 2026-11-21 | Scope | The CK3 Explorer tree view, game-log analysis, the graphics-file check, call hierarchy and selection ranges, and GUI and GFX file support move into the MVP. |
| 12 | 2026-11-21 | Marketplace | Not in the MVP. 1.0.0 ships as a downloadable file on GitHub. |
| 13 | 2026-11-21 | VS Code only | pychivalry is always used through VS Code. The command line and the agent server ship inside the extension. Nothing is published to npm. |
| 14 | 2026-11-21 | AI harness | The AI that uses pychivalry is Claude Code running in VS Code, or VS Code's built-in AI. No API key is stored. |
| 15 | 2026-11-21 | Authored content | Scored on validity, on a model judging the result against the request, and on loading the content in the real game. |
| 16 | 2026-11-21 | Game patches | After 1.21 the spec is re-derived on the owner's word. Nothing runs unattended on the analysis machine. |
| 17 | 2026-11-21 | Platforms | Linux and Windows are supported and tested. macOS is untested. |
| 18 | 2026-11-21 | Authoring order | The authoring skill is built straight after the formatter, at build step 9. |
| 19 | 2026-11-21 | AI surface | One bundled agent server (MCP) plus a set of skills, for both harnesses. No chat participant and no separate language-model tools. |
| 20 | 2026-11-21 | Game-file suites | No test runner is attached to this repository. A local task runs the suites that need game files and commits their records; public CI checks the records. |
| 21 | 2026-11-21 | Machines | The development laptop runs the game-file suites. The analysis machine is used only to re-derive the spec and to load content in the running game. |
| 22 | 2026-11-21 | Spec version | The spec is re-derived for the current game, 1.21, before building starts. |
| 23 | 2026-11-21 | GUI and GFX | Parse, index and navigate in the MVP. Checks against a GUI vocabulary come after it. |
| 24 | 2026-11-21 | Hand-kept tables | The tables 2.3.0 kept in code move into the spec package, with their evidence. The core holds none. |
| 25 | 2026-11-21 | Spec additions | The 1.21 spec keeps every part of the 1.20 package and adds twelve things. |
| 26 | 2026-11-21 | Presentation data | Outline rules, snippets, field order and inline hints return as pychivalry's own data file. It never raises an error. |
| 27 | 2026-11-21 | Old rules | The pre-2.0 required-field flags and rule codes are reviewed in the check inventory; those still true return as advice only. |
| 28 | 2026-11-21 | Source of truth | Vocabulary comes only from the spec package; at run time pychivalry also reads the user's installed game for names the game defines in files. |
| 29 | 2026-11-21 | Derived names | A derived name is never dropped because the game's own documentation omits it. The doubt is documented. |
| 30 | 2026-11-21 | Game dumps | The game's documentation dumps run on the analysis machine only, started by the game's own command-line option. |
| 31 | 2026-11-21 | Community tools | ck3-tiger and the CWTools rule files may be evaluated and a rule taken where it proves true against the game. Neither is a source of vocabulary. |
| 32 | 2026-11-21 | Grounding | Everything is grounded in the game: its executable, its files, its own documentation and its own output. |
| 33 | 2026-11-21 | Build order | Work the plan in order and build everything that does not need the 1.21 spec first: steps 1 to 3 and item 4.1. |
| 34 | 2026-11-21 | References | Reference material lives in `docs/references/`: an index of every source with its trust and copying rules, and a notes page per source. |
| 35 | 2026-11-21 | Test mods | `fixtures/` has three parts, `mods/`, `game/` and `defects/`, each with its own page, and `docs/test-data.md` explains all test data. |
| 36 | 2026-11-21 | Repository wiki | The GitHub wiki is generated from `docs/` by a task. The repository is the one source. |
| 37 | 2026-11-21 | Skeleton | The skeleton also carries contributor and security files with issue and pull-request templates, a user guide folder, a documents index, this log, editor settings files, and a corrected repository description. |
| 38 | 2026-11-21 | Encoding (item 2.1) | A script file that is not valid UTF-8 is read anyway and parsed in full; each bad byte becomes the replacement character; one information note per file says it is not valid UTF-8, never an error or a warning, because the game itself ships and loads such files. A fallback-encoding option lets the caller name an encoding (Windows-1252; off by default) with which such a file is decoded instead, so its letters read correctly. In step 2 it is a parameter of the core's decoding function; the VS Code setting that exposes it arrives with the extension in step 7. Made with the count in hand: 27 of the base game's 20,530 text files ([encoding.md](encoding.md)). |
| 39 | 2026-11-21 | Encoding fallback | The fallback encoding is used only for the bytes that are not valid UTF-8; every valid UTF-8 letter in the same file stays as it is. Refines row 38, under which the fallback as first built decoded the whole file and garbled the valid letters of files that mix both. |
| 40 | 2026-11-21 | Layouts | pychivalry is built for two layouts with equal weight: VS Code on the same computer as the game, and VS Code on another computer on the local network. |
| 41 | 2026-11-21 | Platforms | Linux and Windows are supported equally. A game behaviour that differs between them is settled for both. Replaces row 17. |
| 42 | 2026-11-21 | Override rules | The override rules are data: a table in the spec package, read out of the Windows and Linux executables by the spec work, each rule with its evidence. The index records every definition and names a winner only where the table has a rule. This makes the spec additions thirteen (row 25 said twelve). |
| 43 | 2026-11-21 | Override experiments | The in-game probe mods of overrides.md are not run for now. They stay written as a cross-check. A game bridge that runs probes, harvesting existing game logs, and a self-check against a user's own log were considered and not taken up. |
| 44 | 2026-11-21 | Layouts | In the MVP the game is on the same computer as VS Code, the case about nine times in ten. A game on another computer on the local network comes after the MVP. Replaces row 40, which recorded the two layouts as equal weight from a misread answer. |

## Awaiting confirmation

Choices made by the agent that built a step, where the plan left the choice open. Each stands
until the owner changes it.

| Step | Choice | Why |
| --- | --- | --- |
| Plan | Node's built-in test runner; esbuild for bundling; one pull request per build step; publisher `cyborgninja21`. | Chosen when the plan was written; see "Technical choices" in PLAN.md. |
| Plan | `.asset` files and checking several mods together as one playset come after the MVP. | Neither is needed for the definition of done. |
| 1 | TypeScript 6.0.3, not the newer 7.0.2. | typescript-eslint 8.73.0 supports TypeScript below 6.1 only. |
| 1 | ES modules everywhere; packages named `@pychivalry/*`; every package at version 0.0.0 until release. | One module system; the version is set at release. |
| 1 | The tools behind the tasks are TypeScript in a `tools/` workspace, with `ajv` as their only dependency. | The core stays dependency-free. |
| 1 | The spec check accepts package formats 4 and 5. | Format 4 is the stand-in; format 5 is what step 0 produces. |
| 1 | A game's manifest hash lists every file with its size and hashes content only for the folders the game's own checksum manifest names; a mod's hash covers every file. | Hashing every game file is slow and the game itself treats only those folders as content. |
| 1 | The record check also refuses a record that names another corpus manifest, holds an absolute path, or states statistics that disagree with its raw values. | Each closes a way for a record to be wrong and still pass. |
| 1 | Release 2.3.0 is built for the baselines from an export of `legacy/` outside the repository. | Its scripts write into their own tree, and `legacy/` stays unchanged. |
| 1 | Speed baselines keep the first run of a series apart from the rest, and call it "first", not "cold". | The operating system's file cache cannot be dropped without administrator rights. |
| 1 | 2.3.0's base-game baseline ran with an 8 GiB heap limit. | It runs out of memory on game 1.21.0.3 under Node's default; the record says so. |
| 2 | Parse findings have stable identifiers (`syntax/missing-closing-brace` and so on, and `encoding/not-utf8`), each naming its catalogue entry as evidence; they have no public code yet. | The code scheme is fixed with the check inventory (item 4.1), which maps each identifier to its permanent code; the catalogue's own ids may change when the 1.21 spec cleans the catalogue. |
| 2 | A parse finding with no catalogue message (unterminated quoted text, malformed `@[ ... ]`) is information, not an error. 2.3.0 made both errors. | Principle 1 of MVP.md: an error needs game evidence. Item 4.1 can raise them if it finds their message (the catalogue's `Expected: <...>` family is a candidate for the arithmetic). |
| 2 | A name directly before a block or quoted text in a value is a tagged value (`rgb { }`, `hex { }`, `list "x"`), whatever the name. | No name list in the parser. In the base game this form occurs 5,147 times with six names, all of them colours, positions or named lists. |
| 2 | A name before a key (`scripted_trigger name = { }`) is recognised by shape: at the top level, on the key's line, with a block as the value. | No name list; all 4,651 uses in the base game have that shape. Inside a block the same tokens are a mixed list, and on another line the word is a stray one that must be reported. |
| 2 | A `$PARAM$` between two values is an operator at the top level, or in a block that also holds pairs; in a block of values only it is a value. | The base game's 3 uses are in blocks with pairs, and its one list of parameters (`{ $SKILL_A$ $SKILL_B$ }`) must stay a list. |
| 2 | `?=` is accepted after a `$PARAM$` as well as a name or a scope chain. | The base game does it 342 times; a parameter stands for a name or a chain. |
| 2 | A bare value inside a block is not a parse error; at the top level of a file it is. | Blocks hold lists and mixed lists. 2.3.0 reported a bare value in a record from its schema check, which is step 4's. |
| 2 | `yes`, `no` and numbers keep their text; a scope chain is split into segments but its head is not classified. | The parser is syntax only; 2.3.0 classified chain heads from a list in its code. |
| 2 | The base-game folders the suite reads, the two files it leaves out (`gfx/models/buildings/naming.txt`, `sound/GUIDs.txt`) and the files it does not read, each with its evidence. | The plan left open which folders beyond `common`, `events` and `history` hold script; the evidence is in encoding.md. |
| 2 | Base-game parse errors are classified in `tools/data/parse-classifications.json`, matched by file, finding and line; an entry that matches no error fails the suite too. | Records are written only by tasks, so the classifications cannot live in `records/`; matching by line makes a game patch force a fresh look. |
| 2 | The `game:parse` record also measures the encoding of every text file of the game. | So the figures of encoding.md come from a task and a committed record, not from a one-off scan. |
| 2 | Quoted text without its closing quote runs to the end of the file; an unclosed `@[` ends at its line. | As 2.3.0 did; the first is how such text lexes, the second keeps one mistake from swallowing the file. |
| 2 | An incremental re-parse re-parses the innermost closed block around the edit, then the next one out, then the whole file. | The simplest unit that is provably the same as a full parse; a test checks every fixture. |
| 2 | A UTF-16 file is not detected; it is read as UTF-8 and gets the note. | The base game has none. |
| 2 | The release 2.3.0 fixture `broken_syntax` is carried over byte for byte as `fixtures/mods/parse-broken-syntax`. | Its two parse findings are the ones its golden file lists; the rest of that file is step 4's. |
| 3 | Build step 3 stops after item 3.1, as its brief says when a rule the index needs is open; nothing of items 3.2 to 3.10 is built. | Six rules in overrides.md are open and the index depends on each; building on them would be building on a guess. |
| 3 | The message texts of the Linux executable, read with `strings`, are used as rank-1 evidence beside the spec's catalogue: `Overriding entry '{}' for database '{}' in '{}'`, the localization reader's duplicate messages and `/replace/`, the descriptor key `replace_path`. | The committed catalogue does not carry them, and they are the game's own words on overriding; [references/game-files.md](references/game-files.md#the-linux-executable) already lists the executable as a source. |
| 3 | The base game is the install's `game/`, `jomini/` and `clausewitz/` folders, not `game/` alone; which copy wins where two share a path stays open (overrides.md, rule 3). | `jomini/` holds script and localization `game/` does not, and `game/` ships changed copies of 39 of the 41 such files the two share. |
| 3 | A rule is marked settled when a `.info` file states it, or when the base game's own files depend on it (defines split across files, container keys written in several files, file names repeated in different folders) and no game evidence points the other way; an inference about how the engine ranks its folders, and anything resting only on what modders say, stays open. | The brief's test: settled by game evidence, never by a hint. |
| 3 | An event id defined twice at the same `id_override_priority` is kept twice and marked as a clash; the index does not pick one. | The game calls it an error, and nothing says which definition it then uses. |
| 3 | The counts in overrides.md come from a one-off scan of game 1.21.0.3 with the build step 2 parser, not from a task and a committed record. The whole-base-game index suite (item 3.5) is to re-measure them in its record. | The step stopped before any index code, so there is no index suite yet to make the record. |
| 3 | The experiments are three probe mods for the analysis machine, each answered in one launch: A for file order, record replacement, the install's folders, on-actions, history, localization and file-name case; B for `replace_path` and a mod file at a DLC file's path; C for a folder written in upper case. Each reads its answer from a decision's description that prints script values with `[EmptyScope.ScriptValue('name')|0]`, and from the logs. | One launch answers most rules; the localization form is the base game's own; B hides whole folders and C cannot share a mod folder with A on Windows. |
| 3 | The CK3 wiki's claims are written as what modders commonly state, unverified. | Its site refused automated requests on 2026-11-21, so none of its pages could be read and quoted. |
| 3 | The rules table is `spec/override-rules.json`, format 1, with its JSON Schema `spec/override-rules.schema.json`; `task spec:check` validates it against the schema and with the core's reader. Its rows are of nine kinds (`file-replace`, `file-identity`, `path-case`, `pack-layer`, `replace-path`, `file-order`, `key-resolution`, `containers`, `folder-wins`), one per kind of question overrides.md asks, settled or open; the stand-in uses five. | The spec package has no such table yet and the format 5 plan defines none. A vocabulary that covers the open rules lets a rule the spec work adds be a row and no code; if step 0 delivers another shape, a reader maps it onto this one. |
| 3 | The stand-in's rule-1 row covers a mod over `game/` only. A mod file at the path of a `jomini/`, `clausewitz/` or DLC file has no row: both files are listed and neither is said to be read. | Rule 1's evidence (`_events.info`, `_characters.info`) is about the `game/` folder; whether the install's other folders are overlaid the same way is rule 3, and a mod over a DLC is rule 10's open part. |
| 3 | The DLC packs are read through the table's `pack-layer` row (rule 10): a folder of `game/dlc/` holding a `.dlc` descriptor whose `path` names it; its files sit at their path inside the pack, in a layer `dlc:<pack>`. Without the row a pack's files are in no folder the spec lists and are not read. The install's other two folders are found beside the game folder by their names, `jomini/` and `clausewitz/`. | The core holds no rule of its own; the three install folders are the layout overrides.md rule 3 describes. |
| 3 | What a definition is: a top-level `key = ...` (or `key { ... }` after a parse error) whose key is a name, a whole number or an `@constant`, in a file of a folder the spec lists, recorded with how it is written: `record` (a block), `value`, `prefixed` (`word key = { }`), `constant`, and, where a `containers` row names the key, `container` with its `entry` definitions. A top-level key that is a date, a scope chain, quoted text or a `$PARAM$` is not a definition. | The spec package's own wording for a database's keys is "a top-level key of a file in the key database folder" (`keyword_templates`); the form is recorded so that no line is drawn that the spec does not draw. A date names no record: in `history/cultures`, `history/situations` and `history/struggles` the record is named by its file, which no table says, so they hold no keyed definitions (the 1.20 spec counted their dated blocks, 573, 6 and 24, as records). |
| 3 | `namespace = x` in an event file is a definition of form `value` of the database `events`. The events priority row is for records, so `namespace` is "defined more than once, winner not known" (631 definitions in the base game), and no clash is reported. | No table says which top-level keys are declarations rather than records; the hand-kept tables of the format 5 spec (structural keywords) can. Applying the priority rule to it would report 631 false clashes. |
| 3 | Each folder of the spec's list is its own database, even where two share a content type (`common/activities/pulse_actions` and `common/schemes/pulse_actions`). Inline `word key = { }` definitions are in the database `inline:<word>`, `@constants` in one database `constants`, localization keys in `localization:<language>`, the language being what the file's header line says. | Nothing says two folders form one database, or what an inline definition's or a constant's scope is; keeping them apart reports more "defined more than once", never a wrong winner. 2.3.0 took the language from the file name with a list of languages in its code. |
| 3 | A use is a word written anywhere in a read file but a definition's own key: a name or constant, a whole number, each segment of a scope chain and the part after its `:`, each name between `|` bars, quoted text holding one such word, and `$name$` in localization. Uses are untyped: a use of `brave` is a use of every definition named `brave`. | The 1.20 spec has no value types to say what kind of name a field holds; step 4 has them from the 1.21 spec. Counting every word keeps every real use and invents no definition. |
| 3 | A file in a folder the spec does not list is not read at all, for definitions or for uses; the index suite counts such files by folder. | "Do not invent record keys" for a folder the 1.20 spec does not describe; its uses would point at nothing the index can resolve either. |
| 3 | With no row to settle it, a file's read status is `unknown` when another layer has a file at its path, a path differing only in case, a `replace_path` naming its folder, or (without the `file-identity` row) a file of its name elsewhere; every name it defines is then "winner not known", even one it alone defines. | A file the game may not read cannot be said to define anything in force. |
| 3 | A localization entry needs no indentation, and its text runs to the last quote on the line that is followed only by a comment. 2.3.0 skipped entries without indentation. | Game 1.21.0.3 writes 7,544 entries without indentation, which its own interface uses, and 776 entries whose text holds a quote followed by `#`. |
| 3 | The cache is one binary file per game build, platform, spec and rules table, format `PYCHIDX` 1, on little-endian hosts only. Its key adds the fallback encoding and a manifest of the files the index reads, each with its size and modification time, not a hash of its content. | Checking the key at every start must be fast; a patch changes a file's size or time. The suite records hash content; the cache does not need to. |
| 3 | The cache folder is `%LOCALAPPDATA%\pychivalry\Cache\index` on Windows and `$XDG_CACHE_HOME/pychivalry/index` (by default `~/.cache/pychivalry/index`) on Linux; `~/Library/Caches/pychivalry/index` on macOS, untested. | Each system's own convention for non-essential per-user data ([references/editors-and-agents.md](references/editors-and-agents.md#cache-folders)). |
| 3 | `task game:index` runs the fresh build, the reload and each mod alone, each in a fresh process with Node's default heap, writes the cache to a temporary folder deleted after the run, and states the load average before the run. Its record carries the rules table's digest, and `task records:check` refuses one made on another table. | One heavy job at a time, each measured on its own; a changed rules table changes answers, so it must force a re-run as a changed spec does. |
| 3 | The suite counts each unknown name under every open rule of overrides.md that leaves it open: no row for a localization database, rule 7; for the history of titles or provinces, rule 6; for a define, rule 4; for any other database, rule 5; a file sharing its path with `jomini/` or `clausewitz/`, rule 3, with a DLC, rule 10; a case difference, rule 9; `replace_path`, rule 8; no file order, rule 4. | The brief asks for the names with no winner known, by rule; the mapping is the reading of overrides.md and lives in the suite, not the core. |
| 3 | The whole-base-game index suite re-measures the counts the one-off scan of item 3.1 gave (row above): the record gives 634 province histories, 4 title histories, 13 modifier formats, 2 landed titles and 3 character ids twice, as overrides.md does; for coats of arms it counts names (162 unknown) where overrides.md counted second copies (169). | Recorded by a task, as that row asked. |

## Asked, awaiting the owner

Questions a step has put to the owner and that are not yet answered. Each moves to the log when
it is answered.

| Step | Question | Why it is asked |
| --- | --- | --- |
| 3 | Should `namespace`, and any other top-level declaration of a folder that is not a record, come from the spec's hand-kept tables, so that the index stops recording it as a definition? | The stand-in spec has no such table; until then `namespace` is one name defined 631 times with no winner known. |
| 3 | Should rule 1's row also cover a mod file at the path of a `jomini/` or `clausewitz/` file? | The evidence is about `game/`; the stand-in leaves those cases open (1 name in the corpus, in elf-destiny). |
| 3 | The spec does not say that a landed title's nested keys (`k_`, `d_`, `c_`, `b_` titles inside an empire) are titles, nor that a culture's history is named by its file. Should the 1.21 spec carry both? | Without them the index defines only the top-level titles (3,475) and no culture, situation or struggle history; references to the rest resolve to nothing. Step 4's title and culture checks will need them. |
| 3 | The base game's index peaks at 1.30 GiB while it is built and takes about 650 MiB once loaded from the cache. Is that acceptable for each surface (the language server and each agent server) to hold its own copy? | PLAN.md step 7 asks whether three copies are acceptable; these are the figures for one. |
