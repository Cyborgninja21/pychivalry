# parse-null-safe-after-value

`?=` after a key that is neither a name, a scope chain nor a `$PARAM$`: a date, on line 7.
On line 6 it follows a scope chain, as it should.

A correct tool reports `Unexpected token '?=' found at '<file>:7', '=' expected` at the `?=`
and reads the pair as written. `expected.json` holds the finding and the tree.
