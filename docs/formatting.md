# The formatting rules

**Status: decided by the owner on 2026-11-23, and built** (build step 8 of
[PLAN.md](PLAN.md#step-8-formatter-and-fixes): the rules are item 8.1, the formatter 8.2, its
round trip on the base game 8.3, its golden files 8.4, on-type formatting 8.5, `format` on every
surface 8.9). The owner first signed off the eleven decisions this page proposed, most of them
keeping each file's layout as its author wrote it (decisions 90 to 100), then, the same day, set a
new principle and decided again where it differs (decisions 101 to 103): **best practice and
cleanliness take precedence over anything a mod author did. A poorly laid out, unformatted mod is
fixed by the formatter and flagged as issues.** What was decided, and when, is the record at the
end, under [What was decided](#what-was-decided).

**Where the counts come from.** Every count of the base game was measured on game 1.21.0.3 on
2026-11-23, over the 4,854 script files `task game:parse` reads
([encoding.md](encoding.md#the-base-game-folders-the-parser-reads)) and the game's 12,171
localization files, with the step 2 parser. The figures of what the formatter changes are the
round trip's, committed in `records/game/parse.json` ([The round trip on the base
game](#the-round-trip-on-the-base-game)); the figures of how the base game is written were
measured by scripts that are not committed. Columns are counted as [rule 4](#the-width-of-a-line)
says. The game was never started.

**Examples.** Each "before" and "after" below is written by hand; the golden files of
`fixtures/format/` hold one pair for each rule, byte for byte. In the "after" blocks every
indentation is a tab character, and every line ends with `\r\n`.

## The rules in short

| # | Rule | Base-game files it changes (of 4,851 formatted) |
| --- | --- | --- |
| 1 | Indent with tabs, one per enclosing block | 1,493 |
| 2 | Exactly one space between two tokens on a line; `{}` for an empty block | 1,609 |
| 3 | No `=` alignment | (counted with rule 2) |
| 4 | The formatter decides the layout: a block of one simple pair, a list of plain values and an empty block go on one line when the line fits in 120 columns; every other block is broken, one item a line; a pair's key, operator and value on one line | 4,073 |
| 5 | Lists follow rule 4: on one line when it fits, otherwise one value a line | (counted with rule 4) |
| 6 | Every token keeps its text: quotes, numbers, `@[ ... ]`, `$PARAM$`, `?=` | none: the tree demands it |
| 7 | At most one blank line; none after `{`, before `}`, at the start or end; none added | 2,749 |
| 8 | Every comment kept in its place; exactly one space before a comment at the end of a line; a block holding a comment is broken | 683 for the space before a comment |
| 9 | No trailing spaces or tabs | 2,365 |
| 10 | Windows line breaks (`\r\n`) in every file; exactly one at the end | 1,551 |
| 11 | The UTF-8 byte-order mark in every file | 645 |
| 12 | A file with a parse error is left untouched, and the formatter says why | 3 left |
| 13 | Localization files: whitespace only, never the text | 12,064 of 12,171 |

The formatter changes 4,656 of the 4,851 base-game script files it formats; the other 195 are
already in the format.

## How the formatter works

The formatter (`packages/core/src/format/`) reads a file's text and its tree. The tree says
what each token is (the key of a pair, its operator, the head of its value, a bare value, a
block without a key, a comment) and which block holds it; the text says where the author broke
lines and left blank lines. Every token is written exactly as it is, but for the spaces and tabs
at the end of a comment; only the whitespace between two tokens is decided again, gap by gap.

The layout decisions are one small table of rules (`format/rules.ts`): how a block of each shape
is laid out (as written, on one line when it can be, or always over several), where the values
of a list go, the width of a line, how many blank lines are kept, the line break and the
byte-order mark. The engine can join lines as well as split them. Every surface formats with the
same table, `FORMAT_RULES`; no setting changes it (rule 14).

**Words used below.**

- A **simple pair** is a pair with no name before its key whose value is a single token: a word,
  a number, quoted text, `@[ ... ]`, or an operator (`count $OPERATOR$ 3` and `OPERATOR = <=`
  are simple pairs; `color = rgb { 1 2 3 }` and `list = list "name"` are not).
- A **list of plain values** is a block that holds only values, each a single token (the tree's
  `blockShape` is `list`): `{ a b c }`, `{ 1 2 3 }`.
- An **empty block** holds no item, or only comments.
- A block is **on one line** when its `{` and `}` are on the same line, and **broken** when its
  `{` ends its line (but for a comment), each item starts a line of its own, and its `}` starts a
  line.
- A token's **depth** is the number of blocks that enclose it between their braces; a block's own
  `{` and `}` are not inside it, so a `}` has the depth of the line that holds its `{`.

## The rules

### 1. Indentation

**Rule.** A line starts with one tab for each block that encloses its first token, and with
nothing else: no spaces. A line that starts with `}` gets the indentation of the line that holds
its `{`. A line that starts inside quoted text written over several lines is left exactly as it
is, since its spaces are part of the text. A blank line holds nothing.

Before:

```
my_event.1 = {
    type = character_event
  immediate = {
      add_gold = 10
      add_prestige = 5
        }
}
```

After:

```
my_event.1 = {
	type = character_event
	immediate = {
		add_gold = 10
		add_prestige = 5
	}
}
```

**Evidence.** Of the 6,668,210 indented lines of the base game, 6,498,822 (97.5%) are indented
with tabs only; 3,524 files use tabs only, 36 spaces only, 1,211 both. Paradox's own
documentation files are written the same way: 186 of the 214 `.info` files with tabs only.

### 2. Spaces between tokens

**Rule.** Two tokens on the same line are separated by exactly one space: around each of the
eight operators and a `$PARAM$` written in an operator's place, inside the braces of a block on
one line, between values, between a name and its block or quoted text (`rgb { 255 0 0 }`,
`list "my_list"`), between a name and the key after it, after a `}`, and before a comment at the
end of a line (rule 8). An empty block is `{}`. No line has a space beyond its indentation at its
start, or any at its end.

Before:

```
limit={is_adult=yes}
age>=16
color = hsv{ 0.5  0.5 0.5 }
empty_effect = { }
scope:target?={ is_alive = yes }
```

After:

```
limit = { is_adult = yes }
age >= 16
color = hsv { 0.5 0.5 0.5 }
empty_effect = {}
scope:target ?= { is_alive = yes }
```

**Evidence.** Every gap between two tokens on one line of the base game, by what stands either
side: a value and an operator 4,813,634 of 5,423,927 with one space; an operator and a value
2,803,000 of 2,990,052; two values 1,260,414 of 1,284,332; `{` and a value 802,026 of 806,267. The
seven comparison operators have one space each side 101,524 times of 101,610.

### 3. No `=` alignment

**Rule.** No padding before an operator; operators are never lined up in columns.

Before:

```
type            = character_event
title           = my_event.1.t
```

After:

```
type = character_event
title = my_event.1.t
```

**Evidence.** Of the base game's runs of pairs whose keys differ in length, 577,003 have one
space before each operator and 57 are aligned in a column. Alignment also re-pads every line of a
block when one longer key is added, and on-type formatting could not keep it as one types.

### 4. Layout: one line or several

**Rules.**

1. **The formatter decides the layout, not the author.** It joins lines as well as splitting
   them.
2. **A block holding one simple pair, a list of plain values and an empty block go on one line
   when that line fits in 120 columns** (the width, below).
3. **Every other block is broken**: `{` ends its line (but for a comment at the end of it), one
   item a line, `}` on a line of its own. In a broken block, and at the top level of the file,
   every pair, every block without a key and every value starts a line of its own.
4. **A block that holds a comment is broken**, whatever its shape: a comment runs to the end of
   its line, so nothing can follow it on the line, and no comment is moved across code. So is a
   block holding quoted text written over several lines, or `@[` without its `]` (which runs to
   the end of its line), and a block that holds a broken block.
5. **A pair stays on its key's line.** A line break between a pair's key (or the name before
   it), its operator and the head of its value is removed: `key =` at the end of a line and `{`
   on the next become `key = {`. The one exception is a comment written inside the pair, which
   ends its line; the pair goes on on the next line at the key's indentation.
6. **A name before a key stays on the key's line** (`scripted_trigger my_trigger = { ... }`):
   the parser reads it as the key's prefix only there.

Before:

```
reward = {
	add_gold = 5
}
trigger = { age >= 16 is_adult = yes }
option = { name = my_event.1.a
	add_prestige = 50 }
flags = {
	a b c
	d e
}
immediate =
{
	add_gold = 10   remove_trait = shy
}
```

After:

```
reward = { add_gold = 5 }
trigger = {
	age >= 16
	is_adult = yes
}
option = {
	name = my_event.1.a
	add_prestige = 50
}
flags = { a b c d e }
immediate = {
	add_gold = 10
	remove_trait = shy
}
```

**What it rewrites in the base game.** Each block by its kind, as written and as laid out:

| Block | Written on one line, kept | Written on one line, broken | Written over several, joined | Written over several, kept |
| --- | ---: | ---: | ---: | ---: |
| One simple pair | 257,936 | 2,529 | 335,741 | 43,292 |
| Plain values | 476,780 | 2,165 | 25,983 | 6,840 |
| Empty | 9,473 | 10 | 15,440 | 982 |
| Every other block | 0 | 62,896 | 0 | 1,305,550 |

So the formatter joins 377,164 blocks onto one line and breaks 67,600 blocks written on one
line. A block of one simple pair or plain values written over several lines and kept there holds
a comment, quoted text over several lines, or does not fit in 120 columns; an empty block over
several lines holds a comment, but for the 10 written on one line at the end of a line wider than
120 columns, which the width breaks like any other (`{` and `}` on two lines). The `style/block-layout`
hint is given at 453,593 places in 4,073 files.

#### The width of a line

The 120-column rule: a block that the rules put on one line stays there only while its line is
120 columns wide or less.

- **How a column is counted.** As an editor with a tab size of 4 shows the line: a tab moves to
  the next multiple of 4 (the formatter writes tabs only at the start of a line, where each is 4
  columns); every other character is one column, counted by Unicode code point, not by byte or
  UTF-16 unit (a character outside the Basic Multilingual Plane is one column). A wide
  character (Chinese, Japanese) and a combining mark count as one column each, like any other:
  a width table differs between fonts and Unicode versions, and the rule must give the same
  answer in every program. Outside quoted text and comments CK3 script is ASCII, so this changes
  nothing where it matters. Why 4: it is the width the base game's measurements of this page use,
  the width of 2.3.0's `tabSize` setting, and VS Code's default.
- **Which line.** The line as the formatter writes it, comment at its end included: its
  indentation, its tokens one space apart.
- **Nested blocks: the outermost first.** On a line wider than 120 columns, the outermost block
  on one line is broken; the lines are measured again, and a block inside it that now stands on
  a line of its own stays on one line if that line fits, or is broken in turn.
- **A line still too long stays.** A line wider than 120 columns that holds no block on one line
  (a long value, a long key, quoted text, `@[ ... ]`, a long comment) stays as it is: there is
  nothing left to break. Quoted text and `@[ ... ]` are tokens and are never split.
- **A comment at the end of a broken line** stays at the end of the line of the token it follows:
  after a block's `}`, it ends the line of that `}`; it is never moved before or after another
  token.

**Evidence.** 26,560 lines of the base game's script files are wider than 120 columns, in 1,671
files. Formatted without the 120-column rule, 17,073 lines would be; with it, 9,784 are, each a
line with nothing left to break. The rule changes 990 files on its own (formatted with and
without it).

### 5. Lists

**Rule.** A list of plain values follows rule 4 and nothing else: on one line when its line fits
in 120 columns, otherwise broken, one value a line. There is no limit on the number of values.
A block mixing values and pairs is broken like any other, each value and each pair on a line of
its own.

Before:

```
weights = { 1 2 3 4 5
            6 7 8 9 10 }
```

After:

```
weights = { 1 2 3 4 5 6 7 8 9 10 }
```

### 6. Values are written as they are

**Rule.** Every token keeps its exact text. Quotes are never added or removed, and the escapes
`\"` and `\\` are kept; a number keeps its spelling (`1.50`, `007`, `+5`, `.5`), and so does a
date; `@[ ... ]` is one token whose inside is never touched; a `$PARAM$`, an `@name` constant, a
scope chain, a name before a key or before a block or quoted text keeps its text; `?=`, `!=` and
every other operator stays the operator it is. The formatter changes only whitespace, so this
rule is what keeps the tree the same.

These lines come out exactly as they go in:

```
title = "my_event.1.t"
cost = @[  base_cost*1.50 ]
count $OPERATOR$ $COUNT$
scope:$TARGET$ ?= { is_alive = yes }
```

### 7. Blank lines

**Rules.** A run of blank lines between two items is kept as one blank line. No blank line just
after a `{`, just before a `}`, at the start of the file or at its end. The formatter never adds
a blank line, and a blank line holds nothing. Blank lines inside a pair joined onto one line
(rule 4.5) go with the line breaks.

**Evidence.** Of the base game's 493,205 runs of blank lines, 481,290 (97.6%) are one line long.
The `style/blank-lines` hint is given at 28,394 places in 2,749 files.

### 8. Comments

**Rules.**

1. **Every comment is kept**, in its place among the tokens, with its text from `#` to its end
   unchanged but for the spaces and tabs at its end. The formatter neither adds nor removes a
   comment, nor moves one past another token.
2. **A comment at the end of a line of code stays there**, at the end of the line of the token it
   follows, exactly one space after it.
3. **A comment on a line of its own stays on a line of its own**, indented like code in its
   place. Commented-out script is a comment like any other: everything after its `#`, including
   the indentation written there, is kept.
4. **A comment written inside a pair**, between its key and its value, ends its line, and the
   pair goes on on the next line at the key's indentation.
5. **A block that holds a comment is broken** (rule 4.4).

Before:

```
my_event.1 = {   # the first event
	trigger = {
# commented out:
#		is_adult = yes
		age >= 16	# adults only
	}
	immediate = # a comment inside a pair
	{
		add_gold = 5
	}
}
```

After:

```
my_event.1 = { # the first event
	trigger = {
		# commented out:
		#		is_adult = yes
		age >= 16 # adults only
	}
	immediate = # a comment inside a pair
	{ add_gold = 5 }
}
```

**Evidence.** The base game writes one space before 217,270 of its 237,482 comments at the end of
a line (91.5%); the `style/comment-spacing` hint is given at 20,209 places in 683 files.

### 9. Trailing whitespace

**Rule.** No line ends in a space or a tab: they are removed at the end of every line, a line
that ends in a comment included, and a blank line is emptied. Spaces and tabs before a line break
inside quoted text are part of its text, and are kept.

### 10. Line breaks

**Rules.** Every line break between two tokens is written as `\r\n`, Windows line breaks, the
game's own form: 3,723 of the 4,854 base-game script files (77%) use `\r\n` only. A line break
inside quoted text is part of its text and is kept as it is. The file ends with exactly one line
break after its last line. In the editor the extension sets the document's line breaks to
`\r\n` with Format Document, and makes `\r\n` the default for new CK3 files.

### 11. The byte-order mark

**Rule.** Every file starts with the UTF-8 byte-order mark, the game's own form: 4,209 of the
4,854 base-game script files have it, and every one of its 12,171 localization files, which need
it (part D1 of the spec package, `msg-localization-missing-bom`, says a localization file without
it adds no keys). An empty file, or one of blank lines only, is formatted empty, without a mark.
In the editor the mark is the file's encoding, not text: the extension makes UTF-8 with the mark
the encoding of CK3 files, so saving writes it, and the formatter's edits there never insert it.
The command line writes it with the file.

### 12. Files the formatter leaves as they are

- **A file with a parse error** (any finding of severity error,
  [encoding.md](encoding.md#what-the-parser-reports)) **or with quoted text that has no closing
  quote** is returned unchanged, byte for byte, and the formatter says why: the first such
  finding, with its line and column. The parser's recovery guesses the structure, and formatting
  from a guess would move lines the author never touched. The base game has 3 such files:
  `common/holding_sprawl_patterns/00_holding_sprawl_patterns.txt` (line 1988),
  `events/dlc/gdp/gdp_visit_holding_decision_event_2.txt` (line 3839) and
  `history/characters/han/sima_53f8_99ac.txt` (line 1395).
- **`@[` without its `]`, and malformed arithmetic,** are information findings, not errors: the
  token is kept as written and the file is formatted.
- **A file that is not valid UTF-8** is left unchanged by the command line and the agent server,
  which could not write its bytes back as they were. In the editor the formatter formats the text
  the editor holds. The best-practice warning `style/not-utf8` converts such a file to UTF-8 with
  the byte-order mark (decision 106; [encoding.md](encoding.md)); `check --fix` converts it
  first, and once converted it is formatted like any other.
- **Other files** are not formatted: GUI files, `.info`, `.asset`, `.shader`, `.gfx`, `.settings`,
  and anything that is neither a script file nor a localization file of a folder the game reads.

### 13. Localization files

Localization files have no tree; they are read line by line by the index's localization reader
(`packages/core/src/index/localization.ts`), and each line is formatted as what the reader reads
it as.

- An entry (`key:0 "text"`) is indented with one space, with one space between its key and
  version and the opening quote; from the quote on, the line is kept as written but for the
  spaces and tabs at its end.
- A header (`l_english:`) keeps its line, but for the spaces and tabs at its end; a comment on a
  line of its own is indented with one space.
- Blank lines, trailing whitespace, line breaks and the byte-order mark follow rules 7, 9, 10 and
  11.
- **Never changed:** the text between the quotes, the key, the version number, the header, a
  comment's text, what follows the closing quote, the order of the entries, a line the reader
  does not read as a header, an entry, a comment or a blank line, and an entry whose closing
  quote is missing.

Before:

```
l_english:
my_event.1.t:0  "A Title"
	my_event.1.desc: "Some text"
```

After:

```
l_english:
 my_event.1.t:0 "A Title"
 my_event.1.desc: "Some text"
```

The formatter changes 12,064 of the base game's 12,171 localization files, 11,793 of them for
their line breaks alone or among other rules (they use `\n`).

### 14. No setting

**No setting changes a rule:** one formatting for everyone. The indentation the editor sends with
each request (`tabSize`, `insertSpaces`) is not used. Formatting is switched on and off by the
editor's own settings: `editor.formatOnSave`, `editor.formatOnType` (off by default in VS Code)
and `editor.defaultFormatter`. The extension sets three configuration defaults for CK3 files,
which a user can change: `editor.insertSpaces` false (tabs) for script files, and
`files.encoding` `utf8bom` and `files.eol` `\r\n` for script and localization files.

## Style findings

A file not in the format is flagged, as the owner decided (decisions 101 and 103): the `style/`
family of [checks.md](checks.md#formatting-the-style-family). Their evidence is these rules, not
the game: by the owner's decision, one of the two kinds of warning that rest on pychivalry's own
rules (principle 1 of [MVP.md](MVP.md#principles)); the other is the family's best-practice rows
(below).

- **`style/not-formatted`**, a warning, once for each file not in the format, at its first
  untidy place, saying how many places differ and by which rule. Its safe fix formats the whole
  file.
- **One hint at each untidy place**, one code a rule, each with a safe fix for that place:
  `style/indentation`, `style/spacing`, `style/comment-spacing`, `style/trailing-whitespace`,
  `style/blank-lines`, `style/block-layout` (one a block; and one for a pair over several lines),
  `style/line-endings` (one a file) and `style/byte-order-mark` (one a file). Every edit the
  formatter would make belongs to exactly one hint, and fixing a hint moves the file toward the
  format, never away from it (tested on every golden file).
- **A file with a parse error has none.** The formatter leaves it as it is.
- They go through the one runner like every finding, so the editor, the command line and the
  agent server report them alike, under the per-file limit (most severe first: the warning before
  the hints). `check --fix` applies the warning's fix, which stands for the file's hints. The
  game-file suites count them by code and never classify them; the base game, not written in the
  format, has a warning in nearly every file.
- **What they cost.** Each file is laid out once more when it is checked. The base game's
  `game:check` (17,302 files, the install's `clausewitz/`, `jomini/` and DLC included) took 95
  seconds and 3.7 GB at its peak, against 56 s and 2.9 GB before; it reports 17,009 `style/`
  warnings and 808,526 hints (1,202,986 more hints dropped by the per-file limit). Each fix is
  kept small: edits less than 2,048 characters apart are merged into one (`MERGE_GAP`), and the
  agent server lists a formatting fix of more than 2,000 characters without its edits, marked,
  and points to its `format` tool for the text.
- **The best-practice rows of the same family** (decisions 105 to 107,
  [checks.md](checks.md#best-practice-the-style-familys-best-practice-rules)) are not about
  layout: `style/not-utf8` (a warning, with a fix converting the file to UTF-8 with the mark),
  `style/empty-block`, `style/deep-nesting` and `style/unusual-field-order` (hints). Their fixes
  agree with the format: each fixture pair of theirs is written in the format, and after their
  fixes the formatter finds nothing to change (tested). The field-order fix moves whole lines and
  keeps each field's comments with it; the empty-block fix takes a block's line away; the
  conversion adds the mark, which the formatter would add too, and the two insertions are one.

## What the formatter guarantees

Each is a testable statement; the suite that proves it is named.

1. **The tree is unchanged.** Parsing the output gives the tree parsing the input gives, compared
   without offsets: the same items in the same order and nesting, of the same kinds; each scalar
   with the same type, text, value, closing and scope-chain segments; each pair with the same
   name before its key, key, operator (its text, and whether it is a `$PARAM$`) and value; each
   tagged value with the same tag and body; each block closed alike; each comment with the same
   text but for the spaces and tabs at its end; and the same parse findings by kind and the
   values they name. Proved on every base-game file (item 8.3, part of `task game:parse`), every
   golden file and every fixture of the repository.
2. **No token or comment is lost, added, reordered or changed.** The output's tokens are the
   input's, in order, of the same kinds and texts.
3. **No comment changes its place.** Each has the same tokens around it, and is on a line of its
   own exactly when it was.
4. **Formatting twice changes nothing.** Proved on every base-game file and golden file.
5. **A file the formatter does not format comes back byte for byte**, with the reason. Proved by
   golden files and on the base game's 3 files with a parse error.
6. **The output follows the rules line by line**, as the golden files and the style findings'
   tests check.
7. **On-type formatting agrees with the formatter** ([On-type formatting](#on-type-formatting)).

## The round trip on the base game

`task game:parse` formats every script file it parses with the rules every surface uses, and
the game's localization files ([records/README.md](../records/README.md)). On game 1.21.0.3,
2026-11-23 (`records/game/parse.json`):

| | Script files | Localization files |
| --- | ---: | ---: |
| Files | 4,854 | 12,171 |
| Formatted (the others left: a parse error) | 4,851 | 12,171 |
| Trees (readings) the same after formatting | 4,851 | 12,171 |
| Tokens the same | 4,851 | 12,171 |
| A second format changes nothing | 4,851 | 12,171 |
| Comments before / after / moved | 502,890 / 502,890 / 0 | 74,238 / 74,238 / 0 |
| Files changed | 4,656 | 12,064 |
| Lines before / after | 8,301,399 / 7,844,231 | 3,214,799 / 3,214,004 |
| Lines the formatter's edits touch | 3,280,071 | 3,100,719 |

By rule (the style hints of each file; "lines" are the lines their edits touch):

| Rule | Script files | Places | Lines | Localization files | Places |
| --- | ---: | ---: | ---: | ---: | ---: |
| `style/indentation` | 1,493 | 196,851 | 196,851 | 263 | 11,543 |
| `style/spacing` | 1,609 | 1,228,925 | 627,606 | 23 | 77 |
| `style/comment-spacing` | 683 | 20,209 | 20,209 | | |
| `style/trailing-whitespace` | 2,365 | 80,413 | 116,714 | 722 | 4,794 |
| `style/blank-lines` | 2,749 | 28,394 | 71,876 | 375 | 785 |
| `style/block-layout` | 4,073 | 453,593 | 1,186,126 | | |
| `style/line-endings` | 1,551 | 1,551 | 1,706,059 | 11,793 | 11,793 |
| `style/byte-order-mark` | 645 | 645 | 645 | 0 | 0 |

**Speed.** Timed on the machine of the record (16 logical CPUs, one process), under the shared
lock: formatting the whole base game's 4,854 script files takes 18.6 seconds (the median of five
runs after a first of 17.5 s); its largest file,
`gfx/map/map_object_data/generated/tree_leaf_high_generator_1.txt` (13.2 MB), 0.10 seconds (0.15
s the first time). Its 12,171 localization files take about 4 seconds.

**On the five test mods.** The same round trip, run but not committed, over every file the index
reads: 2,206 script files and 1,497 localization files, every one formatted (none has a parse
error), every tree and reading the same, every second format unchanged, 149,240 and 17,515
comments kept and none moved; the formatter changes 2,154 and 1,391 of them.

## On-type formatting

On-type formatting (item 8.5) applies the rules to the line being typed, and to nothing else,
after three keys in a script file:

- **Enter.** The line the cursor moves to is indented by rule 1: one tab for each block that
  encloses its first token, or, on a line still empty, each block open before it. The line it
  leaves loses its trailing spaces and tabs, and is emptied if it holds nothing else.
- **`}`, typed as the first thing on its line.** That line is indented as the line that holds
  its `{`.
- **`=`, completing any of the eight operators after a key on the same line.** One space before
  the operator, and one after it when something follows on the line.

It never acts inside quoted text or a comment, never changes another line, and never joins or
splits a line (a layout of rule 4 is Format Document's). It works on text with errors: the depth
of a line comes from the braces before it, as the lexer reads them; where that depth cannot be
known (a `}` before the line closes no block), it changes nothing. Localization files get none: a
line typed there may become a header, which has no indentation, or an entry, which has one space.

**Agreement with the formatter, as item 8.5 tests it.** For every golden file's output: typing it
key by key (each line's content after Enter, and Enter, `}` and `=` answered as the editor would)
ends in the formatter's text, byte for byte; deleting the line break and indentation before any
line that holds something and pressing Enter in their place gives the formatter's indentation;
deleting the indentation before a `}` that starts a line and typing the `}` again does the same;
deleting the spaces around a pair's operator and its last `=` and typing the `=` again gives the
formatter's spacing.

**Format Selection** applies the rules to the selected lines only, from the whole file's
formatting: an edit within a selected line is taken; an edit across a line break is taken whole
when the lines on both of its sides are selected, otherwise only its part on a selected line (the
spaces and tabs it removes at the end of its first line, or the indentation it gives its last). A
file with a parse error is left as it is.

## What 2.3.0 did, measured

Release 2.3.0's formatter (`legacy/vscode-extension/src/server/lsp/formatting.ts`) reprinted the
file from its tree. It was bundled outside the repository and run over the 4,854 base-game
script files, and its output read back with the rebuild's parser. The 3 files with a parse error
were skipped; on 9 files it threw an exception; it formatted the other 4,842.

| Result | Files |
| --- | --- |
| The tree read back differs from the tree of the original | 3,203 (66%) |
| The output does not parse without errors | 540 |
| The comments differ | 140 |

What it changed or lost, counted as tokens in the original that are not in the output:

| What | Times | Files |
| --- | --- | --- |
| Quoted text whose quotes were removed | 540,483 | 2,277 |
| `?=` written as `=` | 41,671 | 1,459 |
| Numbers rewritten (`1.50` as `1.5`, `007` as `7`) | 30,463 | 777 |
| Comments lost | 3,301 | 137 |
| `scripted_trigger` and `scripted_effect` before a key dropped | 4,615 | 349 and 254 |
| `list` before quoted text dropped | 2,397 | 3 |
| `hsv` and `rgb` before a block dropped | 1,144 | 42 and 6 |
| `>=`, `<=`, `>` and `<` before a block written as `=` | 223 | up to 114 |
| `@[ ... ]` with a space inside written as quoted text | 1,132 different expressions | |

On a hand-written file it also moved every comment at the end of a line to a line of its own,
turned a comment inside a list into quoted text, dropped a value standing among pairs, wrote a
block without a key as ` = { ... }`, lost the escapes of `"he said \"hi\""`, removed every blank
line, padded the longest key with two spaces when aligning, split `{}` over two lines, and wrote
no line break at the end of the file. None of this was caught because 2.3.0 had no golden files
and no written rules. The rules above keep its tab indentation, its one space around operators
and its breaking of blocks of pairs, and depart from it everywhere it changed what the file
says.

## Is there a community convention?

Beyond one tab per block, no: nothing written by Paradox or the community states one for spacing,
alignment, one-line blocks, lists or blank lines. Paradox's 214 `.info` files of the game folder
and the one in `jomini/` state no formatting convention (searched on 2026-11-23) and are written
with tabs. The CK3 wiki, read only as a search engine quotes it (it refuses automated reading),
says on its [Scripting](https://ck3.paradoxwikis.com/Scripting) page that indentation does not
matter to the game but each block should be indented one more tab for readability, and on its
[Localization](https://ck3.paradoxwikis.com/Localization) page that localization files must be
saved as UTF-8 with the byte-order mark. Two community formatters exist, neither a convention:
`prettier-plugin-pdx-script` (MIT, 0.1.0-rc.6) indents with a tab per block, writes empty blocks
as `{}` and breaks every block value over several lines; the `paradox-highlight` VS Code
extension (MIT) re-indents line by line by brace depth. Nothing is taken from either
([references](references/README.md#the-rule)).

## What was decided

The record of the decisions, in [decisions.md](decisions.md#log).

**The first sign-off (2026-11-23, decisions 90 to 100).** The owner answered the eleven
decisions this page proposed: (1) indentation with tabs, one per enclosing block, no setting;
(2) no `=` alignment, one space each side; (3) a line width of 120 columns, differing from the
proposal: a block written on one line stays on one line unless its line is longer than 120
columns, then it is split, and the formatter never joins lines; (4) lists follow the same
120-column rule and nothing else; (5) at most one blank line, none after `{`, before `}`, or at
the start or end, none added; (6) exactly one space before an end-of-line comment; (7) each file
keeps the line ending it uses most, `\r\n` for a file with none, and ends with exactly one line
break; (8) a file with a parse error is left untouched, and the formatter says why; (9)
localization files: whitespace only, never the text; (10) no setting changes a rule; (11)
on-type formatting after Enter, `}` and `=`. Everything else stood as proposed: every token keeps
its text, comments are never lost or reordered, the byte-order mark is kept as the file has it,
no trailing whitespace.

**The new principle and the rules that replace (2026-11-23, decisions 101 to 103).** The owner
then set a new principle: best practice and cleanliness take precedence over anything a mod
author did; a poorly laid out, unformatted mod is fixed by the formatter and flagged as issues.
Under it:

- **Layout (decision 102, replacing decisions 92 and 93):** the formatter decides, and joins
  lines as well as splitting them; a block holding one simple pair, and a list of plain values,
  go on one line when the line fits in 120 columns; every other block is broken (rule 4).
- **File form (decision 102, replacing decision 96 and the proposal's "the byte-order mark kept
  as the file has it"):** Windows line breaks and the UTF-8 byte-order mark in every file, the
  game's own form; exactly one line break at the end (rules 10 and 11).
- **Unchanged (decisions 90, 91, 94, 95, 97 to 100):** tabs; no alignment; at most one blank line;
  one space before an end-of-line comment; no trailing whitespace; every token keeps its text; a
  file with a parse error left untouched with the reason; localization whitespace only; no
  setting; on-type formatting after Enter, `}` and `=`.
- **Flagging (decision 103):** the `style/` family, a warning for each file not in the format and
  a hint at each untidy place, each with a safe fix ([Style findings](#style-findings)).
- The round trip now also proves that no comment changes its place among the tokens around it,
  and, because the base game is not in the format, says how many files and lines the formatter
  changes, by rule.
