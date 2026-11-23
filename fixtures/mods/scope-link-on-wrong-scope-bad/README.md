# scope-link-on-wrong-scope-bad

The fixture pair of `scope/link-on-wrong-scope` ([docs/checks.md](../../../docs/checks.md#44-scope)),
with `scope-link-on-wrong-scope-good`, from which it differs only in the defects. Links applied
to a scope they cannot start from, in a decision whose root is a character: `holder` (a link of
titles) as a block key, `liege` (a link of characters) after `primary_title` in a chain written
as a key, `holder` after `root` in a chain written as the value of `is_vassal_of`, and
`title_province` (a link of titles) after `capital_province`.

A correct tool reports four errors with the game's message "Trying to use %s link on an invalid
scope %s", each with the link, the scope it is applied to and the scopes it can start from, and
the chain and segment where it is one. It is silent on `is_adult` inside the blocks of those
links: after a link on the wrong scope the scope is not known, so one mistake gives one finding.
`expected.json` holds the findings.

The decision has a `picture`, as every base-game decision does, so that the advice check
`fields/usually-present` (item 4.7) has nothing to say about it.
