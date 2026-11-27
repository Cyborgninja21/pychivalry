# gui-malformed-arithmetic-bad

`@[ ... ]` with its last operand missing.

The base game writes `@[ ... ]` twice in its GUI files, both well formed (`gui/window_activity_locale.gui:321`).

A correct tool reports `syntax/gui-malformed-arithmetic` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-malformed-arithmetic-good](../gui-malformed-arithmetic-good/README.md), is the same file without the
defect, and has no finding.
