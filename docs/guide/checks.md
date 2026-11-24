# Checks

<!-- Written by `task docs:checks` from the core's check inventory; do not edit by hand. -->

Every finding pychivalry reports has a code, a family and a name such as
`names/unknown-trigger`. This page lists every code this build reports: its severity, what
it finds and the game's evidence for it, with the game's own message as the spec package's
catalogue for game 1.21.0.3 gives it. `pychivalry explain <code>` prints the same for one
code ([Commands](commands.md)).

75 codes: 21 errors, 8 warnings, 33 information and 13 hints. 28 rest on the game's own evidence; 34 are advice; 9 rest on pychivalry's own formatting rules; 4 on its own best-practice rules.

- An **error** or a **warning** is something the game itself rejects or complains about, and
  rests on the game's own evidence: a message of the game, the game's own output, or a
  field the spec package marks required with the game's message for it. The exception is
  the family `style`, below.
- **Information** and **hints** without such evidence are advice: usually right, not
  something the game enforces.
- The **`style/`** findings rest on pychivalry's own rules, not on the game, by the owner's
  decision. Its formatting rules ([formatting rules](../formatting.md)): a file that is not
  in that format is a warning, and each place that differs a hint, each with a safe fix; a
  file with a parse error has none. Its best-practice rules: a file that is not UTF-8 is a
  warning, with a fix that converts it; an empty block, a block nested too deep and fields in
  an unusual order are hints. Each best-practice rule is one the base game follows more
  often than it breaks.
- A file reports at most 1,000 findings, its most severe first; the command line says how
  many it left out.
- A check marked **on by default** can be turned off: the command line's
  `check --no-unused-keys`, the agent server's `check` with `unused_keys: false`, the
  editor's setting `pychivalry.localization.unusedKeys`.
- A finding with a mechanical **fix** carries it as data: **safe**, the one outcome that
  can be right, which `pychivalry check --fix` and the editor's "fix all" apply; or a
  **suggestion**, alternatives to choose from, which nothing applies by itself. The editor
  offers both as quick fixes; the agent server reports them and applies nothing.

The full inventory, with the checks still to come and those retired, the release 2.3.0
check each replaces and how each was proved on the base game, is the
[check inventory](../checks.md).

## definitions

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `definitions/clash` | error | Definitions the rules table says the game calls an error. | The game's own message for the duplicate: the catalogue entry the rules table's row for the clash names | None: which definition gets another name is a choice. |
| `definitions/not-read` | information | A definition in a file the rules table says the game does not read. | Advice: pychivalry's own, with no game message | None: the file is replaced or hidden on purpose, or moved: a choice. |

## encoding

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `encoding/not-utf8` | information | This file is not valid UTF-8 (&lt;number&gt; invalid bytes); it was read as &lt;encoding&gt;. | Advice: pychivalry's own, with no game message | None: which encoding the file was written in is not known. |

## fields

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `fields/bare-value-in-record` | error | A bare value directly in a record body that holds statements, where the game expects 'key ='; the finding is at the token found where '=' belongs. | The game's message `unexpected_token_X_found_at_X_expected`: "Unexpected token '&lt;token&gt;' found at '&lt;file:line&gt;', '=' expected" | Safe or a suggestion: A field of the record measured boolean written as '= yes' (safe when the base game writes only yes). |
| `fields/missing-required-field` | error | A field the spec package marks required is missing. | The game's own message for the field that is missing, which the spec package gives with each field it marks required | Suggestion: The field written with a placeholder of its kind to set, where its value is a number or a boolean. |
| `fields/unknown-field` | warning | A field in a record that its folder's field list does not have. | The game's message `unknown_X_in_X`: "Unknown &lt;field&gt; in &lt;record&gt;" | Safe or a suggestion: The fields of the record's folder near the name, not already written; safe when there is only one. |
| `fields/usually-present` | information | A record without a field that every base-game record of its kind sets. | Advice: pychivalry's own, with no game message | None: the field's value is a choice. |
| `fields/wrong-kind-of-value` | information | A value of another kind than the field takes. | Advice: pychivalry's own, with no game message | Suggestion: The values the base game writes in the field, where they are a small set. |
| `fields/unusual-value` | hint | A value no base-game record writes in a field whose values form a small set. | Advice: pychivalry's own, with no game message | Suggestion: The values the base game writes in the field that are near the one written. |

