# encoding-windows-1252

A title history file that is not valid UTF-8: it holds four bytes in Windows-1252 (`é`,
0xE9), three in comments and one in quoted text, the way 25 of the base game's
`history/titles` files hold Windows-1252 bytes in their comments (docs/encoding.md).

Its bytes are exact, so `.gitattributes` marks it `-text` and git never converts it.

What a correct tool reports, as decided on 2026-11-21 (docs/decisions.md) and changed on
2026-11-23 (one finding for a file not UTF-8):

- Read as UTF-8 (the default): the whole file parses with no parse finding; each of the four
  bytes is U+FFFD, the replacement character; one warning, `style/not-utf8`, says the file is
  not valid UTF-8 and was read as UTF-8 with replacement characters, at the first of them
  (line 3), with a safe fix that converts the file to UTF-8 with the byte-order mark.
- With the Windows-1252 fallback: the same tree, with `é` in place of each U+FFFD, and the
  same warning, saying the file's invalid bytes were read as Windows-1252.

Until 2026-11-23 an information note, `encoding/not-utf8`, stood beside the warning; that code
is retired (docs/checks.md, "Retired codes"). The file is not in pychivalry's format in another
way too: it has no byte-order mark, which the formatter reports; it is kept byte for byte, as
what it exists to test.
