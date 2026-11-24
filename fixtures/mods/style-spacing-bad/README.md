# style-spacing-bad

The fixture pair of `style/spacing`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-spacing-good`,
from which it differs only in the defect. Tokens on a line not one space apart: `add_gold=10`, `{is_adult  = yes}`; and localization entries with three spaces, and none, between the key and the text.

A correct tool reports `style/spacing` at each gap: two in `add_gold=10`, three in the `limit` block, and one at each of the two entries, with the warning `style/not-formatted` once for each file. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