## localization

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `localization/missing-key` | warning | A localization key, in a field that holds one or that a record has by its name, defined in no localization file. | The game's message `unknown_loc_key_X`: "Unknown loc key &lt;key&gt;" | Suggestion: A stub entry for the key in the mod's localization file of each language it has (one is made when it has none). |
| `localization/unbalanced-brackets` | warning | Localization text with an extra `[` or `]`. | The game's message `loc_key_X_unexpected_extra_at_position_X_file_X`: "Loc key `<key>`: Unexpected extra `[` at position &lt;column&gt; - file `<file>`" | Suggestion: The statement left open closed after its command, or the extra bracket taken away; offered only where the entry is then balanced. |
| `localization/unused-key` | hint | A key the mod defines that nothing in the mod or the base game uses. **On by default:** `pychivalry check --no-unused-keys` turns it off. | Advice: pychivalry's own, with no game message | None: removing a key deletes text that may be wanted. |

## names

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `names/unknown-effect` | error | A key in an effect block that is no effect there. | The game's message `unknown_effect_X`: "Unknown effect '&lt;effect&gt;'" | Safe or a suggestion: The documented replacement of a removed effect, or the effects near the name that fit the scope; safe when there is only one. |
| `names/unknown-link` | error | A segment of a scope chain that is no link. | The game's message `failed_to_parse_data_for_event_target_link_link_X_location_X`: "Failed to parse data for event target link. Link: &lt;link&gt;, location: &lt;file:line&gt;" | Safe or a suggestion: The links near the segment that start from its scope; safe when there is only one. |
| `names/unknown-modifier` | error | A key in a modifier block that is no modifier and fills no modifier template. | The game's message `unknown_modifier_type_X_at_X`: "Unknown modifier type '&lt;modifier name&gt;' at &lt;file:line&gt;" | Safe or a suggestion: The documented replacement of a removed modifier, or the modifiers near the name whose use areas fit the block; safe when there is only one. |
| `names/unknown-on-action` | error | A value naming an on-action the game does not have. | The game's message `unknown_on_action_X`: "Unknown on action: &lt;on-action&gt;" | Safe or a suggestion: The on-actions near the name, of the game and the mod; safe when there is only one. |
| `names/unknown-trigger` | error | A key in a trigger block that is no trigger there. | The game's message `unknown_trigger_X`: "Unknown trigger '&lt;trigger&gt;'" | Safe or a suggestion: The documented replacement of a removed trigger, or the triggers near the name that fit the scope; safe when there is only one. |
| `names/modifier-outside-use-area` | warning | A modifier in a block of a kind its use area does not include. | The game's own output, with no message of its own: buckets.modifiers.&lt;name&gt;.use_areas and modifier_template_tags: the game's own modifier documentation | None: whether the modifier moves to another block or another modifier is meant is a choice. |

## references

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `references/unknown-key` | warning | A value that should be a key of a database names no key of it in the mod, the base game or a DLC. | The game's message `failed_to_read_key_reference_X_from_database_X`: "Failed to read key reference &lt;key&gt; from database &lt;database&gt;" | Safe or a suggestion: The keys of the database near the one written; safe when there is only one. |
| `references/unknown-name` | information | A value naming a definition the index does not hold, where no game message is known. | Advice: pychivalry's own, with no game message | Suggestion: The names of the folder near the one written (advice: never safe). |

## scope

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `scope/link-on-wrong-scope` | error | A link applied to a scope it cannot start from. | The game's message `trying_to_use_X_link_on_an_invalid_scope_X`: "Trying to use &lt;link&gt; link on an invalid scope &lt;scope&gt;" | Safe or a suggestion: A link that leads to a scope the link starts from written before it, where at most five do; safe when only one plain link does. |
| `scope/wrong-scope-for-effect` | error | An effect in a scope its scope data does not list. | The game's message `wrong_scope_for_effect_X_expected_X`: "Wrong scope for effect: &lt;scope&gt;, expected &lt;scopes it takes&gt;" | Safe or a suggestion: The effect wrapped in a link that leads to a scope it takes, where at most five do; safe when only one plain link does. |
| `scope/wrong-scope-for-trigger` | error | A trigger in a scope its scope data does not list. | The game's message `wrong_scope_for_trigger_X_expected_X`: "Wrong scope for trigger: &lt;scope&gt;, expected &lt;scopes it takes&gt;" | Safe or a suggestion: The trigger wrapped in a link that leads to a scope it takes, where at most five do; safe when only one plain link does. |
| `scope/saved-late-read-in-desc` | information | A scope read in an event's description that the event saves only after its window is shown. | Advice: pychivalry's own, with no game message | None: moving the save is a change of what the event does. |
| `scope/undefined-event-target` | information | `scope:name` with no effect saving `name` in the file, the mod or the base game. | The game's message `undefined_event_target_X`: "Undefined event target '&lt;saved scope&gt;'" | None: the name may be saved where the index cannot see, and which save is meant is a choice. |

