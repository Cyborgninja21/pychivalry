# references-unknown-key-bad

The fixture pair of `references/unknown-key` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`references-unknown-key-good`, from which it differs only in the defects. Two places part D6
of the spec package confirms hold a key of a database: a dynasty house's `dynasty` (a key of
`common/dynasties`) and the value of the trigger `has_cultural_tradition` (a key of
`common/culture/traditions`). Each names a key the mod does not define.

A correct tool reports two warnings with the game's message "Failed to read key reference %s
from database %s". It is silent on a key the mod defines and on a scope written as the value
(`prev`). `expected.json` holds the findings.
