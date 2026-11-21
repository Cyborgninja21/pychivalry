# parse-missing-equals-before-block

A block written `name { ... }`, with its `=` missing: a date inside a character's history
(line 4), which is the base game's own known defect (in 1.21.0.3,
`history/characters/han/sima_53f8_99ac.txt`), and a character at the top level (line 8).

A correct tool reports `Expected '=' between block name and body` at each `{`, and reads each
as `name = { ... }`, as the message's own words (a block name and a body) say the game does.

In a block that holds only values, `name { ... }` is a value followed by a block, which a list
may hold: the `dynasty_names` list on line 14 gives no finding. `expected.json` holds the
findings and the tree.
