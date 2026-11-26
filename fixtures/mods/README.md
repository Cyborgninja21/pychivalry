# Fixture mods

Small hand-written mods, one behaviour each. One folder per mod, named for what it shows.

```text
fixtures/mods/<name>/
  README.md        what it shows, and what a correct tool reports on it
  descriptor.mod
  common/ events/ localization/ ...   the game's own layout
  expected.json    where a test compares whole output: the findings a correct tool reports
```

A parser fixture's `expected.json` maps each script file, by its path inside the mod, to the
findings a correct parser reports on it and, for most, its tree:

```json
{ "files": { "events/fixture_events.txt": {
    "findings": [ { "id": "syntax/missing-closing-brace", "severity": "error",
                    "line": 3, "column": 16, "message": "Expected } after arguments" } ],
    "tree": "namespace = fixture fixture.0001 = { ..." } } }
```

`line` and `column` count from 1, as an editor shows them. The message is rendered with the
committed spec's catalogue. The tree is the one-line summary of
`packages/core/src/syntax/testing.ts`: pairs as `key op value`, blocks as `{ ... }` (an open
block has no `}`), comments in parentheses, a name before a key as `<name>`, and a missing
operator or value as `<none>`.

An index fixture's `expected.json` (build step 3) says what a correct index answers. For the
override-rules mods, a list of `cases`: per name of a database, the rule of docs/overrides.md
that decides it, the `status` (`single`, `winner`, `all`, `statements`, `clash`, `not-read` or
`unknown`), the `winner` and every definition with its `layer`, `file`, `line` and `read`. A
case that holds on one platform only (letter case in paths, rule 9) names it in `platforms`. For
`index-definitions-and-uses`, every `definition` and every `use` of each defined name, with
`line` and `column`.

## Check pairs

A check is tested on a pair of mods: one it fires on and one it is silent on.

```text
fixtures/mods/<check-name>-bad/
fixtures/mods/<check-name>-good/
```

The good mod differs from the bad one only in the defect. The check inventory
(`docs/checks.md`, build step 4) names the pair of every check.

A bad mod's `expected.json` lists every finding of its own check and of every engine check that
is not advice, so that it shows its one behaviour only; the good mod has none of those, and no
`expected.json`. The advice checks of item 4.7 are tested on their own pairs, so another
check's pair leaves their findings out (the fixtures of items 4.2, 4.4 and 4.5 carry the fields
those checks look for; one good mod, `references-unknown-key-good`, still raises advice
findings, a question for the owner in docs/decisions.md):

```json
{ "findings": [ { "file": "common/scripted_triggers/fixture_triggers.txt", "line": 16,
    "column": 2, "code": "names/unknown-trigger", "severity": "error",
    "message": "Unknown trigger 'fixture_made_up_trigger'",
    "data": { "name": "fixture_made_up_trigger" } } ] }
```

`message` is rendered with the committed spec's catalogue; `data` is the finding's data. The
check's test (`packages/core/src/check/<name>.test.ts`) indexes the mod on its own, with no
base game, so a name the mod calls must be defined in the mod. The pairs of the three checks
that report nothing without a base game (`scope/undefined-event-target`,
`localization/missing-key`, `localization/unused-key`) are read over the game stub
[event-targets-and-localization](../game/event-targets-and-localization/README.md) instead
(`PAIR_GAMES` in `packages/core/src/check/testing.ts`). Every bad mod is also checked with no
game folder at all, to show that no finding then depends on a name the base game might define
(`packages/core/src/check/limits.test.ts`).

