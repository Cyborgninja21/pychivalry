# gui-missing-value-bad

A widget's `name =` with nothing after it before the block's `}`.

No base-game GUI file writes one.

A correct tool reports `syntax/gui-missing-value` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-missing-value-good](../gui-missing-value-good/README.md), is the same file without the
defect, and has no finding.
