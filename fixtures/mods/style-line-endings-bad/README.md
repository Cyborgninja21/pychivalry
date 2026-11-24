# style-line-endings-bad

The fixture pair of `style/line-endings`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-line-endings-good`,
from which it differs only in the defect. A script file with `\n` line breaks, and a localization file with no line break at its end; both are otherwise in the format.

A correct tool reports `style/line-endings` once for each file, the script file's at its first line break saying how many line breaks are not `\r\n`, the localization file's at its end, and the warning `style/not-formatted` once for each file. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
