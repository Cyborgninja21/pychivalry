# definitions-clash-bad

The fixture pair of `definitions/clash` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with `definitions-clash-good`, from
which it differs only in the defect: one event id, `fixture.0001`, defined in two files with
the same `id_override_priority` (none written, so the default). The rules table's row for
events says the game calls that an error.

A correct tool reports two errors, one at each definition, with the message the rules row
names: "Duplicated event ID {} with the same override priority {} found:". `expected.json`
holds the findings.
