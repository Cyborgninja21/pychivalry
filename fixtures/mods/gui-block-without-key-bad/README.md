# gui-block-without-key-bad

A block with no key among a window's properties.

No base-game GUI file writes a block with no key.

A correct tool reports `syntax/gui-block-without-key` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-block-without-key-good](../gui-block-without-key-good/README.md), is the same file without the
defect, and has no finding.
