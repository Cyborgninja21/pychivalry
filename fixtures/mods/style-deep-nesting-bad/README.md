# style-deep-nesting-bad

The fixture pair of `style/deep-nesting` (the family `style`, pychivalry's own best-practice
rules; release 2.3.0's CK3317), with `style-deep-nesting-good`, from which it differs only in
the defect. A scripted effect whose fifth nested `if` holds a `limit`: the record's body is
depth 1, so that `limit` is 7 blocks deep, one past the limit of 6.

A correct tool reports one hint for the record, at the `limit` that crosses the limit, with the
number of places in the record that do (1). No fix. `expected.json` holds the finding. Its file
is in pychivalry's format (Windows line breaks, the byte-order mark), so the formatter finds
nothing here.
