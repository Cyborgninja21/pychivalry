# What the parser reads

What pychivalry's parser reads and how: the encodings of script files, the byte-order mark,
line endings, how positions are counted, which folders of the base game hold script, the
syntax it accepts and the findings it reports. Written by build step 2
([PLAN.md](PLAN.md#step-2-parser), items 2.1 to 2.8).

Every figure here was measured on game 1.21.0.3 on 2026-11-21 by `task game:parse`, and is in
its record, [records/game/parse.json](../records/game/parse.json): the encoding figures under
`results.encoding`, the folders under `results.folders`.

## Encodings

### What the game ships

The measurement covers every text file of the game folder: 20,530 files with the extensions
`.txt`, `.gui`, `.yml`, `.info`, `.asset`, `.gfx`, `.shader`, `.settings` and `.mod`.

| What | Files |
| --- | --- |
| Valid UTF-8 | 20,503 |
| Not valid UTF-8 | 27 |
| Starting with the UTF-8 byte-order mark | 16,766 |
| Starting with a UTF-16 byte-order mark | 0 |

The byte-order mark is common but not universal, and differs by folder:

| Folder | Files | With the mark |
| --- | --- | --- |
| `events`, `.txt` | 610 | 610 |
| `common`, `.txt` | 3,035 | 2,663 |
| `history`, `.txt` | 837 | 613 |
| `gfx`, `.txt` | 272 | 237 |
| `gui`, `.gui` | 441 | 192 |
| `localization`, `.yml` | 12,171 | 12,171 |

The 27 files that are not valid UTF-8:

- **25 in `history/titles/`.** Each holds Windows-1252 letters (`é`, `á`, `ö` and the like) in
  the comments that name a title's holders: from 1 to 369 bytes a file, 1,368 in all, and
  every one of them in a comment. Two of these files, `k_romagna.txt` and `k_scotland.txt`,
  also hold letters written in valid UTF-8 (2 and 11 of them).
- **`map_data/positions.txt`:** 84 bytes, all in comments.
- **`licenses/software/FTL.txt`:** 1 byte, in quoted text. The parser does not read
  `licenses/`.

In all 27 files, each invalid sequence is a single byte.

The game's own error catalogue has a message for its title and culture history that says
which encoding it expects there: "Failed to read title history, not a valid date at: {}
(check encoding, should be ansi)". "ANSI" is Windows' name for the system code page, which on
a Western system is Windows-1252.

### The policy

Decided by the owner on 2026-11-21 ([decision 38](decisions.md#log)).

1. **UTF-8, with or without the byte-order mark,** is what a script file is.
2. **A file that is not valid UTF-8 is still read, and parsed in full.** Each invalid sequence
   becomes U+FFFD, the replacement character. The game itself ships such files and loads them,
   so this is never an error or a warning.
3. **One information note per file** says it is not valid UTF-8: how many bytes are invalid,
   and how the file was read. It is placed at the first invalid byte. Its identifier is
   `encoding/not-utf8`.
4. **A fallback encoding** can be named by the caller: Windows-1252, off by default. The
   invalid bytes of a file that is not valid UTF-8, and only those, are then decoded with it,
   so its letters read correctly. Everything that is valid UTF-8 stays as it is, in that file
   and in every other. The note is still given.

Where it lives today: the core's decoding function, `decodeScript(bytes, options)`, and
`readScript`, which decodes and parses, take `fallbackEncoding: 'windows-1252'`. Both paths
are tested on the fixture mod
[`encoding-windows-1252`](../fixtures/mods/encoding-windows-1252/README.md). The VS Code
setting that exposes the option arrives with the extension, in build step 7
([guide/settings.md](guide/settings.md)).

What follows from it:

- **On the base game neither path changes a tree.** Every invalid byte the parser reads sits
  in a comment, so the fallback changes only comment text. In a mod, it changes quoted text
  too.
- **The fallback reads only the invalid bytes** ([decision 39](decisions.md#log)). A file that
  mixes Windows-1252 bytes with letters in valid UTF-8, like `k_romagna.txt` and
  `k_scotland.txt`, reads both kinds correctly. As first built the fallback decoded the whole
  file, which turned those files' valid letters into two characters each (`Niccolò` as
  `NiccolÃ²`).
- **Invalid is what the WHATWG Encoding Standard says it is,** the UTF-8 decoder built into
  Node and every browser (`TextDecoder`): a byte that cannot start a sequence, or a sequence
  cut short, together with the bytes of it that were read, is one U+FFFD. The note counts
  invalid bytes.
- **UTF-16 is not detected.** No game file uses it; a file that does is read as UTF-8, like any
  other, and gets the note.

## The byte-order mark

The UTF-8 byte-order mark (`EF BB BF`) is removed when a file is decoded, and reported
(`bom: true`). It is never part of the text, so no offset or position counts it. `parse`, which
takes text, removes a leading U+FEFF in the same way.

## Line endings

| How lines end | Files |
| --- | --- |
| `\n` only | 13,602 |
| `\r\n` only | 6,876 |
| Both, mixed | 36 |
| A lone `\r` | 0 |
| No line break at all | 16 |

To the parser a line break is whitespace, as it is to the game; only comments end at one, and
a comment never includes it. For positions, a line ends at `\n`, `\r\n` or a lone `\r`, as in
the language-server protocol.

## Positions

Every node and every finding has `start` and `end` offsets, and a finding also has a range of
positions (item 2.2):

- An **offset** counts UTF-16 code units into the decoded text, which never holds the
  byte-order mark.
- A **position** is a line and a character, both from 0; the character counts UTF-16 code
  units from the start of the line. A character outside the Basic Multilingual Plane counts
  two. This is the default position encoding of the language-server protocol, and what VS
  Code shows.
- **On both decoding paths** a position is counted in the text that path produced: one U+FFFD
  per invalid sequence when read as UTF-8, one character per byte when read as Windows-1252.
  An editor that decodes such a file another way shows other columns after an invalid byte on
  the same line. For a file open in the editor this never arises: the language server parses
  the editor's own text.

## The base-game folders the parser reads

Release 2.3.0 read `common`, `events` and `history`. Which other folders hold script was not
known (PLAN.md, step 2). The evidence that a folder holds script the game loads: the spec's
directory list (`directories[].path`), the game's own
`paths.settings` and `checksum_manifest.txt`, and the DLC folders, which repeat the game's
layout. `task game:parse` reads this list, and fails if a folder holds another number of files.

| Folder | Extension | Files | Why |
| --- | --- | --- | --- |
| `common` | `.txt` | 3,035 | Database records; 2.3.0 read it; 183 folders of it are in the spec |
| `events` | `.txt` | 610 | Events; 2.3.0 read it |
| `history` | `.txt` | 837 | History; 2.3.0 read it; 10 folders of it are in the spec |
| `gfx` | `.txt` | 271 | 26 of its folders are in the spec (coats of arms, court scenes, map styles, portraits); `paths.settings` points into it |
| `map_data` | `.txt` | 8 | In the spec and in the game's checksum manifest |
| `music` | `.txt` | 3 | In the spec; `paths.settings` names `music/music_player_categories` |
| `sound` | `.txt` | 8 | In the spec; `paths.settings` names `sound/map/ambience` |
| `dlc` | `.txt` | 44 | The DLC's own files, in the game's layout |
| `data_binding` | `.txt` | 22 | In the game's checksum manifest; data-binding macros in script syntax |
| `content_source/map_objects` | `.txt` | 16 | `paths.settings` names its `generators` and `masks` |

In all: 4,854 files. Two files in these folders are not script and are left out, each named in
the record: `gfx/models/buildings/naming.txt`, a plain list of model names with no `=`, and
`sound/GUIDs.txt`, a table of sound-bank identifiers.

Not read, and why:

| What | Why |
| --- | --- |
| `gui/**/*.gui` | GUI syntax: its own parser and suite, build step 10 |
| `localization/**/*.yml` | Localization: read by the index, build step 3 |
| `**/*.asset` | `.asset` files come after the MVP |
| `**/*.info` | Paradox's documentation files: prose with examples, not loaded as script |
| `*.shader`, `*.gfx`, `*.settings` | Shaders and engine settings |
| `fonts/`, `licenses/`, `credits.txt` | Licences and credits |
| `tests/`, `tools/`, `notifications/`, `dlc_metadata/`, `content_source/TODO.txt`, the other `.txt` files at the top of the game folder | Nothing in the spec or the game's settings names them as script the game loads |

### The result on 1.21.0.3

Every one of the 4,854 files yields a tree. Decoding and parsing them all takes 5.3 seconds,
in one process, on the laptop that runs the suites (Linux, x64, 16 logical CPUs, Node 22).

There are three parse errors, each a defect in the game's own files and classified so in
[tools/data/parse-classifications.json](../tools/data/parse-classifications.json):

| File | Line | Finding | What is wrong |
| --- | --- | --- | --- |
| `common/holding_sprawl_patterns/00_holding_sprawl_patterns.txt` | 1988 | `Expected '=' between block name and body` | A pattern written `name {` |
| `events/dlc/gdp/gdp_visit_holding_decision_event_2.txt` | 3839 | `Expected } after arguments` | The file ends inside its last event |
| `history/characters/han/sima_53f8_99ac.txt` | 1395 | `Expected '=' between block name and body` | A dated entry written `296.1.1 {`, the defect 2.3.0 found in `japanese.txt` on 1.20 |

The other 26 findings are the information notes of the 26 files read that are not valid UTF-8.

## The syntax the parser accepts

The parser is syntax only: no CK3 name is looked up, and none is listed in its code. Where a
form could only be recognised by a name, it is recognised by its shape instead, and the shape
was measured on the base game. Each count is of the 4,854 files above.

| Form | Rule | In the base game |
| --- | --- | --- |
| A name before a block or quoted text, in a value: `rgb { 255 0 0 }`, `list "colors"` | Any name, followed by a block, or by quoted text that is not the key of the next pair | 5,147 uses, of six names: `list` 2,397, `cylindrical` 1,587, `hsv` 1,042, `rgb` 111, `hex` 9, `hsv360` 1 |
| A name before a key: `scripted_trigger name = { ... }` | At the top level of a file, on the key's line, with a block as the value | 4,651 uses: `scripted_trigger` 2,894, `scripted_effect` 1,757 |
| A `$PARAM$` where the operator goes: `count $OPERATOR$ $COUNT$` | At the top level, or in a block that also holds pairs; in a block of values only it is a value | 3 uses, each in a block with pairs |
| `?=` | After a name, a scope chain, or a `$PARAM$`, which stands for one | 41,764 uses: 24,259 after a chain, 17,163 after a name, 342 after a `$PARAM$` |
| `name { ... }`, the `=` missing | Among statements, reported and read as `name = { ... }`; in a block of values only, a value and a block | The two errors above |

The lexer's tokens are listed in `packages/core/src/syntax/lexer.ts`: the eight operators,
braces, quoted text (which may span lines; `\"` and `\\` are its only escapes), comments,
inline arithmetic `@[ ... ]` as one token, and words classified by shape as numbers, dates
(`year.month.day`), `@name` constants, `$PARAM$` parameters, scope chains (a dot inside
`|...|` does not split one; `namespace.0001` is a name) and plain names.

## What the parser reports

Every finding has the structured shape of principle 3 of [MVP.md](MVP.md#principles): an
identifier, a severity, offsets and a range, the values it is about, and its evidence. Where
the spec's error catalogue holds the game's own message, that entry is the evidence and the
finding is an error; the message text is read from the committed spec, never copied into the
code. Where it holds none, the finding is pychivalry's own advice and is information
(principle 1).

| Identifier | Severity | Evidence: catalogue entry | When |
| --- | --- | --- | --- |
| `syntax/missing-closing-brace` | error | `expected_after_arguments` | A block still open at the end of the file |
| `syntax/unexpected-closing-brace` | error | `unexpected_token_expected_key` | A `}` at the top level |
| `syntax/block-without-key` | error | `unexpected_token_expected_key` | A block at the top level with no key |
| `syntax/operator-without-key` | error | `unexpected_token_expected_key` | An operator with no key |
| `syntax/missing-value` | error | `expected_between_equals_and_arguments` | An operator with no value after it |
| `syntax/missing-operator` | error | `unexpected_token_X_found_at_X_expected` | A key at the top level with no operator |
| `syntax/missing-equals-before-block` | error | `expected_between_block_name_and_body` | `name { ... }` among statements |
| `syntax/null-safe-operator-after-value` | error | `unexpected_token_X_found_at_X_expected` | `?=` after a number, date, constant or quoted text |
| `syntax/unterminated-string` | information | none | Quoted text without its closing quote |
| `syntax/malformed-arithmetic` | information | none | `@[ ... ]` that is not well formed, or has no `]` |
| `encoding/not-utf8` | information | none | A file that is not valid UTF-8 |

The identifiers are stable, but they are not the public diagnostic codes: those are fixed with
the check inventory, item 4.1, which gives each identifier its permanent code. Each recovery is
tested on a fixture mod under [fixtures/mods/](../fixtures/mods/README.md), whose name starts
with `parse-`.
