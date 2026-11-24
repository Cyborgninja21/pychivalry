# style-unusual-field-order-bad

The fixture pair of `style/unusual-field-order` (the family `style`, pychivalry's own
best-practice rules), with `style-unusual-field-order-good`, from which it differs only in the
order of fields. Two on-actions (`common/on_action`, a folder whose records the game reads field
by field) each writing `effect` before `trigger`, which the usual order puts first:

- `fixture_on_action`, a field to a line, with a comment above `effect` and one at the end of
  the `trigger` line: its fix moves the `trigger` line, with its comment, above `effect` and
  its comment;
- `fixture_unclear`, whose comment stands between two blank-line-separated fields, so which
  field it belongs to is not clear: no fix is offered.

A correct tool reports two hints, each at the `trigger` written after `effect`; the first carries
a safe fix that writes the record as `style-unusual-field-order-good` does. `expected.json` holds
the findings. The file is in pychivalry's format (Windows line breaks, the byte-order mark;
`.gitattributes` keeps its bytes exact): the formatter finds nothing here, and nothing after
the fix. A record written on one line is tested in the check's own test, since the format
writes a block of two pairs over several lines.
