# parse-missing-closing-brace

An event whose own `}` is missing: the file ends inside it. The base game ships one such file
in 1.21.0.3 (`events/dlc/gdp/gdp_visit_holding_decision_event_2.txt`, its last event).

A correct tool reports one error at the event's `{` (line 3): `Expected } after arguments`.
The event keeps everything written in it; its block ends at the end of the file.
`expected.json` holds the finding and the tree.
