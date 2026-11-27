# gui-unterminated-string-bad

Quoted text with no closing quote: it runs to the end of the file, so the window's block is left open too.

No base-game GUI file writes one.

A correct tool reports `syntax/gui-unterminated-string` (information: no catalogue message is
shown to be the GUI reader's, docs/checks.md) at the opening quote, and, since the text runs to
the end of the file, `syntax/gui-missing-closing-brace` at the window's `{`. `expected.json` holds the findings and the tree;
the good half, [gui-unterminated-string-good](../gui-unterminated-string-good/README.md), is the same file without the
defect, and has no finding.
