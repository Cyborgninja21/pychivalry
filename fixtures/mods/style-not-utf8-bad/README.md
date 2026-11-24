# style-not-utf8-bad

The fixture pair of `style/not-utf8` (the family `style`, pychivalry's own best-practice rules),
with `style-not-utf8-good`, from which it differs only in the encoding of one letter and the
scripted effect's byte-order mark. Two files that are not valid UTF-8, each holding `é` as the
single Windows-1252 byte 0xE9:

- a scripted effect without a byte-order mark, the byte twice, in comments;
- a localization file with the byte-order mark, the byte once, in quoted text.

Their bytes are exact, so `.gitattributes` marks them `-text` and git never converts them.

A correct tool reports, at the first such byte of each file, the warning `style/not-utf8`, with
a safe fix that writes the file as UTF-8 with a byte-order mark, the byte read as `é`; and on the
scripted effect also the parser's information note `encoding/not-utf8`, which says how the file
was read (a localization file has no such note). `expected.json` holds those findings. The
formatter also reports the scripted effect's missing byte-order mark; its lines are otherwise
in the format, so after `check --fix` each file is the good fixture's, which the formatter
leaves as it is.
