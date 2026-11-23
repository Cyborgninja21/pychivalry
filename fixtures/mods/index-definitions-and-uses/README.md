# index-definitions-and-uses

A mod that holds one definition of every form the index records, and uses of each name in every
way a word is read as a use (build step 3, items 3.3, 3.4 and 3.9). It is read alone, with the
committed spec's folder list and its override rules (part D1), which make the top-level keys of
`common/defines` and the key `colors` of `common/named_colors` containers. The package's part D2
makes `namespace = x` in an event file no definition (it names a namespace, by its value) and a
constant hold for its file: `@fixture_cost` is of the database
`constants:common/scripted_effects/fixture_effects.txt`.

| Form | Example here |
| --- | --- |
| `record`, `value` | `fixture_effect = { ... }`, `fixture_value = 10` |
| `prefixed` | `scripted_trigger fixture_inline_trigger = { ... }` in an event file |
| `constant` | `@fixture_cost = 5`, of its file's own database |
| `container`, `entry` | `NFixture = { FIXTURE_DEFINE = 1 }`, `colors = { fixture_green = ... }` |
| `key` | localization keys, with and without a version number, in a file with the byte-order mark |

Uses: a key (`fixture_other_effect = yes`), a value, a list element, a whole number
(`father = 1002`), each segment of a scope chain and the part after its `:`
(`trait:fixture_trait`, `value:fixture_scaled_value`), each name between `|` bars
(`define:NFixture|FIXTURE_DEFINE`), quoted text holding one word (`"fixture.1.desc"`), and
`$name$` in a localization entry. Not uses: a comment, quoted text with spaces, a `$PARAM$`, a
date, a decimal, a tagged value's tag, a prefix word, `$$`, and a definition's own key.

Two files sit in folders the spec does not list, `common/fixture_not_a_folder/` and
`events_old/` (a whole folder name, not `events/`): they are not read, so they define nothing
and their uses are not counted.

`expected.json` lists every definition (name, database, form, container, prefix, file, line,
column, and for a localization key its version) and every use of each defined name (file, line,
column). Lines and columns count from 1; a tab is one column. The test is
`packages/core/src/index/fixtures.test.ts`.
