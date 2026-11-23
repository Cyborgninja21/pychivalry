# Presentation data

How the editor shows each kind of record: pychivalry's own data, read by the language server
only (docs/PLAN.md, item 8.8). It shapes the outline, completion and the inline hints. It never
raises, changes or silences a finding: the core does not read these files and no check can be
given them, which a test holds (`packages/lsp/src/presentation.test.ts`).

The entries were brought back from the 32 pre-2.0 schema files
([the reference](../docs/references/wiki-era-schemas.md)), written by hand in this format and
checked one by one against the 1.21.0.3 base game and the committed spec package. Some are new.
Nothing here is copied from the game.

## The files

One file per record kind, that is per game folder, at the folder's own path: `events.json` for
`events/`, `common/decisions.json` for `common/decisions/`,
`common/activities/activity_types.json` for `common/activities/activity_types/`. A file's
`folder` is that path. One more file, `_all.json`, holds what applies to every folder.
`presentation.schema.json` is the JSON Schema of both; a test validates every file against it
(`tools/src/presentation.test.ts`).

A folder file holds, each part optional:

| Key | What it says |
| --- | --- |
| `folder` | The game folder, as the spec package writes it |
| `from` | The pre-2.0 schema files the entries came from; empty for data written new |
| `outline` | The outline rule |
| `fieldOrder` | The order fields are conventionally written in |
| `snippets` | Snippets with tab stops |
| `hints` | Inline hints |

`_all.json` holds `folder: "*"`, `hints` that apply in every folder, and `language`, the
language localized hints are read in (`l_english`).

### The outline rule

A record is a top-level key whose value is a block. In a file of a folder with an outline rule,
each record is shown with the rule's `symbol` (a symbol kind of the language-server protocol, by
its protocol name: `Event`, `Function`, `EnumMember`) and its `detail`, and under it the fields
`blocks` lists, in the order the record writes them, each with its own `symbol` and `label`.
Every other top-level entry (an events file's `namespace`, an `@constant`), and every file of a
folder with no rule, keeps the plain outline: the top-level keys with the definitions the index
reads inside them. Those definitions stay under their record, under the listed field that holds
them where one does.

```json
"outline": {
    "symbol": "Event",
    "detail": "{type}",
    "blocks": [
        { "field": "immediate", "symbol": "Function" },
        { "field": "option", "symbol": "EnumMember", "label": "{name}", "fallback": "option {n}" }
    ]
}
```

A `label`, a `fallback` and a `detail` are templates: `{key}` is the field's key as written,
`{n}` its number among the fields of that key in the record (from 1), `{value}` its value when it
is plain text, and any other `{name}` the value the field `name` of its block holds when it is
written once as plain text (the record's own block, for `detail`). A template whose placeholder
has no value gives nothing: the label falls back to `fallback`, then to the key, and the detail
to the plain outline's. `"children": "blocks"` also lists the field's own keyed blocks under it
(an activity's phases).

### The field order

```json
"fieldOrder": [{ "block": "", "fields": ["type", "title", "desc", "theme"] }]
```

`block` is the path of keys from the record's body to the block, joined by `.`; `""` is the
record's body. In that block, completion lists the fields it offers in this order, ahead of the
other fields and of everything else, and preselects the first field of the order not yet written
after the last one written before the cursor. The formatter may later read the same order.

### Snippets

```json
{
    "label": "option",
    "description": "An option the player can choose, with its localization key",
    "at": "field",
    "field": "option",
    "body": ["option = {", "\tname = ${1:my_namespace.1.a}", "\t$0", "}"]
}
```

`body` is the snippet's lines in VS Code's snippet syntax: `$1`, `${1:default}`,
`${1|one,two|}`, `$0`. `at` says where completion offers it: `file`, the head of a new file of
the folder (an events file's `namespace`), and `record`, a new record, both at the top level of
a file; `field`, the field `field` in the block `block` (the record's body when absent), offered
only where completion offers that field, that is where the spec says it may be written.
Snippets are offered to an editor that says it takes them.

Every snippet must produce script pychivalry's own checks accept with no error and no warning:
a test writes each as a file of its folder (a field snippet inside the folder's first record
snippet) and checks it (`packages/lsp/src/snippets.test.ts`). A choice (`${1|a,b|}`) is written
only as the value of a record's field, and each of its options is a value the spec records the
base game writing in that field.

### Inline hints

| Hint | Shows |
| --- | --- |
| `{ "kind": "text", "field": "title" }` | Beside a record's key, the localized text of the key its `title` holds; where the record writes no `title`, of the key a confirmed row of the spec's part D5 says the record has in its place (a decision's own key) |
| `{ "kind": "text" }` | Beside a record's key, the localized text of the record's own name, as a confirmed row of part D5 gives it |
| `{ "kind": "text", "block": "option", "field": "name" }` | Beside each `option` of a record, the localized text of the key its `name` holds |
| `{ "kind": "scope" }` | After the key of a link, a chain or an iterator, the scope type it switches to, as the core's scope walk reads it |

A text is the copy in force by the override rules; where no rule says which copy is in force and
the copies differ, nothing is shown. Hints are read only for the lines the editor shows, at most
1,000 at a time, each text cut to 60 characters. The setting `pychivalry.inlayHints.enabled`
turns them off.

## Rules for the data

- Every field it names (an outline rule's, a field order's, a hint's, a field snippet's) is a
  field of that folder's record schema in the committed spec package; a test checks every name.
  This is presentation data about real names, not a vocabulary.
- A folder with no record schema in the spec, or a field the 1.21 base game no longer has, is
  left out rather than kept.
- Every snippet passes the snippet test above.
