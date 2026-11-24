# style-byte-order-mark-bad

The fixture pair of `style/byte-order-mark`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-byte-order-mark-good`,
from which it differs only in the defect. A script file without the UTF-8 byte-order mark, otherwise in the format.

A correct tool reports `style/byte-order-mark` once, at the start of the file, and the warning `style/not-formatted` once. Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
