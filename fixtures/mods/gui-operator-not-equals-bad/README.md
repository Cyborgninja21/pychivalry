# gui-operator-not-equals-bad

A size written with `>` where a GUI file writes `=`.

No base-game GUI file writes an operator other than `=`.

A correct tool reports `syntax/gui-operator-not-equals` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-operator-not-equals-good](../gui-operator-not-equals-good/README.md), is the same file without the
defect, and has no finding.
