# style-not-utf8-bad

The fixture pair of `style/not-utf8` (the family `style`, pychivalry's own best-practice rules),
with `style-not-utf8-good`, from which it differs only in the encoding of one letter and the
scripted effect's byte-order mark. Two files that are not valid UTF-8, each holding `é` as the
single Windows-1252 byte 0xE9:

- a scripted effect without a byte-order mark, the byte twice, in comments;
- a localization file with the byte-order mark, the byte once, in quoted text.

Their bytes are exact, so `.gitattributes` marks them `-text` and git never converts them.

A correct tool reports, at the first such byte of each file, the warning `style/not-utf8`, which
says how the file was read (as UTF-8 with replacement characters, or with the Windows-1252
fallback), with a safe fix that writes the file as UTF-8 with a byte-order mark, the byte read as
`é`. It is the one finding about each file's encoding: the parser's information note
`encoding/not-utf8`, which stood beside it on the scripted effect until 2026-11-23, is retired.
`expected.json` holds those findings. The formatter also reports the scripted effect's missing
byte-order mark; its lines are otherwise in the format, so after `check --fix` each file is the
good fixture's, which the formatter leaves as it is.
