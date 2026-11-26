# style-redundant-false-condition-bad

The fixture pair of `style/redundant-false-condition` (the family `style`, pychivalry's own
best-practice rules; new, decision 158), with `style-redundant-false-condition-good`, from which
it differs only in the defect. A scripted trigger whose `OR`, `NOR` and `all_false` each hold an
`always = no` beside other conditions: part D4 of the spec package says a child that always
fails changes nothing in any of the three while another child remains (`child_always_false:
neutral`).

A correct tool reports three hints, one at each `always = no`. Each carries a safe fix that takes
its line away, the block keeping its two other conditions. `expected.json` holds the findings.
Its files are in pychivalry's format (Windows line breaks, the byte-order mark; `.gitattributes`
keeps their bytes exact): the formatter finds nothing here, and nothing after the fixes.
