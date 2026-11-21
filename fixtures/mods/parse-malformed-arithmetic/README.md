# parse-malformed-arithmetic

Inline arithmetic, `@[ ... ]`: one well formed (line 4), two malformed (lines 5 and 6), and one
whose `]` is missing (line 7), which ends at the end of its line.

A correct tool reports `Malformed inline expression '@[<text>]': <reason>` for each of the
three, as information, because the spec's error catalogue has no message for it
(docs/MVP.md, principle 1). Each value is kept as written, without an expression, and the
pair after the unclosed one is read as usual. `expected.json` holds the findings and the tree.
