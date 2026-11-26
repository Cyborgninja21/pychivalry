# gui-malformed-type-bad

A type definition with its base type left out: `type fixture_button = { ... }`.

No base-game GUI file writes one: each of its 2,256 type definitions is `type <name> = <base> { ... }`.

A correct tool reports `syntax/gui-malformed-type` (information: no catalogue message is shown to be the
GUI reader's, docs/checks.md) and nothing else. `expected.json` holds the findings and the tree;
the good half, [gui-malformed-type-good](../gui-malformed-type-good/README.md), is the same file without the
defect, and has no finding.
