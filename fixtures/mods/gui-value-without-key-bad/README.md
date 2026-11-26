# gui-value-without-key-bad

A word standing alone among a widget's properties, with no key.

No base-game GUI file writes one.

A correct tool reports `syntax/gui-value-without-key` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-value-without-key-good](../gui-value-without-key-good/README.md), is the same file without the
defect, and has no finding.
