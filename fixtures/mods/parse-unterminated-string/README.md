# parse-unterminated-string

Quoted text without its closing quote, on line 5.

The text runs to the end of the file, as the lexer reads it, so the event it is in is never
closed. A correct tool reports two findings: at the opening quote,
`Unterminated string starting at '<file>:5'`, which is information because the spec's error
catalogue has no message for it (docs/MVP.md, principle 1); and at the event's `{` on line 3,
the error `Expected } after arguments`. `expected.json` holds the findings and the tree.
