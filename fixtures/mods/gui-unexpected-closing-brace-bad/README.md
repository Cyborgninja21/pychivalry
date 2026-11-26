# gui-unexpected-closing-brace-bad

A `}` after the window's own, with no block open.

The install's `clausewitz/gui/applicationutils/tools_gui_dialogs.gui` ends with one such `}` (line 217).

A correct tool reports `syntax/gui-unexpected-closing-brace` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-unexpected-closing-brace-good](../gui-unexpected-closing-brace-good/README.md), is the same file without the
defect, and has no finding.
