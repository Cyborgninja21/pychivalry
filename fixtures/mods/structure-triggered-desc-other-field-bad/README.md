# structure-triggered-desc-other-field-bad

The fixture pair of `structure/triggered-desc-other-field` ([docs/checks.md](../../../docs/checks.md#45-fields-and-structure)), with
`structure-triggered-desc-other-field-good`, from which it differs only in the defect: a
`triggered_desc` of an event's description holds a `first_valid` beside its `trigger` and its
`desc`, where the game's dynamic-description reader takes only those two.

A correct tool reports one warning, at the `first_valid`, with the game's message "The body of
triggered_desc can only take desc and/or trigger. %s". `expected.json` holds the finding.

The event has a `type`, a `title`, a `desc` and an `option`, so that the advice checks of item
4.7 have nothing to say about it.
