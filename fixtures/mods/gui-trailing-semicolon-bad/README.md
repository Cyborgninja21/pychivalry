# gui-trailing-semicolon-bad

Two statements ended with `;`: against a word (`expanding;`) and apart from quoted text (`"[...]";`).

On game 1.21.0.3 the base game writes `expanding;` (`gui/window_dlc_info.gui:213`) and `struggle_tooltip;` (`gui/window_character.gui:5452`); the install's `jomini/` and `clausewitz/` tool windows write 11 `;` apart from quoted text.

A correct tool reports `syntax/gui-trailing-semicolon` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-trailing-semicolon-good](../gui-trailing-semicolon-good/README.md), is the same file without the
defect, and has no finding.
