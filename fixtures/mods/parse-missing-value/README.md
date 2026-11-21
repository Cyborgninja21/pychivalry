# parse-missing-value

An operator with nothing after it. On line 5, `title =` is followed by the event's `}`; on
line 10, `desc >` is followed by another operator.

A correct tool reports `Expected '{' between equals and arguments` at the token found where
the value belongs: the `}` on line 6, and the `=` on line 10. The pair is kept without a
value, and what follows is read as usual, so the second `=` is also reported as an operator
with no key. `expected.json` holds the findings and the tree.
