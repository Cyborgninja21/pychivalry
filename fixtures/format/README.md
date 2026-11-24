# Golden files of the formatter

The golden files of build step 8, item 8.4 ([docs/formatting.md](../../docs/formatting.md)):
each rule has a pair, `<name>.before.<ext>`, written by hand to break the rule, and
`<name>.after.<ext>`, what the formatter must make of it, byte for byte. The test
(`packages/core/src/format/golden.test.ts`) formats every `before` and compares it with its
`after`, formats the `after` again and expects no change, compares the trees (or, for a
localization file, what the reader reads) and the comments, and types every script `after` key
by key, and Enter, `}` and `=` again at every place, to prove that on-type formatting agrees with
the formatter (item 8.5). The files' bytes are exact on every platform (`.gitattributes`): line
breaks and the byte-order mark are what several of them test. Every `after` starts with the
byte-order mark and has `\r\n` line breaks, the format's file form, but those the formatter
leaves as they are.

| Pair | What it shows |
| --- | --- |
| `indentation` | Spaces and stray indentation become one tab per enclosing block (rule 1) |
| `spaces` | One space between two tokens on a line: around every operator, `?=` and `!=` among them, inside the braces of a block on one line, before a name's block (`hsv {`), before a comment at the end of a line; `{}` for an empty block (rule 2) |
| `no-alignment` | Operators lined up in a column lose their padding (rule 3) |
| `layout-join` | A block of one simple pair, a list of plain values and an empty block written over several lines are joined onto one line; a pair's `=` and `{` on two lines are joined (rule 4) |
| `layout-break` | Every other block is broken, one item a line: two pairs, a pair with a block, values mixed with pairs, blocks without a key; a name before its block stays (`rgb { ... }`) (rule 4) |
| `width` | A list or a block of one simple pair whose line passes 120 columns is broken; what has nothing to break stays: a long value, quoted text, `@[ ... ]` (rule 4) |
| `comments` | Comments kept in their places: at the end of a line, one space after the code; on a line of their own, indented like code; commented-out script kept as written after its `#`; a comment inside a pair; a block with a comment is broken (rule 8) |
| `values-as-written` | Every token keeps its text: quotes, numbers, dates, escapes, `@[ ... ]`, `$PARAM$`, `?=`, a name before a key, an operator as a value (rule 6) |
| `blank-lines` | At most one blank line between two items; none after `{`, before `}`, or at either end of the file (rule 7) |
| `trailing-whitespace` | Spaces and tabs at the end of a line, of a comment and on a blank line are removed (rule 9) |
| `line-endings` | `\n`, `\r\n` and a lone `\r` all become `\r\n` (rule 10) |
| `multiline-text` | A line break inside quoted text is part of its text and kept as it is; the block holding it is broken (rules 4 and 10) |
| `final-newline` | A file with no line break at its end gets one (rule 10) |
| `final-newlines` | A file with blank lines at its end keeps one line break (rules 7 and 10) |
| `byte-order-mark` | A file without the UTF-8 byte-order mark gets it (rule 11) |
| `empty` | An empty file stays empty, without a mark (rule 11) |
| `only-blank-lines` | A file of blank lines becomes empty (rules 7 and 11) |
| `parse-error` | A file with a parse error is left as it is, byte for byte (rule 12) |
| `unterminated-string` | A file with quoted text that is never closed is left as it is (rule 12) |
| `localization` | A localization file: entries and comments indented with one space, one space between a key and its text, the text, a header, a line the reader does not read and an entry never closed kept as written (rule 13) |
| `localization-no-mark` | A localization file without the byte-order mark gets it (rules 11 and 13) |