## structure

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `structure/event-non-character-shown` | error | An event whose scope is not a character and that is neither hidden nor major. | The game's message `error_in_event_X_non_character_events_must_be_hidden_or_be_n`: "Error in event '&lt;event id&gt;'. Non-character events must be hidden, or be narrative events" | Suggestion: Each keyword the game's message names written as '= yes' (hidden, major). |
| `structure/range-min-above-max` | error | A range whose minimum is above its maximum. | The game's message `min_value_in_range_directive_is_larger_than_the_max_value_un`: "min value in range directive is larger than the max value. Unknown location; yell at a programmer" | Safe: The two bounds written low first. |
| `structure/event-undeclared-namespace` | warning | An event whose namespace its file does not declare. | The game's message `namespace_X_used_in_event_X_file_X_is_not_defined_in_this_fi`: "Namespace '&lt;namespace&gt;' used in event '&lt;event id&gt;' (file: &lt;file&gt;) is not defined in this file - it might not load properly." | Suggestion: The id written with a declared namespace near it, where that id is free; or the namespace declared at the top of the file. |
| `structure/casus-belli-without-outcome` | information | A casus belli with none of its outcome effects. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/else-without-if` | information | An else branch not directly after the conditional it belongs to. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/event-after-without-option` | information | An event that is not hidden, has an after block and no option. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/event-empty` | information | An event with nothing in it. | Advice: pychivalry's own, with no game message | None: removing the event deletes a definition that may be named elsewhere. |
| `structure/event-letter-without-sender` | information | A letter event without a sender. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/event-portrait-position-twice` | information | One portrait position given twice in an event. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/event-several-after` | information | An event with more than one after block. | Advice: pychivalry's own, with no game message | None: merging the blocks changes the order effects run in. |
| `structure/event-several-immediate` | information | An event with more than one immediate block. | Advice: pychivalry's own, with no game message | None: merging the blocks changes the order effects run in. |
| `structure/event-triggered-animation-without-animation` | information | A triggered animation with no animation. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/event-triggered-animation-without-trigger` | information | A portrait's triggered animation without a trigger. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/event-unknown-type` | information | An event type the game does not document. | Advice: pychivalry's own, with no game message | Suggestion: The documented event types near the one written. |
| `structure/event-without-desc` | information | An event that is not hidden and has no description. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/event-without-option` | information | An event that is not hidden and has no option. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/logic-operator-without-block` | information | A logical operator with a single value instead of a block. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/namespace-outside-events` | information | A file outside the event folder that declares a namespace. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/round-to-not-positive` | information | A rounding step of zero or a negative number. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-chance-above-100` | information | A story cycle's effect group whose chance is above 100. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-chance-not-positive` | information | A story cycle's effect group whose chance is zero or less. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-several-timings` | information | A story cycle's effect group with more than one interval. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-without-effect` | information | A story cycle's effect group with no effect to run. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-without-timing` | information | A story cycle's effect group with no interval. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/switch-without-branches` | information | A switch block with no branch. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/switch-without-trigger` | information | A switch block without the trigger its cases are values of. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |
| `structure/trigger-else-without-trigger-if` | information | A trigger else branch not directly after the conditional it belongs to. | Advice: pychivalry's own, with no game message | None: the right change is a choice of content the data does not make. |

