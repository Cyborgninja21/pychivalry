# style-empty-block-bad

The fixture pair of `style/empty-block` (the family `style`, pychivalry's own best-practice
rules; release 2.3.0's CK3314), with `style-empty-block-good`, from which it differs only in
the defect. A scripted effect with two blocks that hold nothing: a `limit` with nothing in it,
and an `else` that holds only a comment.

A correct tool reports two hints, one at each block. The empty `limit` carries a fix, a
suggestion that takes it away (the `if` around it keeps its effect); the `else` carries none,
since taking it away would delete its comment. `expected.json` holds the findings.
