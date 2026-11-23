# structure-range-min-above-max-bad

The fixture pair of `structure/range-min-above-max` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`structure-range-min-above-max-good`, from which it differs only in the defects: two ranges
whose minimum is above their maximum, a script value written as a range and a range inside a
formula's `value`.

A correct tool reports two errors with the game's message "min value in range directive is
larger than the max value. Unknown location; yell at a programmer". A range of named script
values is not judged: it has no value until the game evaluates it. `expected.json` holds the
findings.