The `style/` pairs (item 8.2) are the formatter's and the best-practice rules': their
`expected.json` lists the `style/` findings of the bad half alone, read with no base game
(`packages/core/src/check/style.test.ts` and each best-practice rule's own test), and the good half
has none. The tests of every other check leave the family out.

**Every mod here is in pychivalry's format** (Windows line breaks, the UTF-8 byte-order mark, the
formatter's layout; the owner's word of 2026-11-23), but for exactly what a mod exists to test,
which it keeps byte for byte: a file with a parse error (the `parse-*` mods, which the formatter
leaves as they are), a file not valid UTF-8 (`encoding-windows-1252`, `style-not-utf8-bad`), the
bad half of each `style/` pair, and the three localization files written without the byte-order
mark (in `localization-missing-key-bad`, `-good` and `override-rules`), which are in the format
but for the mark. `packages/core/src/format/fixtures.test.ts` holds it; `.gitattributes` keeps the
bytes of every script and localization file exact. `descriptor.mod`, the READMEs and the
`expected.json` files are not CK3 script and keep their `\n` line breaks.

## Carried over from release 2.3.0

The old tests' fixture mods are data and are carried over by the step that owns the behaviour,
rewritten to this layout. Where one is carried over, its README says which file under
`legacy/` it came from.

## The mods

