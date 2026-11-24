# style-unusual-field-order-bad

The fixture pair of `style/unusual-field-order` (the family `style`, pychivalry's own
best-practice rules), with `style-unusual-field-order-good`, from which it differs only in the
order of fields. Three on-actions (`common/on_action`, a folder whose records the game reads
field by field) each writing `effect` before `trigger`, which the usual order puts first:

- `fixture_on_action`, a field to a line, with a comment above `effect` and one at the end of
  the `trigger` line: its fix moves the `trigger` line, with its comment, above `effect` and
  its comment;
- `fixture_one_line`, written on one line: its fix rewrites the line, its spaces kept;
- `fixture_unclear`, whose comment stands between two blank-line-separated fields, so which
  field it belongs to is not clear: no fix is offered.

A correct tool reports three hints, each at the `trigger` written after `effect`; the first two
carry a safe fix that writes the record as `style-unusual-field-order-good` does. `expected.json`
holds the findings.
