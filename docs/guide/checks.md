# Checks

<!-- Written by `task docs:checks` from the core's check inventory; do not edit by hand. -->

Every finding pychivalry reports has a code, a family and a name such as
`names/unknown-trigger`. This page lists every code this build reports: its severity, what
it finds and the game's evidence for it, with the game's own message as the spec package's
catalogue for game 1.21.0.3 gives it. `pychivalry explain <code>` prints the same for one
code ([Commands](commands.md)).

62 codes: 21 errors, 6 warnings, 33 information and 2 hints. 28 rest on the game's own evidence; 34 are advice.

- An **error** or a **warning** is something the game itself rejects or complains about, and
  rests on the game's own evidence: a message of the game, the game's own output, or a
  field the spec package marks required with the game's message for it.
- **Information** and **hints** without such evidence are advice: usually right, not
  something the game enforces.
- A file reports at most 1,000 findings, its most severe first; the command line says how
  many it left out.

The full inventory, with the checks still to come and those retired, the release 2.3.0
check each replaces and how each was proved on the base game, is the
[check inventory](../checks.md).

## definitions

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `definitions/clash` | error | Definitions the rules table says the game calls an error. | The game's own message for the duplicate: the catalogue entry the rules table's row for the clash names |
| `definitions/not-read` | information | A definition in a file the rules table says the game does not read. | Advice: pychivalry's own, with no game message |

## encoding

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `encoding/not-utf8` | information | This file is not valid UTF-8 (%s invalid bytes); it was read as %s. | Advice: pychivalry's own, with no game message |

## fields

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `fields/bare-value-in-record` | error | A bare value directly in a record body that holds statements, where the game expects 'key ='; the finding is at the token found where '=' belongs. | The game's message `unexpected_token_X_found_at_X_expected`: "Unexpected token '%s' found at '%s', '=' expected" |
| `fields/missing-required-field` | error | A field the spec package marks required is missing. | The game's own message for the field that is missing, which the spec package gives with each field it marks required |
| `fields/unknown-field` | warning | A field in a record that its folder's field list does not have. | The game's message `unknown_X_in_X`: "Unknown {} in {}" |
| `fields/usually-present` | information | A record without a field that every base-game record of its kind sets. | Advice: pychivalry's own, with no game message |
| `fields/wrong-kind-of-value` | information | A value of another kind than the field takes. | Advice: pychivalry's own, with no game message |
| `fields/unusual-value` | hint | A value no base-game record writes in a field whose values form a small set. | Advice: pychivalry's own, with no game message |

## localization

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `localization/missing-key` | warning | A localization key, in a field that holds one or that a record has by its name, defined in no localization file. | The game's message `unknown_loc_key_X`: "Unknown loc key %s" |
| `localization/unbalanced-brackets` | warning | Localization text with an extra `[` or `]`. | The game's message `loc_key_X_unexpected_extra_at_position_X_file_X`: "Loc key `{}`: Unexpected extra `[` at position {} - file `{}`" |
| `localization/unused-key` | hint | A key the mod defines that nothing in the mod or the base game uses. | Advice: pychivalry's own, with no game message |

## names

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `names/unknown-effect` | error | A key in an effect block that is no effect there. | The game's message `unknown_effect_X`: "Unknown effect '%s'" |
| `names/unknown-link` | error | A segment of a scope chain that is no link. | The game's message `failed_to_parse_data_for_event_target_link_link_X_location_X`: "Failed to parse data for event target link. Link: %s, location: %s" |
| `names/unknown-modifier` | error | A key in a modifier block that is no modifier and fills no modifier template. | The game's message `unknown_modifier_type_X_at_X`: "Unknown modifier type '{}' at {}" |
| `names/unknown-on-action` | error | A value naming an on-action the game does not have. | The game's message `unknown_on_action_X`: "Unknown on action: %s" |
| `names/unknown-trigger` | error | A key in a trigger block that is no trigger there. | The game's message `unknown_trigger_X`: "Unknown trigger '%s'" |
| `names/modifier-outside-use-area` | warning | A modifier in a block of a kind its use area does not include. | The game's own output, with no message of its own: buckets.modifiers.<name>.use_areas and modifier_template_tags: the game's own modifier documentation |

## references

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `references/unknown-key` | warning | A value that should be a key of a database names no key of it in the mod, the base game or a DLC. | The game's message `failed_to_read_key_reference_X_from_database_X`: "Failed to read key reference %s from database %s" |
| `references/unknown-name` | information | A value naming a definition the index does not hold, where no game message is known. | Advice: pychivalry's own, with no game message |

## scope

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `scope/link-on-wrong-scope` | error | A link applied to a scope it cannot start from. | The game's message `trying_to_use_X_link_on_an_invalid_scope_X`: "Trying to use %s link on an invalid scope %s" |
| `scope/wrong-scope-for-effect` | error | An effect in a scope its scope data does not list. | The game's message `wrong_scope_for_effect_X_expected_X`: "Wrong scope for effect: %s, expected %s" |
| `scope/wrong-scope-for-trigger` | error | A trigger in a scope its scope data does not list. | The game's message `wrong_scope_for_trigger_X_expected_X`: "Wrong scope for trigger: %s, expected %s" |
| `scope/saved-late-read-in-desc` | information | A scope read in an event's description that the event saves only after its window is shown. | Advice: pychivalry's own, with no game message |
| `scope/undefined-event-target` | information | `scope:name` with no effect saving `name` in the file, the mod or the base game. | The game's message `undefined_event_target_X`: "Undefined event target '%s'" |

