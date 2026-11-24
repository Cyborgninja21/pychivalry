# style-trailing-whitespace-bad

The fixture pair of `style/trailing-whitespace`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-trailing-whitespace-good`,
from which it differs only in the defect. Spaces and tabs at the end of lines: after `{`, after a value, on the blank line between the two effects, after a comment; and after a localization header, an entry and a comment.

A correct tool reports `style/trailing-whitespace` at each of the seven places, and the warning `style/not-formatted` once for each file. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
