# names-unknown-link-bad

The fixture pair of `names/unknown-link` ([docs/checks.md](../../../docs/checks.md#42-unknown-names)),
with `names-unknown-link-good`, from which it differs only in the defects. Scope chains with a
segment that is no link: after `root` as a key, after `scope:fixture_target` as a value, and
after `scope:fixture_target.liege` as a key.

A correct tool reports three errors with the game's message "Failed to parse data for event
target link. Link: %s, location: %s", each with the chain and the segment that is no link. It
is silent on the chains made of links, on one that ends in a value
(`scope:fixture_target.primary_title.tier >= 2`), on `title:k_fixture.holder`, and on
`fixture_not_a_chain.desc`, a dotted word that starts at no scope. `expected.json` holds the
findings.
