# parse-operator-without-key

An `=` with no key in front of it: once inside a block (line 3) and once at the top level
(line 7).

A correct tool reports `Unexpected token, expected 'key = {'` at each `=` and skips it. Inside
the block, the `20` after it is a bare value, which a block may hold. At the top level the
word after it is a key with no operator, reported at the end of the file:
`Unexpected token '' found at '...:8', '=' expected`. `expected.json` holds the findings and
the tree.
