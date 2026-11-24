# style-not-formatted-bad

The fixture pair of `style/not-formatted`
([docs/checks.md](../../../docs/checks.md#formatting-the-style-family)), with `style-not-formatted-good`,
from which it differs only in the defect. A file of scripted effects written without the format's layout, line breaks and byte-order mark: indented with spaces, two pairs on one line, a block of one simple pair over several lines, tabs before a comment, `\n` line breaks and no mark. The localization file is in the format.

A correct tool reports the warning `style/not-formatted` once for the script file, at its start, saying how many places differ and by which rule, and a hint at each place (`style/indentation`, `style/block-layout` twice, `style/comment-spacing`, `style/line-endings`, `style/byte-order-mark`). Each finding has a safe fix. `expected.json` holds the
`style/` findings; the pair is read without a base game. The files' bytes are exact
(`.gitattributes`).
