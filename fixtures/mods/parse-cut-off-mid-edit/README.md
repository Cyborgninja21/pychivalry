# parse-cut-off-mid-edit

Text cut off the way a file looks in the middle of an edit: each file ends, with no final line
break, at a different place in the same event. After an operator, after a key, after an
opening brace, inside quoted text, inside a top-level key, inside inline arithmetic, and inside
a comment.

A correct tool returns a tree for each, holding everything written up to the cut, and reports
every block still open at its `{` (`Expected } after arguments`), plus the finding of the
place it stopped: a missing value after the operator, a key with no operator at the top level,
unterminated quoted text, unclosed arithmetic. A key cut off inside a block, and a comment cut
off anywhere, add nothing more. `expected.json` holds each file's findings and tree.
