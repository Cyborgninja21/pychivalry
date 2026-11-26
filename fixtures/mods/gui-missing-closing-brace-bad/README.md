# gui-missing-closing-brace-bad

A window whose own `}` is missing: the file ends inside it.

No base-game GUI file is left open on game 1.21.0.3.

A correct tool reports `syntax/gui-missing-closing-brace` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-missing-closing-brace-good](../gui-missing-closing-brace-good/README.md), is the same file without the
defect, and has no finding.
