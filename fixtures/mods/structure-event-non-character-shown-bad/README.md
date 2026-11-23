# structure-event-non-character-shown-bad

The fixture pair of `structure/event-non-character-shown` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`structure-event-non-character-shown-good`, from which it differs only in the defect: an event
whose `scope` is a faith, not a character, and that is neither `hidden` nor `major`.

A correct tool reports one error with the game's message "Error in event '{}'. Non-character
events must be hidden, or be narrative events". An event in the character scope is not
reported. `expected.json` holds the finding.
