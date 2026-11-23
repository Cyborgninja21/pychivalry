# style-blank-lines-bad

The fixture pair of `style/blank-lines`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-blank-lines-good`,
from which it differs only in the defect. Blank lines the format does not keep: one at the start of the file, one after a `{`, one before a `}`, three between the two effects (one is kept), one at the end; and two between two localization lines (one is kept) and one at the end.

A correct tool reports `style/blank-lines` at each of the five places in the script file and the two in the localization file, each saying how many blank lines there are and how many the format keeps, and the warning `style/not-formatted` once for each file. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
