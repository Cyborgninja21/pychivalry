# gui-missing-equals-bad

A `size` block and an `align` value written without their `=`: the two shapes the base game itself writes, `size { 5 0 }` and `align right|top`.

On game 1.21.0.3 the base game writes `size { ... }` twice (`gui/window_dynasty_house.gui:2894`, `gui/window_legends.gui:1002`), `margin { ... }` once (`gui/debug/window_drag_drop_test.gui:32`) and `align right|top` once (`gui/window_dynasty_house.gui:1828`).

A correct tool reports `syntax/gui-missing-equals` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-missing-equals-good](../gui-missing-equals-good/README.md), is the same file without the
defect, and has no finding.
