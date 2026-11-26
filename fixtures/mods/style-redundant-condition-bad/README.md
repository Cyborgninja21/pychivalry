# style-redundant-condition-bad

The fixture pair of `style/redundant-condition` (the family `style`, pychivalry's own
best-practice rules; release 2.3.0's CK3872), with `style-redundant-condition-good`, from which
it differs only in the defect. A scripted trigger whose `AND`, `NAND` and `any_false` each hold
an `always = yes` beside two other conditions: part D4 of the spec package says a child that
always holds changes nothing in any of the three while another child remains
(`child_always_true: neutral`). The reader reads `any_false` as a trigger whose body holds
triggers, not as a structural keyword; the check judges it all the same (decision 163).

A correct tool reports three hints, one at each `always = yes`. Each carries a safe fix that takes
its line away, the block keeping its two other conditions. `expected.json` holds the findings.
Its files are in pychivalry's format (Windows line breaks, the byte-order mark; `.gitattributes`
keeps their bytes exact): the formatter finds nothing here, and nothing after the fixes.