## style

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `style/not-formatted` | warning | A file that is not in pychivalry's format: one finding a file, whose fix formats the whole file. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: The whole file formatted: only the whitespace between tokens changes. |
| `style/not-utf8` | warning | A file that is not valid UTF-8; its fix converts it to UTF-8 with a byte-order mark, reading the bytes that are not as Windows-1252. | Best practice: pychivalry's own best-practice rules, with no game message; the base game follows each more often than it breaks it | Safe or a suggestion: The file written as UTF-8 with a byte-order mark, its other bytes read as Windows-1252; safe when each such byte reads as a printable character and the file then reads to the same tree. |
| `style/blank-lines` | hint | Blank lines beyond one between two items, or any after '{', before '}' or at either end of the file. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: The blank lines the format does not keep removed. |
| `style/block-layout` | hint | A block laid out otherwise than the format says: on one line when it holds one simple pair, plain values or nothing and fits in 120 columns, otherwise over several lines, one item a line; a pair on one line. One finding a block. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: The block laid out as the format says: joined onto one line, or one item a line. |
| `style/byte-order-mark` | hint | A file that does not start with the UTF-8 byte-order mark. One finding a file. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: The UTF-8 byte-order mark added. |
| `style/comment-spacing` | hint | A comment at the end of a line not one space after the code before it. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: One space before the comment. |
| `style/deep-nesting` | hint | A record with a block nested more than six blocks deep, its body the first: one finding a record, at the first such block; release 2.3.0's CK3317. | Best practice: pychivalry's own best-practice rules, with no game message; the base game follows each more often than it breaks it | None: how to restructure deep script is a choice. |
| `style/empty-block` | hint | A block inside a record with nothing in it, or nothing but comments: release 2.3.0's CK3314. | Best practice: pychivalry's own best-practice rules, with no game message; the base game follows each more often than it breaks it | Suggestion: The empty pair taken away, where the block around it keeps something; whether an empty block means something is the author's to say. |
| `style/indentation` | hint | A line indented otherwise than the format says: one tab for each enclosing block in a script file, one space before an entry or a comment in a localization file. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: The line indented as the format says. |
| `style/line-endings` | hint | Line breaks other than Windows line breaks (\r\n), or none at the end of the file. One finding a file. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: Every line break written as \r\n, and one at the end of the file. |
| `style/spacing` | hint | Two tokens on a line not one space apart (around an operator, inside the braces of a block on one line, between values; an empty block's braces with nothing between them), or an entry's key and its text not one space apart. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: One space between the two tokens, or none between the braces of an empty block. |
| `style/trailing-whitespace` | hint | Spaces or tabs at the end of a line, or on a blank line. | pychivalry's own formatting rules (docs/formatting.md), not the game: by the owner's decision, the one kind of warning that rests on them | Safe: The spaces and tabs at the end of the line removed. |
| `style/unusual-field-order` | hint | A record whose fields are written in another order than its folder's usual one, in a folder whose records' fields the game reads by name. | Best practice: pychivalry's own best-practice rules, with no game message; the base game follows each more often than it breaks it | Safe: The record's fields written in the usual order, comments with their field; none where a comment's field is not clear. |

## syntax

| Code | Severity | What it finds | Evidence | Fix |
| --- | --- | --- | --- | --- |
| `syntax/block-without-key` | error | A block at the top level of the file with no key in front of it. | The game's message `unexpected_token_expected_key`: "Unexpected token, expected 'key = {'" | None: the block's name is a choice. |
| `syntax/missing-closing-brace` | error | A block is still open at the end of the file: its '}' is missing. | The game's message `expected_after_arguments`: "Expected } after arguments" | Suggestion: A '}' where the indentation says the block ends, or at the end of the file. |
| `syntax/missing-equals-before-block` | error | A block written as 'name { ... }' among statements, with the '=' missing; read as 'name = { ... }'. | The game's message `expected_between_block_name_and_body`: "Expected '=' between block name and body" | Safe: The '=' written between the name and its block, as the parser reads it. |
| `syntax/missing-operator` | error | A key at the top level of the file with no operator after it; the finding is at the token found where '=' belongs. | The game's message `unexpected_token_X_found_at_X_expected`: "Unexpected token '&lt;token&gt;' found at '&lt;file:line&gt;', '=' expected" | Safe: The '=' written between the key and the value on its line. |
| `syntax/missing-value` | error | An operator with no value after it. | The game's message `expected_between_equals_and_arguments`: "Expected '{' between equals and arguments" | None: the value is a choice. |
| `syntax/null-safe-operator-after-value` | error | '?=' after something that is not a name or a scope chain. | The game's message `unexpected_token_X_found_at_X_expected`: "Unexpected token '&lt;token&gt;' found at '&lt;file:line&gt;', '=' expected" | Safe or a suggestion: A quoted name or scope chain written without its quotes (safe); otherwise '?=' written as '='. |
| `syntax/operator-without-key` | error | An operator with no key in front of it. | The game's message `unexpected_token_expected_key`: "Unexpected token, expected 'key = {'" | None: the key is a choice. |
| `syntax/unexpected-closing-brace` | error | A '}' at the top level of the file, where no block is open. | The game's message `unexpected_token_expected_key`: "Unexpected token, expected 'key = {'" | Safe: The '}' that closes no block taken away: the file reads as before. |
| `syntax/malformed-arithmetic` | information | Malformed inline expression '@[&lt;expression&gt;]': &lt;reason&gt; | Advice: pychivalry's own, with no game message | None: what the expression should compute is a choice. |
| `syntax/unterminated-string` | information | Unterminated string starting at '&lt;file:line&gt;' | Advice: pychivalry's own, with no game message | None: where the text ends is a choice, and closing it at the end of its line can make a key of text cut off mid-edit. |
