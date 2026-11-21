# parse-missing-operator

Words at the top level of a file with no operator after them: `namespace fixture` on line 1,
and three stray words on line 7.

A correct tool reports `Unexpected token '<word>' found at '<file>:<line>', '=' expected` at
the token found where `=` belongs: `fixture` on line 1 and `words` on line 7. A token reported
that way is not reported again, so the three stray words give one finding. Each word is kept
as a bare value; the events around them are read as usual. `expected.json` holds the findings
and the tree.
