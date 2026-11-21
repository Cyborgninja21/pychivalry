# encoding-windows-1252

A title history file that is not valid UTF-8: it holds four bytes in Windows-1252 (`é`,
0xE9), three in comments and one in quoted text, the way 25 of the base game's
`history/titles` files hold Windows-1252 bytes in their comments (docs/encoding.md).

Its bytes are exact, so `.gitattributes` marks it `-text` and git never converts it.

What a correct tool reports, as decided on 2026-11-21 (docs/decisions.md):

- Read as UTF-8 (the default): the whole file parses with no parse finding; each of the four
  bytes is U+FFFD, the replacement character; one information note says the file is not
  valid UTF-8, at the first of them (line 3).
- With the Windows-1252 fallback: the same tree, with `é` in place of each U+FFFD, and the
  same note, saying the file's invalid bytes were read as Windows-1252.
