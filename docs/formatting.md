# The formatting rules

**Status: a proposal for the owner's sign-off** (build step 8, item 8.1 of
[PLAN.md](PLAN.md#step-8-formatter-and-fixes)). Nothing here is built. The formatter (item 8.2),
its round-trip suite (8.3), its golden files (8.4) and on-type formatting (8.5) are built from
these rules once they are signed off. The decisions asked are listed at the end, under
[For the owner to sign off](#for-the-owner-to-sign-off), each with its proposal and the
alternative.

**Where the counts come from.** Every count was measured on game 1.21.0.3 on 2026-11-23, over
the 4,854 script files `task game:parse` reads
([encoding.md](encoding.md#the-base-game-folders-the-parser-reads)) and the game's 12,171
localization files, with the step 2 lexer and parser (`packages/core/src/syntax/`) and
measuring scripts that are not committed. Columns are counted with a tab as 4. Release 2.3.0's
formatter was run over the same script files, bundled from `legacy/` outside the repository, to
see what it does; its result is under [What 2.3.0 did](#what-230-did-measured). The game was
never started.

**Examples.** Each "before" and "after" below is written by hand, and each pair is a seed for
item 8.4's golden files. In the "after" blocks every indentation is a tab character.

## The rules in short

| # | Rule | The base game | 2.3.0 |
| --- | --- | --- | --- |
| 1 | Indent with tabs, one per enclosing block | 97.5% of indented lines | Same (tabs by default) |
| 2 | Exactly one space between two tokens on a line; `{}` for an empty one-line block | The majority for every pair of tokens but one | One space around operators |
| 3 | No `=` alignment | 577,003 unaligned runs, 57 aligned | Aligned |
| 4 | A block written on one line stays on one line, one written over several stays over several; in a block over several lines each pair starts a line; no width limit | Both ways: one-pair blocks 41% on one line | Every block of pairs broken |
| 5 | Lists keep the lines their values were written on | 6% of lists break 2.3.0's rule | Five or fewer on one line, else one per line |
| 6 | Every token keeps its text: quotes, numbers, `@[ ... ]`, `$PARAM$` | Not a measure: the tree demands it | Changed quotes, numbers, `?=`, `@[ ]` |
| 7 | A run of blank lines becomes one; none after `{`, before `}`, at the start or end; none added | 97.6% of runs are one line | Removed every blank line |
| 8 | Every comment kept with its text, in its place; trailing ones stay trailing; own-line ones indented like code | 97.4% of own-line comments at depth | Moved, lost or turned into text |
| 9 | No trailing spaces or tabs | 3,054 of 4,854 files have none | Same |
| 10 | Line breaks of the kind the file uses most; one line break at the end | CRLF 77% of files; one final break 71% | `\n`, no final break |
| 11 | The byte-order mark kept as the file has it | 4,209 with, 645 without | Kept (by the editor) |
| 12 | A file with a parse error is left untouched | 3 files | Formatted it anyway |
| 13 | Localization files: whitespace only, never the text | 99.7% of entries indented one space | Not formatted |

## How the formatter works

The formatter reads a file's text and its tree. The tree gives the structure: which tokens are
keys, operators, values and comments, and which block holds each. The text gives what the tree
does not: where the author broke lines and where blank lines stand. Every node of the tree has
its offsets into the text, so both are known for every token.

**What it may change.** Only the whitespace between tokens: spaces, tabs and line breaks,
outside quoted text. Every token keeps its exact text, so the same tokens come out in the same
order (see [What the formatter guarantees](#what-the-formatter-guarantees)). A comment is a
token whose text runs from `#` to the end of its line; only the spaces and tabs at its end may
go.

**Words used below.**

- A **block written on one line** is a block whose `{` and `}` stand on the same line of the
  input. Any other block is **written over several lines**.
- A token's **depth** is the number of blocks that enclose it between their braces. A block's
  own `{` and `}` are not inside it, so a `}` has the depth of the line that holds its `{`.
- An **item** is what the file or a block holds: a pair, a bare value, a block without a key,
  or a comment (the tree's `Item`).
- A **list** is a block that holds only values, `{ a b c }` (the tree's `blockShape` is `list`).
  A **bare value** is a value standing alone in a block, as in a list.

## The rules

### 1. Indentation

**Rule.** A line starts with one tab for each block that encloses its first token, and with
nothing else: no spaces. A line that starts with `}` therefore gets the indentation of the line
that holds its `{`. A line that starts inside quoted text written over several lines is left
exactly as it is, since its spaces are part of the text. A blank line holds nothing (rule 7).

Before:

```
my_event.1 = {
    type = character_event
  immediate = {
      add_gold = 10
        }
}
```

After:

```
my_event.1 = {
	type = character_event
	immediate = {
		add_gold = 10
	}
}
```

**Evidence.**

| Files indented with | Files |
| --- | --- |
| Tabs only | 3,524 |
| Spaces only | 36 |
| Both | 1,211 |
| No indented line | 83 |

Of the 6,668,210 indented lines, 6,498,822 (97.5%) are indented with tabs only, 73,196 with
spaces only and 96,192 with both (a space before the tabs 64,161 times, tabs and spaces
interleaved 26,329, tabs then spaces 5,702). Of the 6,986,091 lines that start with code (not a
comment), 6,773,028 (96.9%) are already indented with exactly one tab per depth, and in 3,415
files every such line is. Paradox's own documentation files are written the same way: 186 of the
214 `.info` files are indented with tabs only, 4 with spaces only.

**Where the base game is inconsistent.** Most of the 1,211 files with both are tab files with
stray lines: in 453 of them at least 99% of indented lines are tabs, in 211 more at least 90%.
In 465 files fewer than half are; 358 of those are in `common/bookmark_portraits/`, a folder
whose files (358 of its 360) say in their first line that a console command generated them and
that they are not to be edited by hand.

**2.3.0:** tabs by default, spaces with its `insertSpaces` and `tabSize` settings. The same
default; whether to keep a setting is [Settings](#settings).

A tab has no width in the file: an editor shows it at the user's own tab size.

### 2. Spaces between tokens

**Rule.** Two tokens on the same line are separated by exactly one space. The one exception is
an empty block written on one line, which is `{}`. The rule covers:

- each of the eight operators, and a `$PARAM$` written in an operator's place:
  `key = value`, `age >= 16`, `scope:x ?= { ... }`, `count $OPERATOR$ 3`;
- the inside of the braces of a block written on one line: `{ is_adult = yes }`;
- values next to each other: `{ 1 2 3 }`;
- a name before a block or quoted text: `rgb { 255 0 0 }`, `list "my_list"`;
- a name before a key: `scripted_trigger my_trigger = { ... }`;
- a `}` and what follows it on the line;
- the code before a comment at the end of its line: `add_gold = 10 # reward`.

There is never a space at the start of a line beyond its indentation (rule 1) nor at its end
(rule 9).

Before:

```
limit={is_adult=yes}
age>=16
color = hsv{ 0.5  0.5 0.5 }
add_gold = 10			# reward
empty_effect = { }
```

After:

```
limit = { is_adult = yes }
age >= 16
color = hsv { 0.5 0.5 0.5 }
add_gold = 10 # reward
empty_effect = {}
```

**Evidence.** Every gap between two tokens on one line, by what stands on either side:

| Between | Gaps | One space | None | More, or tabs |
| --- | --- | --- | --- | --- |
| A value and an operator | 5,423,927 | 4,813,634 | 606,356 | 3,937 |
| An operator and a value | 2,990,052 | 2,803,000 | 181,281 | 5,771 |
| An operator and `{` | 2,427,861 | 2,008,974 | 418,383 | 504 |
| Two values | 1,284,332 | 1,260,414 | 18 | 23,900 |
| `{` and a value | 806,267 | 802,026 | 459 | 3,782 |
| A value and `}` | 781,926 | 773,630 | 965 | 7,331 |
| Code and a comment at the end of the line | 237,482 | 217,270 | 440 | 19,772 |
| `}` and `}` | 28,530 | 15,556 | 132 | 12,842 |
| `}` and a value | 12,283 | 10,614 | 10 | 1,659 |
| `{` and `}`, an empty block | 9,484 | 357 | 9,100 | 27 |
| A name and its `{` (`rgb {`) | 2,783 | 601 | 1,969 | 213 |
| `{` and `{` | 635 | 634 | 0 | 1 |
| `}` and `{` | 228 | 228 | 0 | 0 |

By operator: the seven comparison operators (`==`, `!=`, `?=`, `<`, `>`, `<=`, `>=`) have one
space on each side 101,524 times of 101,610. `=` has one space on each side 4,705,435 times of
5,322,332 and none on either side 599,389 times, 534,233 of them in four folders of data rather
than script: `gfx/map` 383,419, `common/dna_data` 51,069,
`common/bookmark_portraits` 50,223 and `gfx/court_scene` 49,522. By file, 4,324 files space `=`
in most places (3,612 everywhere) and 496 in fewer than half (422 nowhere, 359 of them the
generated portrait files).

**Where the base game is inconsistent, and the proposal.**

- **A name and its block.** Most are written without the space (1,969 against 601), but the
  no-space side is almost all graphics data in `gfx/` (`cylindrical{ ... }`, `hsv{ ... }`):
  1,973 of the 2,045 colour and camera tags written without the space are there. In `common/`,
  where a mod writes its colours, a tag such as `rgb {` or `hsv {` is written with the space 165
  times and without it 72. Proposal: one space, like every other gap.
- **`}` and `}`.** One space 15,556 times, two or more 12,842. Proposal: one space.
- **Before a comment at the end of a line.** One space 217,270 times (91.5%), tabs 18,244 times
  in 488 files, most of them in `history/` (12,054). Proposal: one space; keeping the gap as
  written is the alternative, asked at the end.

**2.3.0:** one space around operators; empty blocks written over two lines; and, when aligning,
two spaces before the `=` of the longest key (`namespace  = my_mod`).

### 3. No `=` alignment

**Rule.** No padding before an operator. Operators are never lined up in columns.

Before:

```
type            = character_event
title           = my_event.1.t
theme           = friendly
```

After:

```
type = character_event
title = my_event.1.t
theme = friendly
```

**Evidence.** A run is two or more pairs on consecutive lines of one block, each written on one
line of its own. Of the runs whose keys differ in length, so that alignment would show:

| Written with | Runs | Pairs | Files |
| --- | --- | --- | --- |
| One space before each operator | 577,003 | 1,791,909 | 3,923 |
| Aligned in a column | 57 | 383 | 20 |
| No space before the operator | 113,647 | 547,534 | generated data |
| Mixed | 5,434 | 18,258 | |

The 20 files with aligned runs are, among others, two coat-of-arms template lists, the named
colours, the graphics defines and eight event files; 33 of the 57 runs are aligned with tabs, 24
with spaces. Another
70,202 runs have keys of one length and say nothing either way.

**2.3.0 differs:** it aligned `=` in every block, not as a setting. **Proposal: the base game
wins, with no setting.** Besides the count: adding one longer key re-pads every line of its
block, so a one-line change shows as many in a diff; on-type formatting cannot align as the
user types, and the two must agree ([On-type formatting](#on-type-formatting)); and a column
lined up with tabs depends on a tab width the file does not hold.

### 4. Line breaks: one line or several

**Rules.**

1. **A block written on one line stays on one line**, however long. The formatter never breaks
   a line because it is long.
2. **A block written over several lines stays over several lines.** Its `{` is the last thing
   on its line but for a comment, and its `}` is the first thing on its line.
3. **In a block written over several lines, and at the top level of the file, every pair and
   every block without a key starts a line of its own.**
4. **A bare value stays on the line it was written on**, after what precedes it there: a line
   break before a bare value is kept, and none is added (rule 5). The one exception is a value
   written on the line of the `{` of a block over several lines, which moves to the next line
   (rule 4.2).
5. **A pair stays on its key's line.** A line break between a pair's key, its operator and the
   first token of its value is removed: `key =` at the end of a line with `{` on the next
   becomes `key = {`. The one exception is a comment written inside the pair (rule 8).
6. **Nothing else moves to another line.** The formatter joins no other lines, and never splits
   a comment from the code it follows (rule 8).

Before:

```
reward = { add_gold = 5 }
trigger = { age >= 16 is_adult = yes }
option = { name = my_event.1.a
	add_prestige = 50 }
immediate =
{
	add_gold = 10   remove_trait = shy
}
```

After:

```
reward = { add_gold = 5 }
trigger = { age >= 16 is_adult = yes }
option = {
	name = my_event.1.a
	add_prestige = 50
}
immediate = {
	add_gold = 10
	remove_trait = shy
}
```

**Evidence: one line or several.** Blocks of pairs (and values), by what they hold:

| Block holds | Items | On one line | Over several | Share on one line |
| --- | --- | --- | --- | --- |
| No nested block | 1 | 261,227 | 379,125 | 40.8% |
| | 2 | 28,794 | 212,404 | 11.9% |
| | 3 | 4,164 | 65,598 | 6.0% |
| | 4 or more | 174 | 38,302 | 0.5% |
| A nested block | 1 | 13,613 | 211,132 | 6.1% |
| | 2 | 14,457 | 306,599 | 4.5% |
| | 3 | 1,573 | 119,996 | 1.3% |
| | 4 or more | 147 | 352,972 | 0.04% |
| Nothing (empty) | 0 | 9,484 | 16,424 | 36.6% |

**Where the base game is inconsistent.** A block of one pair is written on one line 40.8% of
the time: 54% in `common/`, 61% in `events/`, 21% in `history/`. 2,308 files write such blocks
both ways, 265 only on one line and 993 only over several. There is no rule to follow here but
the author's choice, so the formatter keeps it. Of the 16,424 empty blocks over several lines,
984 hold only comments.

**Evidence: width.** 26,567 of the 7,798,421 lines that hold anything are wider than 120
columns, and 1,672 files have at least one. The blocks on one line that sit on such a line:
9,528 of the 294,359 without a nested block (3.2%), 3,065 of the 29,790 with one (10.3%), and
2,022 of the 481,599 lists. A width limit would break these, so none is proposed.

**Evidence: the layout around braces.** The `{` of a pair's block is on the key's line
2,427,861 times and on the next line 6,006 times, for example in `common/effect_localization`,
`common/trigger_localization`, `common/defines` and `common/game_concepts`. In a block over several
lines, the `{` is followed on its line by nothing 1,677,301 times, by a comment 56,920 times and
by an item 1,154 times; the `}` comes after other code on its line 4,619 times of 1,735,375; and
after the `}` come a comment 417 times, another `}` 40 times and an item 10 times. A line of a
block over several lines holds two or more items 474 times, in 94 of the 1,686,129 such blocks;
at the top level never. A pair is split over lines between its key and its operator 5 times and
between its operator and a value that is not a block 3 times.

**2.3.0 differs:** it wrote every block of pairs over several lines and every empty block as
`{` and `}` on two lines, which changes the 324,149 blocks of pairs the base game writes on one
line. **Proposal: the author's choice wins**, because the base game makes it both ways in the
same files. The alternatives, asked at the end, are 2.3.0's reprint and a width limit.

### 5. Lists

**Rule.** A list keeps the lines its values were written on. On one line, it stays on one line
(rule 4.1): `{ a b c }`, however many values. Over several lines, its `{` ends its line and its
`}` starts one (rule 4.2); each line of values in between is indented one level deeper than the
line of the `{`, with one space between the values on it. The formatter never re-wraps a list:
there is no limit on values per line, and none on width.

Before:

```
flags = { a b c d e f g }
weights = { 1 2 3 4 5
            6 7 8 9 10 }
single = {
    only_one
}
```

After:

```
flags = { a b c d e f g }
weights = {
	1 2 3 4 5
	6 7 8 9 10
}
single = {
	only_one
}
```

**Evidence.** 514,422 lists:

| List | On one line | Over several, one value a line | Over several, several a line |
| --- | --- | --- | --- |
| Five values or fewer | 480,365 | 23,526 | 3,331 |
| Six or more | 1,234 | 3,327 | 2,639 |

Of the 5,970 lists over several lines that hold several values a line, the longest line holds
exactly 5 values in 3,069 of them and exactly 10 in 1,526. Of the lists on one line, 27 hold
more than 100 values. A list of one value is written over several lines 14,122 times and on one
line 15,163 times.

**2.3.0 differs:** it put a list of five values or fewer on one line and a longer one a value a
line. The base game breaks that rule in 30,730 of its 514,422 lists (6%): 26,857 short lists
over several lines, 1,234 long lists on one line and 2,639 long lists packed several values a
line. **Proposal: the base game wins**: the author's lines are kept; 2.3.0's five-value rule is
the alternative, asked at the end.

### 6. Values are written as they are

**Rule.** Every token keeps its exact text.

- Quotes are never added or removed, and the escapes `\"` and `\\` inside quoted text are kept.
  `"yes"` stays quoted and `yes` stays bare, whatever the game makes of either.
- A number keeps its spelling: `1.50`, `007`, `+5` and `.5` stay as written; so do dates.
- `@[ ... ]` is one token, and its inside is never touched: neither its spaces nor its
  brackets.
- A `$PARAM$`, and a word that holds one (`scope:$TARGET$`, `has_trait = $TRAIT$`), is a word
  like any other: its text is kept, and it is spaced as the key, value or operator it stands
  for (rule 2).
- An `@name` constant, a scope chain, a name before a key (`scripted_trigger`) or before a block
  or quoted text (`rgb`, `hsv`, `list`) keeps its text.
- A `?=`, `!=` or any other operator stays the operator it is.

The formatter changes only whitespace (rule 2 and the rest), so this rule is what makes the
tree come out the same: the tree records quoted text as a string and a bare word by its shape
(`Scalar.type`), so adding or removing quotes would change it. The formatter cannot know where
the game reads `"x"` and `x` alike: the base game writes 546,480 quoted texts, of which 536,888
could be written bare by their shape, and `"yes"` or `"no"` quoted 6 times beside 323,892 bare.
It holds 1,804 `@[ ... ]` in 18 files (1,795 of them with no space just inside the brackets)
and 19,770 words with a `$PARAM$` in 458 files.

These lines come out exactly as they go in:

```
title = "my_event.1.t"
cost = @[ base_cost * 1.50 ]
count $OPERATOR$ $COUNT$
scope:$TARGET$ ?= { is_alive = yes }
```

**2.3.0 differs:** it removed the quotes from quoted text without a space, wrote quoted text
with a space and every `@[ ... ]` with a space inside as quoted text, rewrote numbers (`1.50` as
`1.5`, `007` as `7`), wrote `?=` as `=`, and dropped `rgb`, `hsv`, `list` and `scripted_trigger`
(measured below). Nothing here is a choice: the guarantees require this rule.

### 7. Blank lines

**Rules.**

1. A run of blank lines between two items, comments included, is kept as one blank line.
2. Blank lines just after a `{` and just before a `}` are removed.
3. Blank lines at the start and at the end of the file are removed; the file ends with one line
   break (rule 10).
4. The formatter never adds a blank line.
5. A blank line holds nothing: no spaces or tabs.

Inside quoted text written over several lines, nothing changes.

Before:

```

my_event.1 = {

	type = character_event


	immediate = {
		add_gold = 5

	}
}
my_event.2 = {
	type = character_event
}


```

After:

```
my_event.1 = {
	type = character_event

	immediate = {
		add_gold = 5
	}
}
my_event.2 = {
	type = character_event
}
```

**Evidence.** Runs of blank lines, by where they are and how many lines they hold:

| Where | 1 | 2 | 3 | 4 or more | Files with a run of 2 or more |
| --- | --- | --- | --- | --- | --- |
| Between top-level items | 163,319 | 6,343 | 851 | 438 | 1,172 |
| Between items in a block | 298,483 | 2,887 | 575 | 30 | 709 |
| Just after `{` | 4,849 | 16 | 0 | 0 | 13 |
| Just before `}` | 13,517 | 627 | 23 | 16 | 118 |
| At the start of the file | 388 | 30 | 2 | 2 | 34 |
| At the end of the file | 734 | 50 | 10 | 15 | 75 |

Of all 493,205 runs, 481,290 (97.6%) are one line, 9,953 two lines and 1,962 three or more.
By their longest run, 183 files have no blank line, 3,037 runs of one at most, 1,118 runs of
two, 337 of three and 179 of four or more. A blank line just after a `{` or just before a `}`
is rare beside the 1.7 million blocks over several lines: 4,865 and 14,183 runs. Two top-level
blocks follow each other with no blank line between them 38,152 times, with one 127,702 times
and with two or more 4,309 times; adding blank lines would change those 38,152 places, so none
are added.

**Where the base game is inconsistent.** 1,634 files use a run of two or more somewhere, most of
them between top-level items. Proposal: one, as in 97.6% of runs; keeping
up to two is the alternative, asked at the end.

**2.3.0 differs from what it describes:** its setting allowed two blank lines, but its tree
held none, so it removed every blank line (checked by running it on the base game and on a
hand-written file).

### 8. Comments

**Rules.**

1. **Every comment is kept**, in its place in the order of the file, with its text unchanged
   from `#` to its end, but for spaces and tabs at its end (rule 9). The formatter neither
   adds a comment nor removes one, nor moves one past another token.
2. **A comment at the end of a line of code stays at the end of the line of the token it
   follows**, one space after it (rule 2). If that token moves to a new line (rule 4), the
   comment moves with it.
3. **A comment on a line of its own stays on a line of its own**, indented by rule 1 like code
   in its place: one tab for each block that encloses it. A comment just above a `}` is inside
   that block. Commented-out script is a comment like any other: everything after its `#`,
   including the indentation written there, is kept.
4. **A comment written inside a pair**, between its key and its value, ends its line, and the
   pair goes on on the next line at the key's indentation. The tree keeps such a comment after
   the pair; the formatter knows it was inside from its offsets.
5. A block that holds a comment is never written on one line, since a comment runs to the end
   of its line; so it is written over several lines (rule 4.2).

Before:

```
my_event.1 = {   # the first event
	trigger = {
# commented out:
#		is_adult = yes
		age >= 16	# adults only
	}
	after = { add_gold = 5 # paid
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
	after = {
		add_gold = 5 # paid
	}
	immediate = # a comment inside a pair
	{
		add_gold = 5
	}
}
```

**Evidence.**

| Comments | Count |
| --- | --- |
| On a line of their own | 266,274 |
| of which indented one tab per depth | 259,362 (97.4%) |
| of which at column 0 inside a block | 887 |
| of which otherwise | 6,025 |
| Of those, reading as script without an error (commented-out script) | about 16,200 |
| of which indented one tab per depth | 14,976 |
| of which at column 0 | 196 |
| At the end of a line of code | 237,482 |
| of which after `{` | 56,920 |
| of which after `}` | 35,118 |
| Inside a pair, between its key and its value | 2, in one file of `history/titles/` |

What follows the `#` is kept, whatever it is: a space 255,683 times, text 169,063, another `#`
53,715, a tab 21,623, nothing 3,672. The space before a comment at the end of a line is under
rule 2.

**2.3.0 differs:** it moved every comment at the end of a line to a line of its own, turned a
comment inside a list into quoted text (`{ 1 2 # one two` came out as `{ 1 2 "# one two" ...`),
and lost 3,301 comments in 137 base-game files.

### 9. Trailing whitespace

**Rule.** No line ends in a space or a tab: they are removed at the end of every line,
including a line that ends in a comment, and a blank line is emptied (rule 7.5). Spaces and tabs
before a line break inside quoted text written over several lines are part of its text, and are
kept.

**Evidence.** Lines with content that end in whitespace: 45,970, in 1,800 files; blank lines
holding whitespace: 41,501, in 1,810 files. 3,054 files have no line with content that ends in
whitespace. Quoted text written over several lines: 89 times, in 33 files.

**2.3.0:** the same; it reprinted every line.

### 10. Line endings and the final newline

**Rules.**

1. Every line break is written as the kind the file uses most, `\r\n` or `\n`; on a tie, and in
   a file with no line break at all, `\r\n`, the base game's majority. Line breaks inside quoted
   text are part of its text and are kept as they are. In the editor the same rule reads the
   text the editor holds, so an edit is written in the document's own line ending.
2. The file ends with exactly one line break after its last line. An empty file stays empty.

**Evidence.** Script files by line ending: `\r\n` only 3,723; `\n` only 1,086; both 34 (31 of
them mostly `\r\n`); no line break 11. Localization files differ: 11,750 of 12,171 use `\n` only
(rule 13). Script files by their end: exactly one line break after the last line 3,464; more
than one 807; none 583, 7 of them empty files.

**Where the base game is inconsistent.** Both kinds of line ending are common, so the file's own
is kept; one kind for every file would change every line of 1,086 base-game files one way, or
of 3,723 the other.

**2.3.0 differs:** it joined its lines with `\n` and wrote no line break at the end of the
file. The base game wins for the final line break.

### 11. The byte-order mark

**Rule.** Kept as the file has it: never added, never removed. In the editor, the editor keeps
the file's encoding and the formatter never sees the mark; the command line writes a file back
with the mark exactly when it read one.

**Evidence.** Script files: 4,209 with the mark, 645 without (`events/` 610 of 610, `common/`
2,663 of 3,035, `history/` 613 of 837, `gfx/` 237 of 271). Localization files: all 12,171, and
they need it: part D1 of the spec package (`msg-localization-missing-bom`) says a localization
file without it adds no keys, on Linux and on Windows. Adding a missing mark changes what the
game loads, so it is a fix, not formatting.

**2.3.0:** the same in effect; the editor kept the mark.

### 12. Files the formatter leaves as they are

- **A file with a parse error** (any finding of severity error,
  [encoding.md](encoding.md#what-the-parser-reports)) **or with quoted text that has no closing
  quote** is returned unchanged, byte for byte, and the result names the first such finding.
  The base game has 3 such files. The reason: the parser's recovery guesses the structure. A
  `}` missing deep inside one event makes every later item of the file one block deeper, and a
  stray `}` closes a block early and makes the items after it top-level items; formatting from
  either guess would re-indent dozens of lines the author never touched, and in the editor it
  would do so on every save while a block is half typed. Formatting only up to the first error
  does not avoid it: a stray `}` is reported where the parser trips over it, after the items it
  has already misplaced. That is the alternative, asked at the end.
- **`@[` without its `]`, and malformed arithmetic,** are information findings, not errors:
  the token is kept as written and the file is formatted.
- **A file that is not valid UTF-8** (26 in the base game) is left unchanged by the command line
  and the agent server, which could not write its bytes back as they were: each invalid byte
  reads as the replacement character ([encoding.md](encoding.md#the-policy)). In the editor the
  formatter formats the text the editor holds; the editor decodes and encodes the file.
- **Other files** are not formatted: GUI files (`.gui`, their own syntax, build step 10), `.info`,
  `.asset`, `.shader`, `.gfx`, `.settings`, and anything that is neither a script nor a
  localization file.

### 13. Localization files

Localization files have no tree. They are read line by line by the index's localization reader
(`packages/core/src/index/localization.ts`): a header (`l_english:`), entries
(`key:0 "text"` or `key: "text"`), comments and blank lines.

**What is formatted.**

1. An entry is indented with one space; a header with none; a comment on a line of its own with
   one space.
2. One space between the entry's `key:` (with its version number, if it has one) and the
   opening quote.
3. Trailing whitespace (rule 9), blank lines (rule 7), line endings and the final line break
   (rule 10), the byte-order mark (rule 11).

**What is never changed.** The text between the quotes, whatever it holds; the key; the version
number, which is neither added nor removed; the header; a comment's text; whatever follows the
closing quote on the line; the order of the entries; a line the reader does not read as a
header, an entry, a comment or a blank line; and an entry whose closing quote is missing. Each
of those lines is kept as written.

Before (the second entry is indented with a tab):

```
l_english:
my_event.1.t:0  "A Title"
	my_event.1.desc: "Some text"
   my_event.1.a: "Fine." # the option
```

After:

```
l_english:
 my_event.1.t:0 "A Title"
 my_event.1.desc: "Some text"
 my_event.1.a: "Fine." # the option
```

**Evidence.** The 12,171 localization files hold 3,090,111 entries. 3,080,467 (99.7%) are
indented with one space, 7,544 with none, 2,099 with two spaces and 1 with a tab; 12,038 files
use one kind of indentation throughout. One space separates the key from the text 3,090,034
times, more than one 77 times. 2,917,710 entries have no version number and 172,401 have one.
Comments on a line of their own: 72,339 indented one space, 1,471 none, 428 otherwise. Lines
ending in whitespace: 958, in 376 files; blank lines holding whitespace: 3,982, in 586 files.
Line endings: `\n` 11,750 files, `\r\n` 420, both 1. A final line break: 12,000 files; none:
171. The byte-order mark: all 12,171. Entries with a comment after the text: 114,702.

**2.3.0:** did not format localization files. Not formatting them at all is the alternative,
asked at the end.

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
no line break at the end of the file.

None of this was caught because 2.3.0 had no golden files and no written rules (PLAN.md, step
8). The rules above keep its tab indentation and its one space around operators, and depart from
it everywhere it changed what the file says, and where the base game's majority differs:
alignment, line breaks, lists, blank lines and the final line break.

## Is there a community convention?

PLAN.md asks whether a recognised formatting convention exists beyond "tabs". **Short answer:
beyond one tab per block, no**: nothing written by Paradox or the community states one for
spacing, alignment, one-line blocks, lists or blank lines. What there is, all of it a hint
([references](references/README.md#the-rule)):

- **Paradox's documentation files** (the 214 `.info` files of the game folder and the one in
  `jomini/`) state no formatting convention: all 215 were searched on 2026-11-23 for
  indentation, tabs, formatting, style, whitespace, alignment, blank lines and convention. They
  are written with tabs themselves (rule 1).
- **The CK3 wiki** refuses automated reading (a browser challenge), so its pages were read only
  as a search engine quotes them, on 2026-11-23; the wording is not verified. As quoted, the
  [Scripting](https://ck3.paradoxwikis.com/Scripting) page says indentation does not matter to
  the game, but each block should be indented one more tab for readability; the
  [Scopes](https://ck3.paradoxwikis.com/Scopes) page says indentation goes up when a block opens
  and down when it closes; the [Interface](https://ck3.paradoxwikis.com/Interface) page calls
  opening and closing a block at the same level, with its contents one tab in, the common
  style; and the [Localization](https://ck3.paradoxwikis.com/Localization) page says
  localization files must be saved as UTF-8 with the byte-order mark. All four agree with rules
  1, 4.2 and 11 and with the base game.
- **Community formatters** exist, and neither is a convention. `prettier-plugin-pdx-script`
  (MIT, version 0.1.0-rc.6 of March 2026, read from its npm registry entry) indents with a tab
  per block, writes empty blocks as `{}`, breaks every block value over several lines and keeps
  operators as written. The `paradox-highlight` VS Code extension (MIT, read from its GitHub
  repository) re-indents line by line by brace depth with the editor's own tab settings and
  trims each line. Both are noted for comparison; nothing is taken from either.

So the base game is the evidence for every rule, and the wiki agrees with it where it says
anything at all.

## What the formatter guarantees

Each is a testable statement; the suite that proves it is named.

1. **The tree is unchanged.** Parsing the output gives the tree parsing the input gives,
   compared without offsets: the same items in the same order and nesting, of the same kinds,
   with the same texts, operators and flags, and comments compared without the spaces and tabs
   at their end. Proved on every base-game file (item 8.3, part of `task game:parse`) and on
   every golden file (item 8.4).
2. **No token or comment is lost, added, reordered or changed.** Splitting the output into
   tokens gives the tokens of the input, in order, with the same kinds and texts (comments
   compared as above). Everything a token holds is therefore unchanged too: quoted text,
   numbers, `@[ ... ]` and `$PARAM$` byte for byte. Proved by the same suites.
3. **Formatting twice changes nothing.** Formatting the output again gives it back byte for
   byte. Proved on every golden file and every base-game file.
4. **A file the formatter does not format comes back byte for byte**, with the reason: a file
   with a parse error or with unclosed quoted text and, on the command line and the agent
   server, a file that is not valid UTF-8. Proved by fixtures, and on the base game's 3 files
   with a parse error.
5. **The byte-order mark and the line ending are the file's.** The output starts with the mark
   exactly when the input does, and every line break outside quoted text is of the file's kind
   (rule 10). Proved by fixtures with each.
6. **The output follows the rules line by line.** Outside quoted text: every line's indentation
   is tabs only, one per depth; no line ends in a space or a tab; no two blank lines follow
   each other, and none follows a `{` or comes before a `}`; the file ends with exactly one line
   break; every two tokens on a line are one space apart, but `{}`. Proved on every base-game
   file and golden file.
7. **Lines move only as rule 4 says.** A block written on one line is on one line in the output,
   a block written over several lines is over several; no two lines are joined but within a pair
   (rule 4.5). Proved by golden files.
8. **On-type formatting agrees with the formatter** ([On-type formatting](#on-type-formatting)).
   Proved by item 8.5's fixture keystrokes.

The 2.3.0 formatter fails the first guarantee on 3,203 base-game files.

## Settings

**Proposal: no setting changes a rule.** The plan asks for one formatting, and the base game
gives no reason for a second: it indents with tabs and does not align.

- The indentation the editor sends with each request (its `tabSize` and `insertSpaces`) is not
  used: the formatter writes tabs, and the editor shows them at the user's own tab size.
- Formatting is switched on and off by the editor's own settings, which can be set for the
  `ck3` and `ck3-localization` languages alone: `editor.formatOnSave`, `editor.formatOnType`
  (off by default in VS Code) and `editor.defaultFormatter`.
- The extension makes tabs the editor's default for the `ck3` language
  (`"[ck3]": { "editor.insertSpaces": false }`, a configuration default the user can change),
  so the editor's own Enter key indents as the formatter does.

**The alternative**, asked at the end: keep 2.3.0's four settings,
`ck3LanguageServer.formatting.enabled`, `.onTypeEnabled`, `.insertSpaces` (default `false`) and
`.tabSize` (default `4`), renamed `pychivalry.format.*`.

## On-type formatting

On-type formatting (item 8.5) applies the same rules to the line being typed, and to nothing
else. It is triggered by three characters, as in 2.3.0:

- **Enter.** The line the cursor moves to is indented by rule 1. The line it leaves loses its
  trailing spaces and tabs (rule 9), and is emptied if it holds nothing else (rule 7.5).
- **`}`, typed as the first thing on its line.** That line is indented by rule 1: as the line
  that holds its `{`.
- **`=`, completing any of the eight operators after a key.** One space before the operator,
  and one after it when something follows on the line (rule 2).

It never acts inside quoted text or a comment, never changes another line, and never joins or
splits a line. It works on text with errors, since text being typed is seldom complete: the
depth of a line comes from the braces before it, as the lexer reads them; where that depth
cannot be known (more `}` than `{` before the line), it changes nothing.

**Agreement with the formatter, as item 8.5 tests it.** For every golden file's formatted
output: deleting the line break and indentation before any line and pressing Enter in their
place gives back the formatter's indentation; deleting the indentation before a `}` that starts
a line and typing the `}` again does the same; deleting the spaces around an operator and typing
its `=` again gives the formatter's spacing. Because the formatter aligns nothing (rule 3),
there is nothing on-type formatting could not reproduce.

**Format Selection** applies the rules to the selected lines only, from the tree of the whole
file; a file with a parse error is left as it is.

## For the owner to sign off

Each decision with the proposal first and the alternative after.

1. **Indentation.** Proposal: tabs, one per block, no setting. Alternative: 2.3.0's
   `insertSpaces` and `tabSize` setting, tabs by default.
2. **`=` alignment.** Proposal: off, no setting (57 aligned runs in the base game against
   577,003). Alternative: on by default, as in 2.3.0, or a setting.
3. **One line or several.** Proposal: the author's choice is kept for every block, and there is
   no width limit (the base game writes one-pair blocks both ways, 41% on one line). Alternative:
   2.3.0's reprint, every block of pairs over several lines; or a width limit of 120 columns
   that breaks the blocks on one line beyond it.
4. **List wrapping.** Proposal: none; a list keeps the lines its values were written on.
   Alternative: 2.3.0's rule, five values or fewer on one line and a value a line beyond.
5. **Blank lines.** Proposal: a run is kept as one; none after `{`, before `}`, or at the start
   or end of the file; none is ever added. Alternative: runs of up to two kept, as 2.3.0's
   setting described.
6. **The space before a comment at the end of a line.** Proposal: exactly one, like every other
   gap (91.5% of the base game's). Alternative: kept as written, which keeps comments lined up
   in columns.
7. **Line endings.** Proposal: the kind the file uses most; `\r\n` for a file with none.
   Alternative: always `\n`, or always `\r\n`.
8. **A file with a parse error.** Proposal: left untouched, with the first error named.
   Alternative: formatted up to the top-level item that holds the first error.
9. **Localization files.** Proposal: whitespace only, never the text (rule 13). Alternative:
   not formatted at all.
10. **Settings.** Proposal: none that changes a rule; on and off by the editor's own settings.
    Alternative: 2.3.0's four settings under `pychivalry.format.*`.
11. **On-type triggers.** Proposal: Enter, `}` and `=`, as in 2.3.0. Alternative: Enter and
    `}` only.
