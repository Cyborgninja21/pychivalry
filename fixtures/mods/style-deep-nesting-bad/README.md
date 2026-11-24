# style-deep-nesting-bad

The fixture pair of `style/deep-nesting` (the family `style`, pychivalry's own best-practice
rules; release 2.3.0's CK3317), with `style-deep-nesting-good`, from which it differs only in
the defect. A scripted effect whose fifth nested `if` holds a `limit`: the record's body is
depth 1, so that `limit` is 7 blocks deep, one past the limit of 6.

A correct tool reports one hint, at the `limit` that crosses the limit, and none for anything
inside it. No fix. `expected.json` holds the finding.
