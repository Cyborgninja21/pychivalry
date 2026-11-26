# gui-operator-without-key-bad

An `=` with no key in front of it among a widget's properties: the key `spacing` left out.

No base-game GUI file writes one.

A correct tool reports `syntax/gui-operator-without-key` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-operator-without-key-good](../gui-operator-without-key-good/README.md), is the same file without the
defect, and has no finding.
