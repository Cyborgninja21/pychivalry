# variables-read-without-set-bad

The fixture pair of `variables/read-without-set` ([docs/checks.md](../../../docs/checks.md#variables-on-the-table-variables)),
with `variables-read-without-set-good`, from which it differs only in the defects. Read over the
game stub [event-targets-and-localization](../../game/event-targets-and-localization/README.md),
which sets the variable `fixture_base_variable`, since the check judges nothing without a base
game. A scripted effect sets the variable `fixture_count` and adds to the variable list
`fixture_guests`, then reads three variables that nothing sets in their namespace and kind (the
spec package's table `variables` tells them apart): `has_variable = fixture_guests` (a list read
as a value), `var:fixture_missing` (set nowhere), and `change_global_variable` of
`fixture_count` (set as a variable of its scope, not as a global one).

A correct tool reports three findings, at information, one at each name. It is silent on
`has_variable = fixture_count`, on the base game's `fixture_base_variable` and on the list
iterated with `every_in_list`. `expected.json` holds the findings.
