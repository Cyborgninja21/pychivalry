# parse-block-without-key

A block at the top level of a file with nothing in front of it.

A correct tool reports one error at its `{` (line 5): `Unexpected token, expected 'key = {'`.
The block is kept as an item of the file, and the definitions before and after it are read
as usual. `expected.json` holds the finding and the tree.
