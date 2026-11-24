# style-indentation-bad

The fixture pair of `style/indentation`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-indentation-good`,
from which it differs only in the defect. Lines indented otherwise than one tab per enclosing block (four spaces, two tabs, a space before a key at the top level, a tab and two spaces), and localization lines indented with a tab, nothing and three spaces.

A correct tool reports `style/indentation` at each of the seven lines, each with the indentation it takes, and the warning `style/not-formatted` once for each file. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