## structure

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `structure/event-non-character-shown` | error | An event whose scope is not a character and that is neither hidden nor major. | The game's message `error_in_event_X_non_character_events_must_be_hidden_or_be_n`: "Error in event '{}'. Non-character events must be hidden, or be narrative events" |
| `structure/range-min-above-max` | error | A range whose minimum is above its maximum. | The game's message `min_value_in_range_directive_is_larger_than_the_max_value_un`: "min value in range directive is larger than the max value. Unknown location; yell at a programmer" |
| `structure/event-undeclared-namespace` | warning | An event whose namespace its file does not declare. | The game's message `namespace_X_used_in_event_X_file_X_is_not_defined_in_this_fi`: "Namespace '{}' used in event '{}' (file: {}) is not defined in this file - it might not load properly." |
| `structure/casus-belli-without-outcome` | information | A casus belli with none of its outcome effects. | Advice: pychivalry's own, with no game message |
| `structure/else-without-if` | information | An else branch not directly after the conditional it belongs to. | Advice: pychivalry's own, with no game message |
| `structure/event-after-without-option` | information | An event that is not hidden, has an after block and no option. | Advice: pychivalry's own, with no game message |
| `structure/event-empty` | information | An event with nothing in it. | Advice: pychivalry's own, with no game message |
| `structure/event-letter-without-sender` | information | A letter event without a sender. | Advice: pychivalry's own, with no game message |
| `structure/event-portrait-position-twice` | information | One portrait position given twice in an event. | Advice: pychivalry's own, with no game message |
| `structure/event-several-after` | information | An event with more than one after block. | Advice: pychivalry's own, with no game message |
| `structure/event-several-immediate` | information | An event with more than one immediate block. | Advice: pychivalry's own, with no game message |
| `structure/event-triggered-animation-without-animation` | information | A triggered animation with no animation. | Advice: pychivalry's own, with no game message |
| `structure/event-triggered-animation-without-trigger` | information | A portrait's triggered animation without a trigger. | Advice: pychivalry's own, with no game message |
| `structure/event-unknown-type` | information | An event type the game does not document. | Advice: pychivalry's own, with no game message |
| `structure/event-without-desc` | information | An event that is not hidden and has no description. | Advice: pychivalry's own, with no game message |
| `structure/event-without-option` | information | An event that is not hidden and has no option. | Advice: pychivalry's own, with no game message |
| `structure/logic-operator-without-block` | information | A logical operator with a single value instead of a block. | Advice: pychivalry's own, with no game message |
| `structure/namespace-outside-events` | information | A file outside the event folder that declares a namespace. | Advice: pychivalry's own, with no game message |
| `structure/round-to-not-positive` | information | A rounding step of zero or a negative number. | Advice: pychivalry's own, with no game message |
| `structure/story-effect-group-chance-above-100` | information | A story cycle's effect group whose chance is above 100. | Advice: pychivalry's own, with no game message |
| `structure/story-effect-group-chance-not-positive` | information | A story cycle's effect group whose chance is zero or less. | Advice: pychivalry's own, with no game message |
| `structure/story-effect-group-several-timings` | information | A story cycle's effect group with more than one interval. | Advice: pychivalry's own, with no game message |
| `structure/story-effect-group-without-effect` | information | A story cycle's effect group with no effect to run. | Advice: pychivalry's own, with no game message |
| `structure/story-effect-group-without-timing` | information | A story cycle's effect group with no interval. | Advice: pychivalry's own, with no game message |
| `structure/switch-without-branches` | information | A switch block with no branch. | Advice: pychivalry's own, with no game message |
| `structure/switch-without-trigger` | information | A switch block without the trigger its cases are values of. | Advice: pychivalry's own, with no game message |
| `structure/trigger-else-without-trigger-if` | information | A trigger else branch not directly after the conditional it belongs to. | Advice: pychivalry's own, with no game message |

## syntax

| Code | Severity | What it finds | Evidence |
| --- | --- | --- | --- |
| `syntax/block-without-key` | error | A block at the top level of the file with no key in front of it. | The game's message `unexpected_token_expected_key`: "Unexpected token, expected 'key = {'" |
| `syntax/missing-closing-brace` | error | A block is still open at the end of the file: its '}' is missing. | The game's message `expected_after_arguments`: "Expected } after arguments" |
| `syntax/missing-equals-before-block` | error | A block written as 'name { ... }' among statements, with the '=' missing; read as 'name = { ... }'. | The game's message `expected_between_block_name_and_body`: "Expected '=' between block name and body" |
| `syntax/missing-operator` | error | A key at the top level of the file with no operator after it; the finding is at the token found where '=' belongs. | The game's message `unexpected_token_X_found_at_X_expected`: "Unexpected token '%s' found at '%s', '=' expected" |
| `syntax/missing-value` | error | An operator with no value after it. | The game's message `expected_between_equals_and_arguments`: "Expected '{' between equals and arguments" |
| `syntax/null-safe-operator-after-value` | error | '?=' after something that is not a name or a scope chain. | The game's message `unexpected_token_X_found_at_X_expected`: "Unexpected token '%s' found at '%s', '=' expected" |
| `syntax/operator-without-key` | error | An operator with no key in front of it. | The game's message `unexpected_token_expected_key`: "Unexpected token, expected 'key = {'" |
| `syntax/unexpected-closing-brace` | error | A '}' at the top level of the file, where no block is open. | The game's message `unexpected_token_expected_key`: "Unexpected token, expected 'key = {'" |
| `syntax/malformed-arithmetic` | information | Malformed inline expression '@[%s]': %s | Advice: pychivalry's own, with no game message |
| `syntax/unterminated-string` | information | Unterminated string starting at '%s' | Advice: pychivalry's own, with no game message |
