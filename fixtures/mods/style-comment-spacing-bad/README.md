# style-comment-spacing-bad

The fixture pair of `style/comment-spacing`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-comment-spacing-good`,
from which it differs only in the defect. Comments at the end of a line after two tabs and after no space; the one after `{` is already one space after it.

A correct tool reports `style/comment-spacing` at the two comments, and the warning `style/not-formatted` once. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
