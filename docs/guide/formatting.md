# Formatting

pychivalry formats CK3 script and localization files one way, for everyone: the rules of
[the formatting rules](../formatting.md), decided by the owner. Best practice and cleanliness
come before the layout a mod's author chose: a file that is not in the format is formatted, and
flagged, wherever pychivalry looks at it. Nothing in your script changes but its whitespace:
every word, number, quoted text, operator and comment stays as you wrote it, in its place.

## What the format is

- One tab for each enclosing block; no spaces at the start of a line.
- One space between two tokens on a line (`limit = { is_adult = yes }`), `{}` for an empty
  block, one space before a comment at the end of a line; no `=` lined up in columns; no spaces
  or tabs at the end of a line.
- A block holding one simple pair (`limit = { is_adult = yes }`), a list of plain values
  (`flags = { a b c }`) and an empty block go on one line when the line fits in 120 columns
  (a tab counts 4). Every other block is broken: `{` ends its line, one item a line, `}` on its
  own line. A block holding a comment is always broken, so no comment moves.
- At most one blank line between two items; none after `{`, before `}`, or at either end.
- Windows line breaks (`\r\n`) and the UTF-8 byte-order mark in every file, the game's own form,
  and exactly one line break at the end.
- Localization files: entries and comments indented with one space, one space between a key and
  its text, and the same line breaks and mark. The text is never touched.
- A file with a parse error is left exactly as it is, and pychivalry says why: fix the error
  first. So is a file that is not valid UTF-8, by the command line and the agent server.

## In VS Code

- **Format Document** (Shift+Alt+F) formats the file; **Format Selection** formats the lines you
  selected. To format every time you save, turn on VS Code's `editor.formatOnSave` for the
  `ck3` and `ck3-localization` languages.
- **On-type formatting**, when VS Code's `editor.formatOnType` is on (it is off by default):
  after Enter the new line is indented for the blocks open before it, after a `}` typed first on
  its line the line is indented as the line of its `{`, and after an `=` the operator gets one
  space each side.
- **Findings.** A file not in the format shows the warning `style/not-formatted`, and a hint at
  each place that differs (`style/indentation`, `style/spacing`, `style/block-layout` and the
  others, [Checks](checks.md#style)). Each has a quick fix; the warning's formats the whole file,
  and Source Action > Fix All applies it with every other safe fix.
- **Line breaks and the byte-order mark** are properties of a document in VS Code, not text. The
  extension sets `\r\n` and "UTF-8 with BOM" as the defaults for CK3 files
  ([Settings](settings.md)), so saving writes the mark; Format Document turns a file's `\n` line
  breaks to `\r\n`.

## On the command line

```sh
pychivalry format .                 # format every script and localization file of the mod
pychivalry format events/my.txt     # one file
pychivalry format --check .         # write nothing; exit 1 when a file would change
pychivalry format --diff .          # write nothing; show what would change
```

It formats the files `check` reads: the `.txt` files of the folders the game reads as script,
and the `.yml` files under `localization/`; never a file outside the mod (`--mod <folder>` names
the mod when it is not the folder holding `descriptor.mod`), never one with a parse error. See
[Commands](commands.md#the-command-line).

`pychivalry check --fix` applies the safe fixes of the findings, the `style/` ones with them, so
it formats the files that are not in the format too.

## For an AI agent

The agent server's `format` tool returns a file's formatted text as a proposal, a page at a time;
it writes nothing ([The agent server](agent-server.md#the-tools)). `check` reports the `style/`
findings with the others.
