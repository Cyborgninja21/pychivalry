# style-localization-key-characters-bad

The fixture pair of `style/localization-key-characters` (the family `style`, pychivalry's own
best-practice rules; release 2.3.0's LOC-001), with `style-localization-key-characters-good`,
from which it differs only in two keys. A localization file of three entries, each shown by a
scripted effect's `custom_tooltip`, so that no key is unused:

- `fixture_key_with-dash`, whose words are joined by a dash;
- `1fixture_leading_digit`, which starts with a digit;
- `fixture_good_key.tooltip`, letters, digits, underscores and a dot: right.

A correct tool reports two hints, one at each of the first two keys, with no fix (renaming a key
means renaming every use of it). `expected.json` holds the findings. Its files are in
pychivalry's format (Windows line breaks, the byte-order mark; `.gitattributes` keeps their
bytes exact): the formatter finds nothing here.
