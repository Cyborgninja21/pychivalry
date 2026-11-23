# structure-event-undeclared-namespace-bad

The fixture pair of `structure/event-undeclared-namespace` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`structure-event-undeclared-namespace-good`, from which it differs only in the defects: an
event whose namespace its file does not declare, beside one whose namespace it does, and a file
that declares no namespace at all.

A correct tool reports two warnings with the game's message "Namespace '{}' used in event '{}'
(file: {}) is not defined in this file - it might not load properly.": `fixture_other.0001`
and `fixture_third.0001`. `expected.json` holds the findings.
