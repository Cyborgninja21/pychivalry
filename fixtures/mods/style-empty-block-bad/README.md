# style-empty-block-bad

The fixture pair of `style/empty-block` (the family `style`, pychivalry's own best-practice
rules; release 2.3.0's CK3314), with `style-empty-block-good`, from which it differs only in
the defect. A scripted effect with six blocks that hold nothing: a `limit` with nothing in it,
an `else` that holds only a comment, an `any_child` in a `limit` (an iterator that is a
condition), an `every_child` among the effects (an iterator whose body is effects), a `liege`
(a scope switch) and an `OR` beside a condition in a `limit` (a logical operator).

A correct tool reports six hints, one at each block. The empty `limit`, `liege` and `OR` are a
trigger block, a scope switch and a logical operator, whose meaning when empty the spec package
leaves open: each message says so, and none carries a fix (the owner's decision of 2026-11-26,
docs/decisions.md row 172). The `else` carries none either, since taking it away would delete
its comment, and it is an effect written with an empty block. The empty `any_child` is never
taken away: its message says it asks for at least one, and its fix, a suggestion, writes that
test out with the parameter the spec package documents for it, `{ count >= 1 }` (the owner's
decision of 2026-11-26, row 167). The empty `every_child` runs no effect, so it is taken away
like any other empty block, a suggestion too. `expected.json` holds the findings. Its files are
in pychivalry's format (Windows line breaks, the byte-order mark; `.gitattributes` keeps their
bytes exact): the formatter finds nothing here, and nothing after the fixes.
