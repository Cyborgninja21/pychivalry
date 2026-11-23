# style-block-layout-bad

The fixture pair of `style/block-layout`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-block-layout-good`,
from which it differs only in the defect. Blocks laid out otherwise than the format says: a block of two pairs on one line, which goes over several lines; a block of one simple pair over several lines, which goes on one line; and an `if` whose `{` is on the line after its `=`, which goes on the key's line.

A correct tool reports `style/block-layout` once for each block whose layout changes (the reward effect's, the `if`'s, the `limit`'s), each saying what layout it takes, and the warning `style/not-formatted` once. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
