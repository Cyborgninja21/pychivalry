# localization-unbalanced-brackets-bad

The fixture pair of `localization/unbalanced-brackets` ([docs/checks.md](../../../docs/checks.md#46-event-targets-and-localization)),
with `localization-unbalanced-brackets-good`, from which it differs only in the defects.

A correct tool reports two warnings, each with the game's own message: "Loc key
`fixture_brackets_extra_open`: Unexpected extra `[` at position 24 - file `...`", a statement
opened inside one still open, and "... Unexpected extra `]` at position 22 ...", a `]` with no
statement open. It is silent on a balanced statement beside a `$VALUE|0$`, on brackets and an
escaped quote inside a quoted argument (`'The Blues\\'s [team]'`), and on
`fixture_brackets_unclosed`, a statement left open: the game's message for that ("Unterminated
'['") is in the 1.21 executable but not yet in the spec package's catalogue, so it is not
reported. The check needs no base game. `expected.json` holds the findings.
