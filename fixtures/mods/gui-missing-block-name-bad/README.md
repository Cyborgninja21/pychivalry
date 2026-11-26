# gui-missing-block-name-bad

A `blockoverride` followed by its block with no name between them.

No base-game GUI file writes one; it names every one of its 8,558 block overrides.

A correct tool reports `syntax/gui-missing-block-name` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-missing-block-name-good](../gui-missing-block-name-good/README.md), is the same file without the
defect, and has no finding.
