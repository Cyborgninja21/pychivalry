# localization-unbalanced-brackets-bad

The fixture pair of `localization/unbalanced-brackets` ([docs/checks.md](../../../docs/checks.md#46-event-targets-and-localization)),
with `localization-unbalanced-brackets-good`, from which it differs only in the defects.

A correct tool reports six warnings, each with the game's own message: "Loc key
`fixture_brackets_extra_open`: Unexpected extra `[` at position 24 - file `...`", a statement
opened inside one still open, and "... Unexpected extra `]` at position 22 ...", a `]` with no
statement open; and, since the spec package's format 9 holds the localization reader's
"Unterminated" messages, four openers left open: a statement (`fixture_brackets_unclosed`,
"Unterminated '[' at position 0 in [...] data statement"), a parenthesis inside a statement
(`fixture_brackets_open_paren`), a quote inside a statement (`fixture_brackets_open_quote`) and a
`$` outside statements (`fixture_brackets_open_dollar`). It is silent on a balanced statement
beside a `$VALUE|0$`, on brackets and an escaped quote inside a quoted argument (`'The
Blues\\'s [team]'`), and on `fixture_brackets_paren_closed_by_bracket`, a `]` written while a
parenthesis is open, which the check does not decide (whether the game then reads the `]` as text
is not shown). The check needs no base game. `expected.json` holds the findings.