| Mod | What it shows | Added by |
| --- | --- | --- |
| [definitions-clash-bad](definitions-clash-bad/README.md), [-good](definitions-clash-good/README.md) | One event id, `fixture.0001`, defined in two files with the same `id_override_priority` (none written, so the default) | Item 4.5 |
| [definitions-not-read-bad](definitions-not-read-bad/README.md), [-good](definitions-not-read-good/README.md) | A decision group in a folder written in upper case, `common/DECISION_GROUP_TYPES` | Item 4.5 |
| [encoding-windows-1252](encoding-windows-1252/README.md) | A file that is not valid UTF-8, read with and without the Windows-1252 fallback | Step 2 |
| [fields-bare-value-in-record-bad](fields-bare-value-in-record-bad/README.md), [-good](fields-bare-value-in-record-good/README.md) | Two bare values written directly in a record body that holds `key = value` statements | Item 4.5 |
| [fields-missing-required-field-bad](fields-missing-required-field-bad/README.md), [-good](fields-missing-required-field-good/README.md) | The spec package marks three fields required, each with the game's own message: a casus belli's `on_invalidated_desc`, an interaction category's `index` and a tutorial lesson's `chain` | Item 4.5 |
| [fields-unknown-field-bad](fields-unknown-field-bad/README.md), [-good](fields-unknown-field-good/README.md) | A decision group with a field, `fixture_made_up_field`, that the record schema of `common/decision_group_types` does not list and that Paradox's `.info` files do not document | Item 4.5 |
| [fields-unusual-value-bad](fields-unusual-value-bad/README.md), [-good](fields-unusual-value-good/README.md) | A nickname with `is_bad = no`; the base game writes only `yes` in `is_bad` | Item 4.7 |
| [fields-usually-present-bad](fields-usually-present-bad/README.md), [-good](fields-usually-present-good/README.md) | A death reason without `icon`, which every one of the base game's 326 death reasons sets | Item 4.7 |
| [fields-wrong-kind-of-value-bad](fields-wrong-kind-of-value-bad/README.md), [-good](fields-wrong-kind-of-value-good/README.md) | In `common/decision_group_types`, whose `sort_order` the base game writes only as whole numbers, `important_decision_group` only as `yes` or `no`, and `gui_tags` only as a list, a record writes a word for the number (`ten`), `maybe` for the yes-or-no, and one word for the list | Item 4.5 |
| [fix-near-values](fix-near-values/README.md) | Three values of advice findings, each a misspelling of exactly one value its place takes (`character_evnt`, `fixture_idel`, `yess`): each fix is a suggestion of that value, since advice is never fixed safely; read over the stub `planted-defects` | Item 8.6 (#146) |
| [fix-scope-links](fix-scope-links/README.md) | The fixes of the scope findings: an effect one plain link away (a safe fix wrapping it in `dynasty`), one two links away (a suggestion of both), a link that needs a link before it; read over the stub `planted-defects` | Item 8.6 (#146) |
| [index-definitions-and-uses](index-definitions-and-uses/README.md) | One definition of every form, and every way a word is a use | Step 3 |
| [localization-missing-key-bad](localization-missing-key-bad/README.md), [-good](localization-missing-key-good/README.md) | Localization keys, in fields that hold one and that a record has by its name, defined in no localization file; read over the stub [event-targets-and-localization](../game/event-targets-and-localization/README.md) | Item 4.6 |
| [localization-unbalanced-brackets-bad](localization-unbalanced-brackets-bad/README.md), [-good](localization-unbalanced-brackets-good/README.md) | Localization text with an extra `[` and with an extra `]`; since format 9 a `[`, a `(`, a `'` and a `$` left open, and a `]` inside an open parenthesis, which is not decided | Item 4.6 (format 9) |
| [localization-unused-key-bad](localization-unused-key-bad/README.md), [-good](localization-unused-key-good/README.md) | A key the mod defines that nothing in the mod or the base game uses; read over the stub [event-targets-and-localization](../game/event-targets-and-localization/README.md) | Item 4.6 |
| [lookup-definitions-and-uses](lookup-definitions-and-uses/README.md) | Definitions and uses of every kind of name lookup answers, read over the stub [game/lookup](../game/lookup/README.md) | Item 4.8 |
| [names-modifier-outside-use-area-bad](names-modifier-outside-use-area-bad/README.md), [-good](names-modifier-outside-use-area-good/README.md) | An era's character, county and province blocks, each with a modifier of another use area | Item 4.2 |
| [names-unknown-effect-bad](names-unknown-effect-bad/README.md), [-good](names-unknown-effect-good/README.md) | Keys in effect blocks that are no effect: made up, a trigger, an iterator over no list, removed, a scripted effect defined nowhere | Item 4.2 |
| [names-unknown-link-bad](names-unknown-link-bad/README.md), [-good](names-unknown-link-good/README.md) | Scope chains with a segment that is no link, as a key and as a value | Item 4.2 |
| [names-unknown-modifier-bad](names-unknown-modifier-bad/README.md), [-good](names-unknown-modifier-good/README.md) | A modifier block with a made-up and a removed modifier; a template and a marked-only name | Item 4.2 |
| [names-unknown-on-action-bad](names-unknown-on-action-bad/README.md), [-good](names-unknown-on-action-good/README.md) | On-actions named nowhere, in an on-action's lists and fallback and in `trigger_event` | Item 4.2 |
| [names-unknown-trigger-bad](names-unknown-trigger-bad/README.md), [-good](names-unknown-trigger-good/README.md) | Keys in trigger blocks that are no trigger: made up, an effect, an iterator over no list, removed, a scripted trigger defined nowhere. In pychivalry's format since item 8.2 (`\r\n`, the byte-order mark), so that the command line's tests show no `style/` finding | Item 4.2 |
| [override-rules](override-rules/README.md) | Every rule of docs/overrides.md one mod can exercise, over the stub `game/override-rules` | Step 3 |
| [override-rules-folder-case](override-rules-folder-case/README.md) | A folder spelled in upper case (rule 9) | Step 3 |
| [override-rules-replace-path](override-rules-replace-path/README.md) | `replace_path` in the descriptor (rule 8) | Step 3 |
| [parse-block-without-key](parse-block-without-key/README.md) | A block at the top level with no key | Step 2 |
| [parse-broken-syntax](parse-broken-syntax/README.md) | Five errors in one file; carried over from 2.3.0's `broken_syntax` | Step 2 |
| [parse-cut-off-mid-edit](parse-cut-off-mid-edit/README.md) | Text cut off at seven places in the middle of an edit | Step 2 |
| [parse-malformed-arithmetic](parse-malformed-arithmetic/README.md) | `@[ ... ]` malformed or unclosed | Step 2 |
| [parse-missing-closing-brace](parse-missing-closing-brace/README.md) | A block still open at the end of the file | Step 2 |
| [parse-missing-equals-before-block](parse-missing-equals-before-block/README.md) | `name { ... }` without its `=`, the base game's own defect | Step 2 |
| [parse-missing-operator](parse-missing-operator/README.md) | A top-level key with no operator, and a token not reported twice | Step 2 |
| [parse-missing-value](parse-missing-value/README.md) | An operator with no value after it | Step 2 |
| [parse-null-safe-after-value](parse-null-safe-after-value/README.md) | `?=` after a date | Step 2 |
| [parse-operator-without-key](parse-operator-without-key/README.md) | An operator with no key | Step 2 |
| [parse-unexpected-closing-brace](parse-unexpected-closing-brace/README.md) | A `}` with no block open | Step 2 |
| [parse-unterminated-string](parse-unterminated-string/README.md) | Quoted text without its closing quote | Step 2 |
| [presentation-outline-and-hints](presentation-outline-and-hints/README.md) | The language server's use of the presentation data: outline rules, snippets and field order in completion, and inline hints, each answer listed in its README; read over an empty game stub | Item 8.8 (#144) |
| [references-unknown-key-bad](references-unknown-key-bad/README.md), [-good](references-unknown-key-good/README.md) | Two places part D6 of the spec package confirms hold a key of a database: a dynasty house's `dynasty` (a key of `common/dynasties`) and the value of the trigger `has_cultural_tradition` (a key of `common/culture/traditions`) | Item 4.5 |
| [references-unknown-name-bad](references-unknown-name-bad/README.md), [-good](references-unknown-name-good/README.md) | An event portrait whose `animation` is `fixture_missing`, which nothing defines; the mod defines `fixture_idle` in `gfx/portraits/portrait_animations` | Item 4.7 |
| [scope-link-on-wrong-scope-bad](scope-link-on-wrong-scope-bad/README.md), [-good](scope-link-on-wrong-scope-good/README.md) | Links applied to a scope they cannot start from, in a decision whose root is a character: `holder` (a link of titles) as a block key, `liege` (a link of characters) after `primary_title` in a chain written as a key, `holder` after `root` in a chain written as the value of `is_vassal_of`, and `title_province` (a link of titles) after `capital_province` | Item 4.4 |
| [scope-saved-late-read-in-desc-bad](scope-saved-late-read-in-desc-bad/README.md), [-good](scope-saved-late-read-in-desc-good/README.md) | An event whose `desc` selects on `scope:fixture_mood` (its `switch`), a scope the event saves only in its option | Item 4.7 |
| [scope-title-text-reads-scope-saved-late-bad](scope-title-text-reads-scope-saved-late-bad/README.md), [-good](scope-title-text-reads-scope-saved-late-good/README.md) | An event whose dynamic `title` reads `fixture_rival`, saved only in its option, through the head of a chain and through `TopScope.sC` | Item 4.7 (format 9) |
| [scope-undefined-event-target-bad](scope-undefined-event-target-bad/README.md), [-good](scope-undefined-event-target-good/README.md) | `scope:` reads of names no effect saves in the file, the mod or the base game; read over the stub [event-targets-and-localization](../game/event-targets-and-localization/README.md) | Item 4.6 |
| [scope-wrong-scope-for-effect-bad](scope-wrong-scope-for-effect-bad/README.md), [-good](scope-wrong-scope-for-effect-good/README.md) | Effects written in a scope their scope data does not list, in a character event: `add_county_modifier` at the root, `add_gold` and the iterator `every_vassal` after the link `primary_title`, and `add_trait` in an option after the link `capital_province` | Item 4.4 |
| [scope-wrong-scope-for-trigger-bad](scope-wrong-scope-for-trigger-bad/README.md), [-good](scope-wrong-scope-for-trigger-good/README.md) | Triggers written in a scope their scope data does not list: in a decision, whose root is a character, `tier` at the root, `is_adult` and the iterator `any_vassal` after the link `primary_title`, `has_trait` in the iterator `any_held_title`, and `has_county_modifier` after the link `capital_province`; in an event whose `scope = province` makes its root a province, `is_adult` | Item 4.4 |
| [style-blank-lines-bad](style-blank-lines-bad/README.md), [-good](style-blank-lines-good/README.md) | Blank lines the format does not keep: at the start, after `{`, before `}`, three in a row, at the end; and in a localization file | Item 8.2 |
| [style-block-layout-bad](style-block-layout-bad/README.md), [-good](style-block-layout-good/README.md) | A block of two pairs on one line, a block of one simple pair over several lines, an `if` whose `{` is on the line after its `=` | Item 8.2 |
| [style-byte-order-mark-bad](style-byte-order-mark-bad/README.md), [-good](style-byte-order-mark-good/README.md) | A script file without the UTF-8 byte-order mark | Item 8.2 |
| [style-comment-spacing-bad](style-comment-spacing-bad/README.md), [-good](style-comment-spacing-good/README.md) | Comments at the end of a line after two tabs and after no space | Item 8.2 |
| [style-deep-nesting-bad](style-deep-nesting-bad/README.md), [-good](style-deep-nesting-good/README.md) | A scripted effect whose `limit` is seven blocks deep, one past the limit; in the format | Step 8 (#148) |
| [style-empty-block-bad](style-empty-block-bad/README.md), [-good](style-empty-block-good/README.md) | An empty `limit` (a suggestion takes it away) and an `else` holding only a comment; in the format | Step 8 (#148) |
| [style-localization-key-characters-bad](style-localization-key-characters-bad/README.md), [-good](style-localization-key-characters-good/README.md) | Two localization keys that break the key rule of release 2.3.0's LOC-001 (a dash, a leading digit) beside one that keeps it, each shown by a `custom_tooltip` | Step 8 (decision 112) |
| [style-indentation-bad](style-indentation-bad/README.md), [-good](style-indentation-good/README.md) | Lines indented with spaces, too many tabs, a space at the top level; localization lines with a tab, nothing, three spaces | Item 8.2 |
| [style-line-endings-bad](style-line-endings-bad/README.md), [-good](style-line-endings-good/README.md) | A script file with `\n` line breaks, and a localization file with no line break at its end | Item 8.2 |
| [style-not-formatted-bad](style-not-formatted-bad/README.md), [-good](style-not-formatted-good/README.md) | A file of scripted effects written without the format's layout, line breaks and mark: the warning and its hints | Item 8.2 |
| [style-option-without-ai-weight-bad](style-option-without-ai-weight-bad/README.md), [-good](style-option-without-ai-weight-good/README.md) | A shown event with two options, the second with neither `ai_chance` nor `ai_will_select`; an event with one option, not judged; in the format | Step 8 (format 9) |
| [style-not-utf8-bad](style-not-utf8-bad/README.md), [-good](style-not-utf8-good/README.md) | A scripted effect and a localization file each holding a Windows-1252 `é`: the warning, its safe conversion, the note beside it; bytes exact | Step 8 (#148) |
| [style-redundant-condition-bad](style-redundant-condition-bad/README.md), [-good](style-redundant-condition-good/README.md) | An `AND` and a `NAND` each holding `always = yes` beside two other conditions: a safe fix takes each away; in the format | Step 8 (format 9) |
| [style-redundant-false-condition-bad](style-redundant-false-condition-bad/README.md), [-good](style-redundant-false-condition-good/README.md) | An `OR`, a `NOR` and an `all_false` each holding `always = no` beside two other conditions: a safe fix takes each away; in the format | Step 8 (decision 158) |
| [style-spacing-bad](style-spacing-bad/README.md), [-good](style-spacing-good/README.md) | Tokens not one space apart (`add_gold=10`, `{is_adult  = yes}`); localization keys and their text three spaces and no space apart | Item 8.2 |
| [style-trailing-whitespace-bad](style-trailing-whitespace-bad/README.md), [-good](style-trailing-whitespace-good/README.md) | Spaces and tabs at the end of lines, of a comment, on a blank line; and in a localization file | Item 8.2 |
| [style-unusual-field-order-bad](style-unusual-field-order-bad/README.md), [-good](style-unusual-field-order-good/README.md) | On-actions writing `effect` before `trigger`: a safe reorder with its comments, and none where a comment's field is unclear; in the format | Step 8 (#148) |
| [structure-casus-belli-without-outcome-bad](structure-casus-belli-without-outcome-bad/README.md), [-good](structure-casus-belli-without-outcome-good/README.md) | A casus belli with its descriptions and none of `on_victory`, `on_defeat`, `on_white_peace` | Item 4.7 |
| [structure-else-without-if-bad](structure-else-without-if-bad/README.md), [-good](structure-else-without-if-good/README.md) | A scripted effect whose `else` follows an effect, not an `if` or `else_if` | Item 4.7 |
| [structure-event-after-without-option-bad](structure-event-after-without-option-bad/README.md), [-good](structure-event-after-without-option-good/README.md) | An event that is not hidden, with an `after` and no `option` | Item 4.7 |
| [structure-event-empty-bad](structure-event-empty-bad/README.md), [-good](structure-event-empty-good/README.md) | An event with nothing in it | Item 4.7 |
| [structure-event-letter-without-sender-bad](structure-event-letter-without-sender-bad/README.md), [-good](structure-event-letter-without-sender-good/README.md) | A letter event (`type = letter_event`) without `sender` | Item 4.7 |
| [structure-event-non-character-shown-bad](structure-event-non-character-shown-bad/README.md), [-good](structure-event-non-character-shown-good/README.md) | An event whose `scope` is a faith, not a character, and that is neither `hidden` nor `major` | Item 4.5 |
| [structure-event-portrait-position-twice-bad](structure-event-portrait-position-twice-bad/README.md), [-good](structure-event-portrait-position-twice-good/README.md) | An event that gives `left_portrait` twice | Item 4.7 |
| [structure-event-several-after-bad](structure-event-several-after-bad/README.md), [-good](structure-event-several-after-good/README.md) | An event with two `after` blocks | Item 4.7 |
| [structure-event-several-immediate-bad](structure-event-several-immediate-bad/README.md), [-good](structure-event-several-immediate-good/README.md) | A hidden event with two `immediate` blocks | Item 4.7 |
| [structure-event-triggered-animation-without-animation-bad](structure-event-triggered-animation-without-animation-bad/README.md), [-good](structure-event-triggered-animation-without-animation-good/README.md) | A portrait's `triggered_animation` with a `trigger` and neither `animation` nor `scripted_animation` | Item 4.7 |
| [structure-event-triggered-animation-without-trigger-bad](structure-event-triggered-animation-without-trigger-bad/README.md), [-good](structure-event-triggered-animation-without-trigger-good/README.md) | A portrait's `triggered_animation` with an `animation` and no `trigger` | Item 4.7 |
| [structure-event-undeclared-namespace-bad](structure-event-undeclared-namespace-bad/README.md), [-good](structure-event-undeclared-namespace-good/README.md) | An event whose namespace its file does not declare, beside one whose namespace it does, and a file that declares no namespace at all | Item 4.5 |
| [structure-event-unknown-type-bad](structure-event-unknown-type-bad/README.md), [-good](structure-event-unknown-type-good/README.md) | A hidden event whose `type` is `fixture_event`, no type the events `.info` lists | Item 4.7 |
| [structure-event-without-desc-bad](structure-event-without-desc-bad/README.md), [-good](structure-event-without-desc-good/README.md) | An event that is not hidden, with a title and an option and no `desc` | Item 4.7 |
| [structure-event-without-option-bad](structure-event-without-option-bad/README.md), [-good](structure-event-without-option-good/README.md) | An event that is not hidden, with a title and a `desc` and no `option` | Item 4.7 |
| [structure-logic-operator-without-block-bad](structure-logic-operator-without-block-bad/README.md), [-good](structure-logic-operator-without-block-good/README.md) | A scripted trigger with `NOT = is_adult`: a single value where the operator takes a block of triggers | Item 4.7 |
| [structure-namespace-outside-events-bad](structure-namespace-outside-events-bad/README.md), [-good](structure-namespace-outside-events-good/README.md) | A scripted-effects file that declares `namespace = fixture` | Item 4.7 |
| [structure-range-min-above-max-bad](structure-range-min-above-max-bad/README.md), [-good](structure-range-min-above-max-good/README.md) | Two ranges whose minimum is above their maximum, a script value written as a range and a range inside a formula's `value` | Item 4.5 |
| [structure-round-to-not-positive-bad](structure-round-to-not-positive-bad/README.md), [-good](structure-round-to-not-positive-good/README.md) | A script value with `round_to = 0` | Item 4.7 |
| [structure-story-effect-group-chance-above-100-bad](structure-story-effect-group-chance-above-100-bad/README.md), [-good](structure-story-effect-group-chance-above-100-good/README.md) | A story cycle whose `effect_group` has `chance = 150` | Item 4.7 |
| [structure-story-effect-group-chance-not-positive-bad](structure-story-effect-group-chance-not-positive-bad/README.md), [-good](structure-story-effect-group-chance-not-positive-good/README.md) | A story cycle whose `effect_group` has `chance = 0` | Item 4.7 |
| [structure-story-effect-group-several-timings-bad](structure-story-effect-group-several-timings-bad/README.md), [-good](structure-story-effect-group-several-timings-good/README.md) | A story cycle whose `effect_group` has both `days` and `months` | Item 4.7 |
| [structure-story-effect-group-without-effect-bad](structure-story-effect-group-without-effect-bad/README.md), [-good](structure-story-effect-group-without-effect-good/README.md) | A story cycle whose `effect_group` has an interval and no `triggered_effect`, `first_valid` or `random_valid` | Item 4.7 |
| [structure-story-effect-group-without-timing-bad](structure-story-effect-group-without-timing-bad/README.md), [-good](structure-story-effect-group-without-timing-good/README.md) | A story cycle whose `effect_group` has none of `days`, `weeks`, `months`, `years` | Item 4.7 |
| [structure-switch-without-branches-bad](structure-switch-without-branches-bad/README.md), [-good](structure-switch-without-branches-good/README.md) | A `switch` with a `trigger` and a `fallback` and no case | Item 4.7 |
| [structure-switch-without-trigger-bad](structure-switch-without-trigger-bad/README.md), [-good](structure-switch-without-trigger-good/README.md) | A `switch` with a case and a fallback and no `trigger` | Item 4.7 |
| [structure-trigger-else-without-trigger-if-bad](structure-trigger-else-without-trigger-if-bad/README.md), [-good](structure-trigger-else-without-trigger-if-good/README.md) | A scripted trigger whose `trigger_else` follows a trigger, not a `trigger_if` or `trigger_else_if` | Item 4.7 |
| [structure-triggered-desc-other-field-bad](structure-triggered-desc-other-field-bad/README.md), [-good](structure-triggered-desc-other-field-good/README.md) | A `triggered_desc` holding a `first_valid` beside its `trigger` and `desc` | Item 4.5 (format 9) |
| [variables-read-without-set-bad](variables-read-without-set-bad/README.md), [-good](variables-read-without-set-good/README.md) | Three variables read in a namespace and as a kind nothing sets them in: a list read as a value, a name set nowhere, a scope variable read as a global one; read over the stub [event-targets-and-localization](../game/event-targets-and-localization/README.md) | Item 4.7 (format 9) |

The recovery test (`packages/core/src/syntax/recovery.test.ts`) reads every `parse-*` mod and
fails if a kind of parse finding has no mod of its own. The incremental re-parse test edits
every `.txt` file here and compares each re-parse with a full parse. The index's fixture test
(`packages/core/src/index/fixtures.test.ts`) reads the `override-rules*` mods and
`index-definitions-and-uses`.
