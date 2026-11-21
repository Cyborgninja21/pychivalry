# parse-unexpected-closing-brace

A `}` too many: `}}` after a trigger closes the trigger and the event, so the event's `option`
and its last `}` are left at the top level.

A correct tool reports one error at the `}` on line 11, where no block is open:
`Unexpected token, expected 'key = {'`. That `}` is skipped; the `option` is read as a
top-level pair, and the next event is read as usual. `expected.json` holds the finding and the
tree.
