# The check inventory and its codes

> **Signed off by the owner on 2026-11-21** ([decisions 45 to 55](decisions.md#log)). The code
> scheme, the twelve families and the code names on this page are permanent from that date: a
> code is never renamed and never reused. A check that is dropped or changed is retired. This
> page is build item 4.1 of [PLAN.md](PLAN.md#step-4-engine-checks-and-lookup). Built so far:
> every row of step 4, and the eleven provisional advice rows item 4.7's re-proof retired: since
> the checks the spec package's format 9 unblocked (2026-11-25), 64 rows are built (four of them
> in part), 12 retired, and 3 belong to steps 10 and 11; one of the 64 is new with format 9,
> `variables/read-without-set`, on the package's table of the keywords of variables. On the
> owner's word of 2026-11-23 (decisions 101 and 103) step 8 added a thirteenth family, `style`,
> whose nine formatting rows are built and rest on pychivalry's own formatting rules
> ([Formatting](#formatting-the-style-family)); eight more rows of it rest on pychivalry's own
> best-practice rules (decisions 105 to 107, 109, 112 and 158,
> [Best practice](#best-practice-the-style-familys-best-practice-rules)), all built, one of them
> (`style/option-without-ai-weight`, release 2.3.0's CK3613) new with format 9 and one
> (`style/redundant-false-condition`) new on the owner's word of 2026-11-25, and
> `localization/unused-key` is on by default (decision 108). Since decision 113 a
> file not valid UTF-8 shows one finding, `style/not-utf8`: the parse note `encoding/not-utf8`
> is retired ([Retired codes](#retired-codes)). Build step 10 added thirteen rows of the family
> `syntax`, the GUI parser's `syntax/gui-*` codes, all built, all advice at information
> ([Step 10: GUI syntax](#step-10-gui-syntax)). The last column of each table, **State**, says which, and why
> where a row is not fully built ([The inventory in numbers](#the-inventory-in-numbers)). What
> was decided is listed at the end, under [What the owner signed off](#what-the-owner-signs-off).

Every check pychivalry ships has one row here: its code, its severity, what it finds, the
evidence that the game raises it (or the word **advice**), the release 2.3.0 check it replaces,
the fixture pair that tests it, the build item that builds it, and what it needs from the spec
package that the committed stand-in lacks. A check is built only if it has a row
([AGENTS.md](../AGENTS.md#how-to-add-a-check)).

Counts on this page were measured on game 1.21.0.3 (Linux) on 2026-11-21 by one-off scripts
that read the game with this repository's own step 2 parser; how is in
[How the counts were made](#how-the-counts-were-made). They are re-measured by the suites of
items 4.7, 4.9 and 4.10 before any check ships.

## Contents

1. [How to read a row](#how-to-read-a-row)
2. [The code scheme](#the-code-scheme)
3. [The inventory](#the-inventory)
4. [The inventory in numbers](#the-inventory-in-numbers)
5. [The step 2 findings](#the-step-2-findings)
6. [The GUI syntax findings](#the-gui-syntax-findings)
7. [Where the executable keeps each message](#where-the-executable-keeps-each-message)
8. [Release 2.3.0's codes, one by one](#release-230s-codes-one-by-one)
9. [The pre-2.0 rules, one by one](#the-pre-20-rules-one-by-one)
10. [The base game's own errors in release 2.3.0](#the-base-games-own-errors-in-release-230)
11. [ck3-tiger and the CWTools rule files](#ck3-tiger-and-the-cwtools-rule-files)
12. [What the inventory needs from the 1.21 spec](#what-the-inventory-needs-from-the-121-spec)
13. [How the counts were made](#how-the-counts-were-made)
14. [What the owner signs off](#what-the-owner-signs-off)

## How to read a row

**Severity.** Error, warning, information or hint, as in VS Code. Principle 1 of
[MVP.md](MVP.md#principles): an error or a warning needs evidence that the game raises it.
Everything else is pychivalry's own advice and is information (semantic advice) or a hint
(style or tidiness).

**Evidence.** One of these kinds, highest first in the [order of trust](references/README.md#order-of-trust):

| Kind | What it is |
| --- | --- |
| Catalogue | A message of the spec package's error catalogue, named by its id, for example `unknown_trigger_X` ("Unknown trigger '%s'"). This page was written against the 1.20.0.2 stand-in; the committed catalogue is now game 1.21.0.3's (2,023 messages), and every catalogue id this page cites is in it with the same text. Every catalogue message this page cites was also found, word for word, in the 1.21.0.3 Linux executable ([below](#where-the-executable-keeps-each-message)). |
| Executable | A message of the 1.21.0.3 executable that the 1.20.0.2 catalogue does not hold. The 1.21 catalogue must carry it before the check ships; the committed 1.21.0.3 catalogue does not carry this page's one such message yet. |
| Required field | A field the spec package marks required, with the game's message for it. |
| Game output | The game's own output: its documentation dumps or its error log. |
| Reproduced | An error reproduced in the running game, with its log line. None yet: in-game runs are build step 11. |
| Advice | No game evidence. Information or a hint, never an error or a warning. |
| Formatting rules | No game evidence: pychivalry's own formatting rules ([formatting.md](formatting.md)), the `style/` family's formatting rows, by the owner's decision (decision 103). A warning or a hint. |
| Best practice | No game evidence: pychivalry's own best-practice rules, the `style/` family's other rows, by the owner's decision (decisions 105 to 107), each with the base game's own rate. A warning or a hint. |

**Replaces.** The release 2.3.0 code the row carries over, or "new". The full mapping, every
2.3.0 code in both directions, is [below](#release-230s-codes-one-by-one).

**State.** Whether the row is built, and by which item; built in part, blocked, or not built yet,
with what stands in the way; a retired row is in [Retired codes](#retired-codes), with the date
and the reason. Item 4.7's re-proof counts (the base-game units an advice row applies to, and
the findings it raises there) are given with each advice row.

**Fix.** Added by item 8.6 (#146), from the core's table of fixes (`FIX_ROWS`,
`packages/core/src/fix/registry.ts`), which a test holds to every built code: whether a
finding of the code carries a mechanical fix and what it does. *Safe*: the one outcome that can
be right, which `check --fix` and "fix all" apply; *safe or a suggestion*: safe when only one
outcome is left, otherwise up to five alternatives to choose from; *suggestion*: always a
choice; otherwise the reason there is none. "Not built" for a row whose check is not built.
The column adds nothing to a signed-off row's code, severity, evidence or fixture pair.

**Fixture pair.** `fixtures/mods/<pair>-bad`, which the check fires on, and
`fixtures/mods/<pair>-good`, which it is silent on, where `<pair>` is the code with its `/`
written as `-` (`names/unknown-trigger` is tested by `names-unknown-trigger-bad` and
`names-unknown-trigger-good`). None exists yet; each is written with its check. The step 2
findings are already tested by the `parse-*` mods and `encoding-windows-1252`.

**Item.** The build item of [PLAN.md](PLAN.md#step-4-engine-checks-and-lookup) that builds
the check; the rows are grouped by it.

**Needs from the spec.** What the check needs that the stand-in this page was written against
(format 4, game 1.20.0.2) does not carry, in these short names, all of them parts of the 1.21
package in format 5 ([MVP.md](MVP.md#what-the-121-spec-adds)) unless marked "not in the plan".
The 1.21.0.3 package is now committed; whether each part meets its check's need is item 4.2's
to read:

| Short name | Part of the 1.21 spec |
| --- | --- |
| 1.21 names | The 1.21 triggers, effects, links, lists, modifiers and on-actions |
| tables | The hand-kept tables of 2.3.0 moved into the spec: which blocks hold triggers, effects and modifiers, iterator parameters, structural keywords, chain heads, the effects that save a scope |
| value types | A value type per field, including which database a key names and which fields hold a file path |
| loc fields | Which fields hold a localization key |
| frequency | How often each field is set, per record |
| observed values | The values the base game writes in a field, where the set is small |
| use areas | Where each modifier may be used |
| .info | Paradox's documentation files: field lists, the scope a block receives, defaults |
| clean catalogue | The cleaned 1.21 catalogue: non-game strings removed, each message marked script-facing or not, and the 1.21 executable's messages the 1.20 catalogue lacks |
| rules | The override rules table |
| keyword roles | *Not in the plan.* The keywords a structural or advice check tests (`hidden`, `option`, `if`, `else`, `switch` and the like), as data. See [What the owner signs off](#what-the-owner-signs-off), question 10 |
| implicit keys | *Not in the plan.* Localization keys a record has by its name alone (`decision_group_type_<key>`) |

## The code scheme

### The proposal: a family and a name

A code is a **family** and a **name**, joined by a slash, in lower-case ASCII letters, digits
and hyphens:

```text
syntax/missing-closing-brace
names/unknown-trigger
structure/event-undeclared-namespace
```

- **The family** says what the finding is about. It comes from a closed list (below), so codes
  sort and filter by it: `--code names/*` in the command line, the totals by code in the agent
  server's `check`.
- **The name** says what is wrong, in a few words a modder knows.
- **Severity is not in the code.** It is a field of the finding (principle 3 of
  [MVP.md](MVP.md#principles)) and of the row here. A severity can change, as EVENT-016 changed
  from information to warning between 2.2 and 2.3, without the code changing.
- **Evidence is not in the code.** It is a field of the finding, naming the catalogue entry, the
  required field, the game output or the word advice. Evidence can be found later (an advice
  check raised to a warning when its message turns up) without the code changing.
- **No catalogue id, version number, severity word or tool name** ("error", "advice", "pyc")
  appears in a code.

The families:

| Family | What its findings are about | Items |
| --- | --- | --- |
| `syntax` | How a file reads: braces, operators, values, quoted text, `@[ ]`; since step 10 a GUI file too (`syntax/gui-*`) | Step 2, item 10.2 |
| `encoding` | How a file's bytes decode | Step 2 |
| `definitions` | What the index knows about a definition: a clash, a file the game does not read | 4.5 |
| `names` | A keyword the game does not know in its place: trigger, effect, link, list, modifier, on-action | 4.2 |
| `scope` | Scope chains, the scope a keyword runs in, saved scopes and event targets | 4.4, 4.6, 4.7 |
| `fields` | One field of a record: unknown, required, the wrong kind of value, usually present | 4.5, 4.7 |
| `structure` | How a record or block is put together beyond one field | 4.5, 4.7 |
| `references` | A value naming a key or a definition that does not exist | 4.5, 4.7 |
| `localization` | Localization keys and their text | 4.6 |
| `variables` | Variables set and read | 4.7 |
| `graphics` | Files a script names that do not exist | Step 10 |
| `log` | Lines of the game's own error log | Step 11 |
| `style` | Where a file is not in pychivalry's format: its layout, its whitespace, its line breaks and byte-order mark; and where it breaks pychivalry's best practice: an encoding other than UTF-8, an empty block, a block nested too deep, fields in an unusual order. Added on the owner's word of 2026-11-23 (decisions 103 and 105 to 107); its rows rest on pychivalry's own formatting rules or its own best-practice rules, not on the game | 8.2 |

**Why this shape.**

1. **The step 2 identifiers already have it**, and they are in the core and in every `parse-*`
   fixture's `expected.json`. Under this scheme each identifier *is* its code: there is no
   second name to keep in step with the first.
2. **An agent reads it without a lookup.** The agent server's `check` returns totals by code
   every time; `names/unknown-effect: 12` tells an agent what to fix, where `PYC3002: 12` sends it
   to `explain_code` first. Principle 3 and "AI first" both favour the readable form.
3. **It cannot be confused with a 2.3.0 code.** No code of release 2.3.0 contains a `/`, so a
   modder moving from `ck3-language-support` never meets an old code with a new meaning.
4. **A code names the finding, not its message.** A message is rendered from the catalogue or
   from the row's own text; changing either changes nothing a filter or a saved setting refers
   to.

**What it costs.** Codes are longer (the longest proposed here has 53 characters). Words invite "improving", and a
badly chosen name is kept for ever; the review of this page is the last chance to choose them
well.

### Alternatives considered

**B. A short numbered code**, `PYC` and four digits, the first digit the family:
`PYC1001` for a block left open, `PYC3001` for an unknown trigger. It is compact and
conventional (TypeScript's `TS2304` is the same idea) and nothing in it tempts anyone to rename
it. Against it: it means nothing without a lookup, the step 2 identifiers would need a mapping
kept in step with them, and agents would spend a call on `explain_code` for every total.

**C. The game's catalogue id as the code**, as 2.3.0's engine did (`unknown_trigger_X`). It
is not proposed. A catalogue id is made from the message's text and can change when the 1.21
spec cleans the catalogue; several findings share one message (`unexpected_token_expected_key`
is the evidence of three syntax findings); and advice has no catalogue id at all.

### How a code stays permanent

1. From the owner's sign-off on, a code is never renamed and never reused for another finding.
2. A change of wording changes the message, not the code.
3. A change of severity changes the row's severity column and is recorded in
   [decisions.md](decisions.md), not in the code.
4. If a check would have to find something else, it gets a new code, and the old one is
   **retired**: it stays on this page in a "Retired codes" table with the date and the reason, and
   is never emitted again. A check that is dropped is retired the same way.
5. This page is the registry. Item 4.2 adds a test that every code the core can emit has a row
   here and that no retired code is emitted.

### The step 2 identifiers and the index's statuses

The eleven step 2 identifiers become codes as they are, with no mapping:
`syntax/missing-closing-brace` is the code of a block left open. Their rows are in
[Step 2](#step-2-built-the-parse-findings) below, and their severities in
[The step 2 findings](#the-step-2-findings).

The index of step 3 answers a status for every name of a database
(`packages/core/src/index/workspace.ts`, `Resolution`). Two statuses become findings; the rest
are not findings:

| Status | Code | Why |
| --- | --- | --- |
| `single`, `winner`, `all`, `statements` | none | The game's rules say what is in force; nothing is wrong |
| `clash` | `definitions/clash` | A row of the rules table says the game calls these definitions an error; the row names the game's message, which is the evidence |
| `not-read` | `definitions/not-read` | A row of the rules table says the game does not read the file. The game prints nothing for it, so it is advice |
| `unknown` ("defined more than once, winner not known") | none | Nothing is known to be wrong. Lookup says so, and every check that depends on the winner stays silent (PLAN.md item 3.6) |
| `not-defined` | none | A use of a name defined nowhere is the finding of the check that knows what kind of name the use is: `names/*` or `references/*` |

### How release 2.3.0's codes relate

Release 2.3.0 reported three sorts of code: catalogue ids from its engine
(`unknown_trigger_X`), six package-local ids (`PYCH-P001` and so on) and the 85 codes of its
plug-in catalogue `legacy/data/diagnostics.yaml` (`CK3430`, `LOC-005`, ...). None is reused.
Each maps to a new code or to "not carried over", with the reason, in
[Release 2.3.0's codes, one by one](#release-230s-codes-one-by-one). The command line keeps
2.3.0's six JSON fields (`file`, `range`, `severity`, `code`, `message`, `source`); only the
values of `code` change.

## The inventory

### Step 2 (built): the parse findings

Built in `packages/core/src/syntax/findings.ts`; the identifier is the code. The eleventh,
`encoding/not-utf8`, was retired on 2026-11-23 (decision 113,
[Retired codes](#retired-codes)): a file not valid UTF-8 is the warning `style/not-utf8`.

| Code | Severity | What it finds | Evidence | Replaces | Fixture | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `syntax/missing-closing-brace` | error | A block still open at the end of the file | Catalogue `expected_after_arguments` ("Expected } after arguments") | `expected_after_arguments` | `parse-missing-closing-brace` | 2 | clean catalogue (the id may change) | Built (step 2) | Suggestion: A '}' where the indentation says the block ends, or at the end of the file. |
| `syntax/unexpected-closing-brace` | error | A `}` at the top level, where no block is open | Catalogue `unexpected_token_expected_key` | `unexpected_token_expected_key` | `parse-unexpected-closing-brace` | 2 | clean catalogue | Built (step 2) | Safe: The '}' that closes no block taken away: the file reads as before. |
| `syntax/block-without-key` | error | A block at the top level with no key | Catalogue `unexpected_token_expected_key` | `unexpected_token_expected_key` | `parse-block-without-key` | 2 | clean catalogue | Built (step 2) | None: the block's name is a choice. |
| `syntax/operator-without-key` | error | An operator with no key before it | Catalogue `unexpected_token_expected_key` | `unexpected_token_expected_key` | `parse-operator-without-key` | 2 | clean catalogue | Built (step 2) | None: the key is a choice. |
| `syntax/missing-value` | error | An operator with no value after it | Catalogue `expected_between_equals_and_arguments` | `expected_between_equals_and_arguments` | `parse-missing-value` | 2 | clean catalogue | Built (step 2) | None: the value is a choice. |
| `syntax/missing-operator` | error | A key at the top level with no operator after it | Catalogue `unexpected_token_X_found_at_X_expected` (see [its context](#where-the-executable-keeps-each-message)) | `unexpected_token_X_found_at_X_expected` | `parse-missing-operator` | 2 | clean catalogue | Built (step 2) | Safe: The '=' written between the key and the value on its line. |
| `syntax/missing-equals-before-block` | error | `name { ... }` among statements, without its `=` | Catalogue `expected_between_block_name_and_body` | `expected_between_block_name_and_body` | `parse-missing-equals-before-block` | 2 | clean catalogue | Built (step 2) | Safe: The '=' written between the name and its block, as the parser reads it. |
| `syntax/null-safe-operator-after-value` | error | `?=` after a number, date, constant or quoted text | Catalogue `unexpected_token_X_found_at_X_expected` | `unexpected_token_X_found_at_X_expected` | `parse-null-safe-after-value` | 2 | clean catalogue | Built (step 2) | Safe or a suggestion: A quoted name or scope chain written without its quotes (safe); otherwise '?=' written as '='. |
| `syntax/unterminated-string` | information | Quoted text without its closing quote | Advice ([why](#the-step-2-findings)) | `PYCH-P001` (error) | `parse-unterminated-string` | 2 | none | Built (step 2) | None: where the text ends is a choice, and closing it at the end of its line can make a key of text cut off mid-edit. |
| `syntax/malformed-arithmetic` | information | `@[ ... ]` that is not well formed, or has no `]` | Advice; a candidate message was found ([why](#the-step-2-findings)) | `PYCH-P002` (error) | `parse-malformed-arithmetic` | 2 | clean catalogue, to settle the candidate | Built (step 2) | None: what the expression should compute is a choice. |

### 4.2: unknown names

An iterator over a list the game does not have (`every_foo` where `foo` is no list) is reported
by the game as an unknown effect or trigger: the whole word is the unknown keyword. It is
therefore `names/unknown-effect` or `names/unknown-trigger`, with the list named in the
finding's data, not a code of its own. A keyword the spec marks removed (the stand-in's
`retired` list, 16 entries) is the same finding with the version it was removed in and its
replacement as data and as a fix; 2.3.0's `PYCH-R001` and `PYCH-R002` fold in here.

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `names/unknown-trigger` | error | A key in a trigger block that is no trigger there: a made-up or removed name, an effect, an `every_` or `random_` iterator, an iterator over no list | Catalogue `unknown_trigger_X` ("Unknown trigger '%s'") | `unknown_trigger_X`; `PYCH-R001`, `PYCH-R002`; `SWITCH-003` | `names-unknown-trigger` | 4.2 | 1.21 names; tables | Built (4.2), but for its iterator sub-cases, which wait on the owner | Safe or a suggestion: The documented replacement of a removed trigger, or the triggers near the name that fit the scope; safe when there is only one. |
| `names/unknown-effect` | error | A key in an effect block that is no effect there, including a trigger and an `any_` iterator | Catalogue `unknown_effect_X` ("Unknown effect '%s'") | `unknown_effect_X`; `PYCH-R001`, `PYCH-R002` | `names-unknown-effect` | 4.2 | 1.21 names; tables | Built (4.2), but for its iterator sub-cases, which wait on the owner | Safe or a suggestion: The documented replacement of a removed effect, or the effects near the name that fit the scope; safe when there is only one. |
| `names/unknown-link` | error | A segment of a scope chain (`root.foo`, `scope:x.bar`) that is no link | Catalogue `failed_to_parse_data_for_event_target_link_link_X_location_X` | same id | `names-unknown-link` | 4.2 | 1.21 names; tables (chain heads) | Built (4.2) | Safe or a suggestion: The links near the segment that start from its scope; safe when there is only one. |
| `names/unknown-modifier` | error | A key in a modifier block that is no modifier and fills no modifier template | Catalogue `unknown_modifier_type_X_at_X` ("Unknown modifier type '{}' at {}") | same id; `PYCH-R001` for modifiers | `names-unknown-modifier` | 4.2 | 1.21 names (761 modifiers); tables (which blocks hold modifiers) | Built (4.2) | Safe or a suggestion: The documented replacement of a removed modifier, or the modifiers near the name whose use areas fit the block; safe when there is only one. |
| `names/unknown-on-action` | error | A value naming an on-action the game does not have | Catalogue `unknown_on_action_X` ("Unknown on action: %s") | new | `names-unknown-on-action` | 4.2 | 1.21 names; value types (which fields name an on-action) | Built (4.2) | Safe or a suggestion: The on-actions near the name, of the game and the mod; safe when there is only one. |
| `names/modifier-outside-use-area` | warning | A modifier in a block of a kind its use area does not include | Game output: the documentation dump's use area for each modifier. No catalogue message was found for it | new | `names-modifier-outside-use-area` | 4.2 | use areas; value types (which use area a block is) | Built (4.2) | None: whether the modifier moves to another block or another modifier is meant is a choice. |

**Built** (item 4.2, `packages/core/src/check/`): all six rows, each with its fixture pair.
`names/unknown-on-action` reads the fields and parameters part D6 of the spec package (format 7,
format 8 since 2026-11-23) confirms name an on-action; `names/modifier-outside-use-area` reads the use area part D7
confirms for each block that holds modifiers. A measured-only or unknown row of either part
raises nothing. **Not covered by any row:** a static modifier of `common/modifiers` applied by
an effect of another use area (`add_county_modifier` with a modifier of character modifiers
only, the case item 6.11 found in the planted mod's reference copy):
`names/modifier-outside-use-area` reads only the block a modifier is written in, and part D7
leaves the record body of `common/modifiers` unknown. A row for it is a question for the owner
([decisions.md](decisions.md#asked-awaiting-the-owner)); none is added. **Not built:** two parts
of the first two rows, an `every_`, `random_` or `ordered_` iterator in a trigger block and an
`any_` iterator in an effect block outside a `limit`. Part D8 says which prefix is which kind, but no game message ties the unknown-trigger
or unknown-effect message to an iterator of the wrong kind, so building them would be an error
without game evidence: a question for the owner
([decisions.md](decisions.md#asked-awaiting-the-owner)).

### 4.3: context

Item 4.3 decides which blocks hold triggers, effects and modifiers. It raises no finding of
its own; its tables feed the rows of 4.2 and 4.4. **Built** inside item 4.2, whose rows need it
(`packages/core/src/check/context.ts`).

### 4.4: scope

Judged only where the spec has scope data; "no requirement declared" is not a finding.

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scope/wrong-scope-for-trigger` | error | A trigger in a scope its scope data does not list | Catalogue `wrong_scope_for_trigger_X_expected_X`; the scope data from the game's documentation output | same id | `scope-wrong-scope-for-trigger` | 4.4 | 1.21 names (scope data); .info (the scope each block receives); tables (iterator and link scopes) | Built (4.4) | Safe or a suggestion: The trigger wrapped in a link that leads to a scope it takes, where at most five do; safe when only one plain link does. |
| `scope/wrong-scope-for-effect` | error | An effect in a scope its scope data does not list | Catalogue `wrong_scope_for_effect_X_expected_X` | same id | `scope-wrong-scope-for-effect` | 4.4 | as above | Built (4.4) | Safe or a suggestion: The effect wrapped in a link that leads to a scope it takes, where at most five do; safe when only one plain link does. |
| `scope/link-on-wrong-scope` | error | A link applied to a scope it cannot start from | Catalogue `trying_to_use_X_link_on_an_invalid_scope_X` (see [its context](#where-the-executable-keeps-each-message)) | same id | `scope-link-on-wrong-scope` | 4.4 | as above | Built (4.4) | Safe or a suggestion: A link that leads to a scope the link starts from written before it, where at most five do; safe when only one plain link does. |

**Built** (item 4.4, `packages/core/src/check/scope.ts` and one file per row): all three rows,
each with its fixture pair. On the 1.21.0.3 base game (`task game:check`) the checks see 610,898
keyword uses, judge 178,395 of them and 41,022 link steps, and raise no finding. Since the spec
package in format 9 (2026-11-25) a record's root is judged only where its folder's rule is `fixed`
(laws root at a character, title history at a landed title, scripted modifiers at their
caller, the 6 roots only the wiki-era seed gives not judged), and a keyword whose scopes name a
value of part O2 (`none`) is not judged: 179,669 of 610,886 uses and 41,575 link steps, no
finding; release 2.3.0
judged 101,162 of 613,103 on the same game (93,665 of 561,077 on 1.20). On the five mods: 27
`scope/wrong-scope-for-effect` errors, all in rice (buildings added in a province, which 1.21.0.3
moved to districts). Since decision 83 each finding's data also says the way out, beside the
game's message, which stays as it is: the links that lead from the scope it is in to the scopes
the keyword or link takes (`links_from_scope`), from the spec package's link documentation.

### 4.5: fields and structure

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fields/unknown-field` | warning | A field in a record that its folder's field list does not have | Catalogue `unknown_X_in_X` ("Unknown {} in {}"); see [its context](#where-the-executable-keeps-each-message) and question 6 | same id | `fields-unknown-field` | 4.5 | .info (field lists beside the base game's inventory; the stand-in lists only what the base game writes); the 14 folders 1.21 adds | Built (4.5); since format 9 an ethnicity's own keys are gene names (`open_keys`), not fields | Safe or a suggestion: The fields of the record's folder near the name, not already written; safe when there is only one. |
| `fields/bare-value-in-record` | error | A bare value directly in a record body that holds statements, where the game expects `key =` | Catalogue `unexpected_token_X_found_at_X_expected` | same id (2.3.0's schema check) | `fields-bare-value-in-record` | 4.5 | value types (which records are lists) | Built (4.5) | Safe or a suggestion: A field of the record measured boolean written as '= yes' (safe when the base game writes only yes). |
| `fields/missing-required-field` | error | A field the spec marks required is missing. Three in the stand-in, each with the game's message: a casus belli's `on_invalidated_desc`, an interaction category's `index`, a tutorial lesson's `chain`. The base game has none missing: 0 of 138, 0 of 16, 0 of 124 | Required field, each with its catalogue message: `casus_belli_X_missing_on_invalidated_desc`, `invalid_or_undefined_index_for_character_interaction_categor`, `missing_or_invalid_tutorial_chain_for_tutorial_lesson_X` | those three ids; `PYCH-S002` | `fields-missing-required-field` | 4.5 | none for the three; any field format 5 adds comes with its evidence | Built (4.5) | Suggestion: The field written with a placeholder of its kind to set, where its value is a number or a boolean. |
| `fields/wrong-kind-of-value` | information | A value of another kind than the field takes (a word where a number goes, `maybe` where `yes` or `no` goes) | Advice. Whether the measured value types are clean enough for a warning is not yet known (PLAN.md step 4); no catalogue message for script values was found (the "Expected number" family belongs to the executable's JSON reader) | new | `fields-wrong-kind-of-value` | 4.5 | value types | Built in part (4.5): 7 value groups (boolean, integer, decimal, number, date, list, path); block and word fire on correct mod script and are not judged | Suggestion: The values the base game writes in the field, where they are a small set. |
| `references/unknown-key` | warning | A value that should be a key of a database (an event theme, a background, a decision group, a trait, an interaction category) names no key of it in the mod, the base game or a DLC | Catalogue `failed_to_read_key_reference_X_from_database_X` ("Failed to read key reference %s from database %s"); for an event option's `trait`, `unknown_trait_X_in_event_at_X`. The base game names no missing key: themes 0 of 8,859, decision groups 0 of 496, interaction categories 0 of 629 | `CK3430`, `CK3431`, `CK3800` | `references-unknown-key` | 4.5 | value types (which database each field's value is a key of) | Built (4.5); since format 9 it reads D6's `sentinels` and `miss_values` and the databases D6 adds (`add_databases`): 118 confirmed rows, the trait groups and the game concepts' aliases not held by the index (docs/decisions.md, row 151) | Safe or a suggestion: The keys of the database near the one written; safe when there is only one. |
| `structure/event-undeclared-namespace` | warning | An event whose namespace its file does not declare, including every event of a file that declares none. The base game has none: 0 of 10,836 events | Catalogue `namespace_X_used_in_event_X_file_X_is_not_defined_in_this_fi` | `EVENT-016`; `EVENT-010` | `structure-event-undeclared-namespace` | 4.5 | keyword roles (`namespace` as a declaration, asked in step 3) | Built (4.5) | Suggestion: The id written with a declared namespace near it, where that id is free; or the namespace declared at the top of the file. |
| `structure/range-min-above-max` | error | A range whose minimum is above its maximum | Catalogue `min_value_in_range_directive_is_larger_than_the_max_value_un` | `VALUE-002` | `structure-range-min-above-max` | 4.5 | value types (where a range is written) | Built (4.5) | Safe: The two bounds written low first. |
| `structure/event-non-character-shown` | error | An event whose `scope` is not a character and that is neither hidden nor major. The base game has none: 0 of its 121 events with another scope | Catalogue `error_in_event_X_non_character_events_must_be_hidden_or_be_n` ("Error in event '{}'. Non-character events must be hidden, or be narrative events"); `events/_events.info`: "Non-character scoped events generally need to be hidden or major". That "narrative" means `major` is read from the `.info` file, not shown | new | `structure-event-non-character-shown` | 4.5 | keyword roles; .info | Built (4.5) | Suggestion: Each keyword the game's message names written as '= yes' (hidden, major). |
| `structure/triggered-desc-other-field` | warning | A `triggered_desc` block holding a key other than `desc` and `trigger`, at that key. The base game has none: 0 of its 22,398 | Catalogue `the_body_of_triggered_desc_can_only_take_desc_and_or_trigger` ("The body of triggered_desc can only take desc and/or trigger. %s"), kept beside the 1.21 dynamic-description reader; in the committed catalogue since format 9 (until then an "Executable" row, blocked on the catalogue by decision 74) | new | `structure-triggered-desc-other-field` | 4.5 | keyword roles: part D4's `closed_body` row whose evidence quotes the message, and its `allows_only` | Built (format 9, 2026-11-25): the block and the keys its body takes are part D4's (`triggered_desc`, `allows_only: desc, trigger`); a key that differs from an allowed one only in letter case, and a bare value, are not judged | None: whether the key belongs in the block's 'desc', in its 'trigger' or elsewhere is a choice. |
| `definitions/clash` | error | Definitions the rules table says the game calls an error: two events with one id and the same `id_override_priority`, two history characters with one id and the same `history_override_priority` | Catalogue, named by the rules row: `duplicated_event_id_X_with_the_same_override_priority_X_foun`, `duplicate_character_id_X_found_in_history`. The base game has 3, all character ids (`records/game/index.json`); item 4.9 classifies them | new | `definitions-clash` (the step 3 mod `override-rules` already holds 2 clashes) | 4.5 | rules (a clash row carries its message) | Built (4.5) | None: which definition gets another name is a choice. |
| `definitions/not-read` | information | A definition in a file the rules table says the game does not read (replaced by another layer's file, hidden by `replace_path`, a folder in the wrong letter case) | Advice: the rules row has game evidence, but the game prints nothing for a file it skips | new | `definitions-not-read` | 4.5 | rules (most such rows are open today) | Built (4.5) | None: the file is replaced or hidden on purpose, or moved: a choice. |

**Built** (item 4.5, and since format 9 the eleventh): every row, each with its fixture pair,
`fields/wrong-kind-of-value` for 7 of the 9 value groups. `structure/triggered-desc-other-field`
waited for its message to be in the committed catalogue (an "Executable" row ships only once it
is; part D4 quotes the string as rank-1 evidence; decision 74); since format 9 (2026-11-25) the
catalogue holds it (`the_body_of_triggered_desc_can_only_take_desc_and_or_trigger`), and the check
reads the block and the keys its body takes from part D4 (`closed_body`, `allows_only`), no list
of its own. The base game raises none of these errors or
warnings; `definitions/not-read` gives 88 information findings, all in `jomini/` files the game's
own copies replace. Since format 9 `references/unknown-key` reads part D6's own account of what
the base game writes at a place (`miss_values`, `sentinels`) instead of measuring it again, and
gives the base game 4 warnings on values nothing in the install defines, each a defect of its
files; `fields/unknown-field` takes an ethnicity's keys as gene names (`open_keys`), so
elf-destiny's 6 false warnings on its own genes are gone.

### 4.6: event targets and localization

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scope/undefined-event-target` | information | `scope:name` with no effect saving `name` in the file, the mod or the base game | Catalogue `undefined_event_target_X`. Information by the MVP's decision: the base game alone has 10,523 (2.3.0's record on 1.20) | same id | `scope-undefined-event-target` | 4.6 | tables (the effects that save a scope) | Built (4.6); since format 9 a save of a value is a save and the names the game saves from its own code (part O1) are defined; a name passed to a scripted effect in a parameter is reported only when no file writes it but as `scope:name` | None: the name may be saved where the index cannot see, and which save is meant is a choice. |
| `localization/missing-key` | warning | A localization key, in a field that holds one, defined in no localization file of the mod, the base game or a DLC. Literal text with spaces in such a field is this finding too: the game reads it as a key | Catalogue `unknown_loc_key_X` ("Unknown loc key %s"); for `title`, `desc` and option `name`, the 1.21 executable's "Unrecognized loc key %s. Near %s" beside the dynamic-description reader; `events/_events.info`: "Missing localization keys are logged as errors" | `CK4100`, `CK4101`, `CK4102` | `localization-missing-key` | 4.6 | loc fields; implicit keys (not in the plan); clean catalogue | Built (4.6) | Suggestion: A stub entry for the key in the mod's localization file of each language it has (one is made when it has none). |
| `localization/unbalanced-brackets` | warning | Localization text with an extra or unclosed `[`, `]`, `(`, `'` or `$`. The base game has none: 0 of the 3,100,662 entries of its eleven languages | Catalogue `loc_key_X_unexpected_extra_at_position_X_file_X` and `_2` (an extra `[` or `]`); since format 9 the localization reader's four "Unterminated" messages: `loc_key_X_unterminated_at_position_X_in_data_statement_file` (a `[`), `loc_key_X_unterminated_at_position_X_in_data_parenthesis_sta` (a `(` in a statement), `loc_key_X_unterminated_at_position_X_in_data_single_quotes_f` (a `'` in a statement), `loc_key_X_unterminated_at_position_X_in_localization_replace` (a `$`) | `LOC-005`; the `$` part of `LOC-007` | `localization-unbalanced-brackets` | 4.6 | clean catalogue (the 1.21 messages) | Built (4.6; the opener left open since format 9, 2026-11-25): one finding an entry, an extra bracket first, else the innermost opener its text leaves open; not decided, so not reported: a `]` written while a parenthesis is open, and a `$` inside a statement. The position given is the opener's; whether it is the game's is for step 11's logs. `Unterminated '[' when reading property '%.*s'` (a reader of another kind, marked script-facing unknown) is not cited | Suggestion: The statement left open closed after its command, or the extra bracket taken away; for a '[' or a '$' left open, it closed after its command or name, or taken away; offered only where the entry is then balanced. |
| `localization/unused-key` | hint | A key the mod defines that nothing in the mod or the base game uses | Advice | new | `localization-unused-key` | 4.6 | loc fields; implicit keys (not in the plan) | Built (4.6); on by default since 2026-11-23 (decision 108, replacing decision 76), turned off by `check --no-unused-keys`, the agent server's `unused_keys: false` or the editor's `pychivalry.localization.unusedKeys` | None: removing a key deletes text that may be wanted. |

**Built** (item 4.6): all four rows, each with its fixture pair; `localization/unbalanced-brackets`
reported an extra `[` or `]` only until the 1.21 "Unterminated ..." messages reached the committed
catalogue with format 9 (2026-11-25), and reports an opener left open since. On the base game: 5,969 `scope/undefined-event-target` (76 names; `duel_value` alone
4,716) on format 8, 26 (15 names) on format 9, which saves a value under a name
(`save_scope_value_as`) in `save_keys` and lists the 409 names the game saves from its own code
(part O1, `duel_value` among them); 151 `localization/missing-key` warnings on 104 keys no localization file of the install
defines (each a defect of the game's files, `tools/data/check-classifications.json`), no
unbalanced brackets (neither an extra one nor an opener left open), no unused key. `localization/unused-key` was off by default from decision 76
(on rice it gives 141,090 hints, about one for every key the mod defines); since decision 108 it
is on by default again and can be turned off, the per-file limit bounding a file full of them.

### 4.7: advice that holds on 1.21

Each `structure/*` row here held on the 1.21 base game: it applies to at least 10 base-game
records and fires on none (the criterion is question 2 of
[What the owner signs off](#what-the-owner-signs-off)); its text gives the number of records,
then the number it fires on. The first three rows take their data from the base game itself
(how often a field is set, which values it holds, which names are defined). Item 4.7 re-proves
each one on the base game before it ships.

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fields/usually-present` | information | A record without a field that every base-game record of its kind sets. Seventeen pre-2.0 required-field flags return through this row ([below](#the-38-required-field-flags)) | Advice (the base game's frequency, rank 4) | new | `fields-usually-present` | 4.7 | frequency | Built (4.7); re-proof: applies to 436,310, fires on 0 | None: the field's value is a choice. |
| `fields/unusual-value` | hint | A value no base-game record writes in a field whose values form a small set | Advice (observed values) | new | `fields-unusual-value` | 4.7 | observed values | Built (4.7); re-proof: applies to 48,974, fires on 0 | Suggestion: The values the base game writes in the field that are near the one written. |
| `references/unknown-name` | information | A value naming a definition the index does not hold, where no game message is known: a portrait animation, a game concept in `[concept\|E]`. The base game: 4 of 16,776 portrait animations name none of its 330 | Advice | `CK3422`; `LOC-006` | `references-unknown-name` | 4.7 | value types (which definition a field names) | Built in part (4.7): portrait animations (re-proof: applies to 16,899, fires on 4, the base game's own, as the row states; they are its [known exceptions](#known-exceptions), decision 75). The game-concept half stays blocked: part D9 gives the form `[key\|E]` as data (`game_concept`, confirmed, with `Concept` and `ConceptByKey`), but a concept's key is a key of `common/game_concepts` or one of the aliases its `alias` field lists (`vocabulary.reads.game_concept`), and part D3 defines no alias, so the index holds none (docs/decisions.md, row 151). Without them the check would decide wrongly: of the 65,007 concept names the base game's English text writes, 20,715 (1,353 names: `vassals`, `counties`, `rulers`) are no key the index holds, aliases among them; it waits for the package | Suggestion: The names of the folder near the one written (advice: never safe). |
| `structure/namespace-outside-events` | information | A file outside `events/` that declares a `namespace`. Every script file of `common/` and `history/`; 0 | Advice | `PYCH-S003` (warning) | `structure-namespace-outside-events` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 4,215, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/event-unknown-type` | information | An event `type` that `events/_events.info` does not list (character, letter, court, activity). 10,836 events; 0 | Advice (.info, rank 3) | `EVENT-001` | `structure-event-unknown-type` | 4.7 | .info; keyword roles | Built (4.7); re-proof: applies to 9,727, fires on 0 | Suggestion: The documented event types near the one written. |
| `structure/event-letter-without-sender` | information | A letter event without `sender`. 705; 0 | Advice (.info: "required for letter events"; question 8) | `EVENT-002` | `structure-event-letter-without-sender` | 4.7 | .info; keyword roles | Built (4.7); re-proof: applies to 705, fires on 0; stays advice until the catalogue carries the executable's message part D4 quotes (decision 74) | None: the right change is a choice of content the data does not make. |
| `structure/event-without-desc` | information | An event that is not hidden and has no `desc`. 9,562; 0 | Advice | `CK3764` | `structure-event-without-desc` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 9,562, fires on 0; stays advice until the catalogue carries the executable's message part D4 quotes (decision 74) | None: the right change is a choice of content the data does not make. |
| `structure/event-without-option` | information | An event that is not hidden and has no `option`. 9,562; 0 | Advice | `CK3763` | `structure-event-without-option` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 9,562, fires on 0; stays advice until the catalogue carries the executable's message part D4 quotes (decision 74) | None: the right change is a choice of content the data does not make. |
| `structure/event-after-without-option` | information | An event that is not hidden, has an `after` and no `option`. 2,641; 0 | Advice | `CK3521` | `structure-event-after-without-option` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 2,641, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/event-several-immediate` | information | An event with more than one `immediate`. 10,836; 0 | Advice | `CK3768` | `structure-event-several-immediate` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 10,836, fires on 0 | None: merging the blocks changes the order effects run in. |
| `structure/event-several-after` | information | An event with more than one `after`. 10,836; 0 | Advice | `CK3766` | `structure-event-several-after` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 10,836, fires on 0 | None: merging the blocks changes the order effects run in. |
| `structure/event-empty` | information | An event with nothing in it. 10,836; 0 | Advice | `CK3767` | `structure-event-empty` | 4.7 | none | Built (4.7); re-proof: applies to 10,836, fires on 0 | None: removing the event deletes a definition that may be named elsewhere. |
| `structure/event-portrait-position-twice` | information | One portrait position given twice in an event. 10,836; 0 | Advice | `CK3426` | `structure-event-portrait-position-twice` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 10,836, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/event-triggered-animation-without-trigger` | information | A portrait's `triggered_animation` without `trigger`. 3,124; 0 | Advice | `CK3423` | `structure-event-triggered-animation-without-trigger` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 3,129, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/event-triggered-animation-without-animation` | information | A `triggered_animation` with neither `animation` nor `scripted_animation`. 3,124; 0 | Advice | `CK3424` | `structure-event-triggered-animation-without-animation` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 3,129, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/logic-operator-without-block` | information | `AND`, `OR`, `NOT`, `NOR` or `NAND` with a single value instead of a block. 96,420; 0 | Advice | `CK3005` | `structure-logic-operator-without-block` | 4.7 | tables (structural keywords) | Built (4.7); re-proof: applies to 99,418, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/else-without-if` | information | `else` or `else_if` not directly after an `if` or `else_if`. 26,134; 0 | Advice | `COND-003`; `VALUE-004` | `structure-else-without-if` | 4.7 | tables (structural keywords) | Built (4.7); re-proof: applies to 26,149, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/trigger-else-without-trigger-if` | information | `trigger_else` or `trigger_else_if` not directly after a `trigger_if` or `trigger_else_if`. 4,473; 0 | Advice | `CK3510` | `structure-trigger-else-without-trigger-if` | 4.7 | tables (structural keywords) | Built (4.7); re-proof: applies to 4,561, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/switch-without-trigger` | information | A `switch` block without `trigger`. 1,007; 0 | Advice | `SWITCH-001` | `structure-switch-without-trigger` | 4.7 | tables (structural keywords) | Built (4.7); re-proof: applies to 1,007, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/switch-without-branches` | information | A `switch` block with no branch. 1,007; 0 | Advice | `SWITCH-002` | `structure-switch-without-branches` | 4.7 | tables (structural keywords) | Built (4.7); re-proof: applies to 1,007, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/round-to-not-positive` | information | `round_to` with zero or a negative number. 20; 0 | Advice | `VALUE-006` | `structure-round-to-not-positive` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 20, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/casus-belli-without-outcome` | information | A casus belli with none of `on_victory`, `on_defeat`, `on_white_peace`. 138; 0 | Advice | new (pre-2.0 `CB-001`) | `structure-casus-belli-without-outcome` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 138, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-without-timing` | information | A story cycle's `effect_group` with none of `days`, `weeks`, `months`, `years`. 171; 0 | Advice | new (pre-2.0 `STORY-001`) | `structure-story-effect-group-without-timing` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 171, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-several-timings` | information | An `effect_group` with more than one of them. 171; 0 | Advice | new (pre-2.0 `STORY-004`) | `structure-story-effect-group-several-timings` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 171, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-without-effect` | information | An `effect_group` with no `triggered_effect`, `first_valid` or `random_valid`. 171; 0 | Advice | new (pre-2.0 `STORY-025`) | `structure-story-effect-group-without-effect` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 171, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-chance-above-100` | information | An `effect_group` whose `chance` is above 100. 50; 0 | Advice | new (pre-2.0 `STORY-023`) | `structure-story-effect-group-chance-above-100` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 50, fires on 0 | None: the right change is a choice of content the data does not make. |
| `structure/story-effect-group-chance-not-positive` | information | An `effect_group` whose `chance` is zero or less. 50; 0 | Advice | new (pre-2.0 `STORY-024`) | `structure-story-effect-group-chance-not-positive` | 4.7 | keyword roles | Built (4.7); re-proof: applies to 50, fires on 0 | None: the right change is a choice of content the data does not make. |

### 4.7: advice carried over provisionally

These 2.3.0 checks reason across an event's evaluation order or across files, and cannot be
counted on the base game without building them, which item 4.1 does not do. Each ships only if
item 4.7's re-proof shows it holds on the 1.21 base game by the same criterion; otherwise it is
retired before it ships. Whether they belong in the MVP at all is question 9.

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scope/saved-late-read-in-desc` | information | A scope read in `desc` that the event saves only in an option or in `after` | Advice | `CK3551` | `scope-saved-late-read-in-desc` | 4.7 | tables (saving effects); keyword roles | Built (4.7); re-proof: applies to 595, fires on 0 | None: moving the save is a change of what the event does. |
| `scope/title-text-reads-scope-saved-late` | information | The same for the `title` text: the localization text of an event's `title` (its key, or each `desc` of its dynamic description) reads a scope the event saves only in an option or in `after` | Advice | `CK3561` | `scope-title-text-reads-scope-saved-late` | 4.7 | tables (saving effects); keyword roles; loc fields; part D9 (the forms that read a saved scope by name) | Built (format 9, 2026-11-25); re-proof: applies to 757, fires on 0. The text's reads are the index's, by part D9's forms: the head of a chain (`saved_scope_head`, confirmed) and the functions whose argument is a saved name (`TopScope.sC`, `sTitle`, `GetValue`, measured only: read because the row is advice; a form of status `unknown` is not read); a first word that is a global of the data types is no saved name; every language of the key is read | None: moving the save, or the text, is a change of what the event shows. |

**Built** (item 4.7): every row of "advice that holds" (the game-concept half of
`references/unknown-name` still blocked: the package defines no concept alias) and, of the
provisional rows, `scope/saved-late-read-in-desc` and, since format 9 gave the forms of
localization text as data (part D9), `scope/title-text-reads-scope-saved-late`; the eleven others
fired on the base game and are [retired](#retired-codes). The re-proof is `pychivalry-tools advice
proof` (committed and tested), run on the 1.21.0.3 base game; its counts are in each row's State.

Part D4 carries the 1.21 executable's own messages for a letter event without `sender`, an event
without `desc` and an event without `option`, as rank-1 evidence, but the spec's error catalogue
does not: the three rows stay advice, at information, until it does, and nothing is re-graded
(decision 74).

#### Known exceptions

`references/unknown-name` ships as information although the base game itself names 4 portrait
animations it does not define (decision 75; decision 46's zero exceptions do not retire it). These
are its 4 findings on the 1.21.0.3 base game, each an `animation` of a portrait that no file of
`gfx/portraits` defines:

| File | Line | Animation |
| --- | ---: | --- |
| `events/activities/ecumenical_council_activity/pam_investiture_council_events.txt` | 473 | `worried` |
| `events/dlc/gdp/gdp_republic_unrest_events.txt` | 1846 | `standing` |
| `events/secret_events/secrets_events.txt` | 5614 | `scheming` |
| `events/secret_events/secrets_events.txt` | 5664 | `scheming` |

### Variables on the table `variables`

Since the spec package's format 9 (2026-11-25) its table `variables` (part C4, 75 confirmed
entries) says which keywords set, change, test, read and iterate variables, each with its
namespace (`scope`, `local`, `global`, `dead_character`), the kind of variable (`value`, `list`,
`map`) and where the name is written; the table's own `consumer` text says a name is defined by
the entries that set a value or add to a list or a map, of the same namespace and kind. The five
`variables/*` rows of item 4.7 stood in for it with a name heuristic and stay
[retired](#retired-codes); a check on the table is a row of its own, with a new code.

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `variables/read-without-set` | information | A variable read or tested (`has_variable = x`, `var:x`, `change_global_variable = { name = x }`, an iterator over a variable list) in a namespace and as a kind that no keyword of that namespace and kind sets under its name in the mod or the base game, by the table `variables` | Advice: the table says what each keyword does; that a read of a variable nothing sets finds nothing is pychivalry's reading of it, and no game message is known | new (the table-based successor of the retired `variables/read-never-set`, release 2.3.0's `CK3701`) | `variables-read-without-set` | 4.7 | tables (the table `variables`) | Built (format 9, 2026-11-25). A variable may be set by a keyword of the same namespace and kind that names it, by one that sets a name built with a `$PARAM$` that can become it, or by one whose name is only a `$PARAM$` (`name = $VAR$`) when some file writes the name other than in a variable statement (a value passed to that parameter); a name holding a `$PARAM$` is not judged; without the base game nothing is. Re-proof: applies to 42,001 reads of the base game, fires on 31, its [known exceptions](#known-exceptions-of-the-variables-row): a question for the owner (docs/decisions.md) | None: the variable may be set where the index cannot see, and which set is meant is a choice. |

#### Known exceptions of the variables row

The 31 findings of `variables/read-without-set` on the 1.21.0.3 base game. 13 are names the
game's own code sets: the table's notes say, in words only, that a dynasty perk's `traits` block
saves the trait chosen as `var:<perk_key>_<trait_key>` on the dynasty, and the package gives
those names as no data, so the check cannot know them (a request to the spec work,
docs/decisions.md). The other 18 read a name in another namespace or as another kind than every
statement that sets it, or a name nothing sets: by the table's own words these are told apart,
so each reads nothing the script set, unless the engine does not keep them apart.

| Files | Reads | What is read, and what sets the name |
| --- | ---: | --- |
| `common/on_action/child_birth_on_actions.txt` | 8 | `var:blood_legacy_4_<trait>` on a dynasty: a dynasty perk's trait, set by the game's code |
| `events/education_and_childhood/coming_of_age_events.txt` | 5 | `var:ce1_legitimacy_legacy_5_education_<skill>_5`: a dynasty perk's trait, set by the game's code |
| `common/story_cycles/story_cycle_mongol_invasion.txt` | 7 | `clear_variable_list` of seven names the cycle sets with `set_variable` (values, not lists) |
| `common/decisions/10_religious_decisions.txt` | 3 | `var:body_has_been_disposed`, set with `set_dead_character_variable` (a dead character's variable) |
| `common/scripted_triggers/00_war_and_peace_triggers.txt` | 2 | `var:gg_ended_in_guelph_victory_no_hre_wars_on_theocratic_vassals` and `var:gg_hre_no_cb_northern_italy`, set with `set_global_variable` |
| `common/scripted_triggers/pam_saint_triggers.txt` | 1 | `has_dead_character_variable = no_corpse_left`, set with `set_variable` (a living scope's) |
| `common/scripted_effects/tgp_mandala_scripted_effects.txt` | 1 | `has_variable = plundered_contributors`, set with `add_to_variable_list` (a list) |
| `events/dlc/ep3/ep3_laamp_flavour_ewan_events.txt` | 1 | `has_variable = laamp_recently_visited_kingdoms`, set with `add_to_variable_list` |
| `events/dlc/ep3/ep3_laamp_decision_events.txt` | 1 | `remove_variable ?= list_of_options`, set with `add_to_variable_list` |
| `common/scripted_triggers/10_tgp_natural_disaster_triggers.txt` | 1 | `is_target_in_variable_list = { name = impact_events }`: no statement sets the name |
| `common/on_action/tutorial.txt` | 1 | `global_var:game_tutorial_index`: no statement sets the name |

### Formatting: the `style/` family

Added in build step 8 on the owner's word of 2026-11-23 (decisions 101 and 103): best practice
and cleanliness take precedence over anything a mod author did, so a file that is not in
pychivalry's format is fixed by the formatter and flagged as issues. These rows are one of the two
kinds of warning that rest on no game evidence (the other is the best-practice rows below): their
evidence is pychivalry's own formatting rules
([formatting.md](formatting.md)), by the owner's decision (principle 1 of
[MVP.md](MVP.md#principles)). One warning a file not in the format, whose safe fix formats the
whole file; one hint at each untidy place, one code a rule, each with a safe fix for that place.
Every fix is the formatter's own edit: it changes only the whitespace between tokens, and keeps
the tree (proved on every base-game file, [formatting.md](formatting.md#the-round-trip-on-the-base-game)).
A file with a parse error has none of them, since the formatter leaves it as it is. They go
through the one runner, so the editor, the command line and the agent server report them alike;
the per-file limit bounds them, the warning kept before the hints. The game-file suites count
them by code and never classify them ([records/README.md](../records/README.md)).

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `style/not-formatted` | warning | A file that is not in pychivalry's format: one finding a file, at its first untidy place, saying how many places differ and by which rule | Formatting rules ([formatting.md](formatting.md)), by the owner's decision | new | `style-not-formatted` | 8.2 | none | Built (8.2) | Safe: the whole file formatted. |
| `style/indentation` | hint | A line indented otherwise than one tab for each enclosing block (script), or one space before an entry or a comment (localization) | Formatting rules, rule 1 and rule 13 | new | `style-indentation` | 8.2 | none | Built (8.2) | Safe: the line indented as the format says. |
| `style/spacing` | hint | Two tokens on a line not one space apart: around an operator, inside the braces of a block on one line, between values, before a name's block; an empty block's braces with something between them; an entry's key and its text in a localization file | Formatting rules, rules 2 and 3 | new | `style-spacing` | 8.2 | none | Built (8.2) | Safe: one space between the two tokens, or none between the braces of an empty block. |
| `style/comment-spacing` | hint | A comment at the end of a line not one space after the code before it | Formatting rules, rule 8 | new | `style-comment-spacing` | 8.2 | none | Built (8.2) | Safe: one space before the comment. |
| `style/trailing-whitespace` | hint | Spaces or tabs at the end of a line, of a comment, or on a blank line | Formatting rules, rule 9 | new | `style-trailing-whitespace` | 8.2 | none | Built (8.2) | Safe: the spaces and tabs removed. |
| `style/blank-lines` | hint | Blank lines beyond one between two items, or any after `{`, before `}` or at either end of the file | Formatting rules, rule 7 | new | `style-blank-lines` | 8.2 | none | Built (8.2) | Safe: the blank lines the format does not keep removed. |
| `style/block-layout` | hint | A block laid out otherwise than the format says (on one line when it holds one simple pair, plain values or nothing and fits in 120 columns; otherwise over several lines, one item a line), or a pair's key, operator and value not on one line. One finding a block | Formatting rules, rule 4 | new | `style-block-layout` | 8.2 | none | Built (8.2) | Safe: the block joined onto one line, or one item a line. |
| `style/line-endings` | hint | Line breaks other than Windows line breaks (`\r\n`), or none at the end of the file. One finding a file | Formatting rules, rule 10 | new | `style-line-endings` | 8.2 | none | Built (8.2) | Safe: every line break written as `\r\n`, and one at the end of the file. |
| `style/byte-order-mark` | hint | A file that does not start with the UTF-8 byte-order mark. One finding a file | Formatting rules, rule 11 | new | `style-byte-order-mark` | 8.2 | none | Built (8.2) | Safe: the mark added. In the editor the mark is the file's encoding: saving adds it. |

### Best practice: the `style/` family's best-practice rules

Added in build step 8 on the owner's word of 2026-11-23 (decisions 101, 105 to 107, 109 and
112), and one more on the owner's word of 2026-11-25 (decision 158): best practice and
cleanliness take precedence over anything a mod author did. These rows
rest on pychivalry's own best-practice rules (evidence `best-practice`), not on the game: the
zero exceptions of decision 46 are for advice that claims something about the game, so the base
game breaking one of these does not retire it. A rule the base game breaks more often than it
follows ships only on the owner's word, as `style/unusual-field-order` does in two folders
(decision 109). Each row gives the base game's own rate on 1.21.0.3, counted by
`pychivalry-tools advice proof`, which counts them beside the advice rows. Release 2.3.0's other
style hints are the formatter's (above), and three of its other hints were measured and are not
restored ([below](#the-plug-in-catalogue-85)); two of its information-level content rules came
back on the owner's word (decision 112), LOC-001 and CK3872 (built since format 9 gave part D4 the
roles it needs), and its hint CK3613 came back as a new row since format 9 gave D4 the role of the
keywords it tests (decision 105 had held it for that role); `style/redundant-false-condition`, the
twin of CK3872 for a condition that always fails, is new (decision 158). They go through the one runner; a fix of theirs
that is safe is checked by checking the file again, and after it the formatter finds nothing new
(a test applies each fix to its bad fixture, which is in the format). The game-file suites count
them by code and never classify them. `style/empty-block`, `style/deep-nesting`,
`style/redundant-condition`, `style/redundant-false-condition` and
`style/option-without-ai-weight` judge every folder, with none left out (decisions 109 and 156).

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `style/empty-block` | hint | A block inside a record with nothing in it, or nothing but comments; a record's own body is not judged. Since decision 167 an empty block that means something is still reported but never offered for removal: an iterator whose part D8 kind is a condition (`any_`), read in a trigger block, asks for at least one item, and its message says so and names the test written out with the parameter part D8 points to and the game documents with a number (`count >= 1`, data `means: at-least-one`, `written_out`); an iterator the package does not say how to read where it is written (in a block of the other kind, in a script value or a keyword's parameters, in a block the context reader does not place) gets no fix (`means: not-known`); an effect iterator in an effect block runs no effect when empty and is the usual case; a trigger or an effect of the package's buckets written with an empty block is not offered for removal either, which would take it away (`means: trigger` or `effect`; 43 of the base game's removals; kept by decision 171). Since decision 172 an empty block whose meaning when empty the package leaves open is reported with a message that says so and gets no fix, until the spec work says what it evaluates to: a logical operator, a key part D4 gives the role `combines_conditions` (`OR`, `AND`, `NOT`, `all_false`; `means: logical-operator`); a scope switch, a chain or a name of the links bucket (`scope:target`, `liege`; `scope-switch`); a trigger block, a structural keyword or a parameter whose block the tables read as triggers and that D4 gives no such row (a `limit`, a `random_list` entry's `trigger`; `trigger-block`). Since decision 174 an empty case of a container is reported with a message that says what taking it away would change, and gets no fix: an entry of a random list, a case of a container of the table `containers` whose cases take parameters of their own (`case_params`, the table `random_list_entry`), a chance of nothing whose removal changes the odds of the others (`means: random-entry`); a case of a case list, a container part D4 gives the role `case_list` (`switch`), whose removal lets the fallback run for its value, or leaves its value with no case where none is written (`case`), and the fallback itself, D4's `fallback_case` (`fallback-case`); where the context reader judges no key (a `random_list` inside a `duel`'s outcome, a `switch` in a dynamic description), by the container's name. Since decision 176 an empty option of an event, a key of an event's own body that part D4's event row with the role `event_option` names ("a choice of an event that the player or the AI picks"), shown or hidden, is reported with a message that says taking it away takes that choice away from the player or the AI, and gets no fix (`means: event-option`); a `duel`'s empty outcome is read as before until the spec package gives the table `containers` a row for `duel` (decision 175, relayed to the spec work as its follow-up item 10) | Best practice: pychivalry's own best-practice rules. The base game follows it: 24,274 of the 2,321,663 blocks inside its records are empty (1.05%); of the 21,658 its check lists (2,620 more past the per-file cap), 239 are conditions asking for at least one, 23 iterators the package does not place and 83 triggers or effects; of all 24,274 (`advice proof`, no cap), 2 logical operators, 28 scope switches and 11 trigger blocks, whose 20 removals (1, 12 and 7) decision 172 withdrew, and 263 random list entries, 28 `switch` cases and 1 `fallback`, whose 179 removals (152, 26 and 1) decision 174 withdrew, and 5 options of events (3 of shown events, 2 of hidden ones), whose 5 removals decision 176 withdrew | `CK3314` | `style-empty-block` | 8.2 | The default of an `any_` iterator's `count`, and what an iterator body with no conditions asks of an item, as data (decision 169); until then the write-out is a suggestion. What an empty logical operator, scope switch or trigger block evaluates to (its fourth point); until then they get no fix. A row of the table `containers` for `duel`, whose cases take the parameters of `random_list_entry` (decision 175, relayed to the spec work as its follow-up item 10); until then a `duel`'s empty outcome is offered for removal as before (decision 176) | Built (step 8; the iterators decision 167; the meanings left open decision 172; the cases decision 174; the options of events decision 176) | Suggestion: The empty pair taken away, where the block around it keeps something; whether an empty block means something is the author's to say. Never for an empty iterator that is a condition, which asks for at least one item: its test written out instead, with the parameter the spec package documents for how many items must match; none for an iterator the package does not say how to read where it is written, for a trigger or an effect written with an empty block, for a logical operator, a scope switch or a trigger block (a `limit`), whose meaning when empty the spec package leaves open, for an entry of a random list or a case of a `switch`, its `fallback` among them, whose removal changes the odds of the other entries or lets the fallback run for its value, or for an option of an event, whose removal takes a choice away from the player or the AI. |
| `style/deep-nesting` | hint | A record with a block nested more than six blocks deep, its body the first; one finding a record, at the first such block, with how many places | Best practice: pychivalry's own best-practice rules. The base game follows it: 8,561 of its 222,652 records go past the limit (3.85%; 223,429 and 3.83% before format 9 left out the files that are no script) | `CK3317` | `style-deep-nesting` | 8.2 | none | Built (step 8) | None: how to restructure deep script is a choice. |
| `style/not-utf8` | warning | A file, script or localization, that is not valid UTF-8, and how it was read (as UTF-8 with replacement characters, or with the Windows-1252 fallback): the one finding about such a file (decision 113) | Best practice: pychivalry's own best-practice rules. The base game follows it: 25 of the 17,279 script and localization files it reads are not UTF-8 (0.14%; 17,282 before format 9), all in `history/titles`, each fix safe | new | `style-not-utf8` | 8.2 | none | Built (step 8) | Safe or a suggestion: The file written as UTF-8 with a byte-order mark, its other bytes read as Windows-1252; safe when each such byte reads as a printable character and the file then reads to the same tree. |
| `style/unusual-field-order` | hint | A record whose fields are written in another order than its folder's usual one (the core's field-order data), in a folder whose record fields the game reads by name: eight folders, `common/decisions` and `common/character_interactions` with the order of their `.info` files (decision 109) | Best practice: pychivalry's own best-practice rules. The base game follows it: 2,096 of the 12,528 records it judges are in another order (16.73%): events 1,047 of 10,378, `common/on_action` 48 of 497, `common/casus_belli_types` 52 of 138, `common/court_positions/types` 11 of 87, `common/schemes/scheme_types` 46 of 136, `common/story_cycles` 2 of 55; and, judged on the owner's word though the base game breaks their order more often than it follows it, `common/decisions` 398 of 587 and `common/character_interactions` 492 of 650 | new | `style-unusual-field-order` | 8.2 | none | Built (step 8) | Safe: The record's fields written in the usual order, comments with their field; none where a comment's field is not clear. |
| `style/localization-key-characters` | hint | A localization key that starts with a digit (or `.`) or holds a character other than a letter, a digit, `_` or `.`; one finding a key | Best practice: pychivalry's own best-practice rules. The base game follows it: 15,406 of the 3,100,662 keys of its localization files are such keys (0.50%); 1,675 of its 340,445 English keys (0.49%), mostly a dash (`innovation_men-at-arms`) | `LOC-001` | `style-localization-key-characters` | 8.2 | none | Built (step 8) | None: a key's name is the author's, and renaming it means renaming every use of it. |
| `style/redundant-condition` | hint | A condition that always holds where it changes nothing: release 2.3.0's `always = yes` in a block whose conditions must all hold. Since format 9: a condition of part D4's role `constant_condition` written with its `holds_with` value (`always = yes`), directly in a block of a `combines_conditions` keyword whose `child_always_true` is `neutral` (`AND`, `NAND`, `any_false`), while the block keeps another item | Best practice: pychivalry's own best-practice rules. The base game follows it: 1 of the 9,350 `AND`, `NAND` and `any_false` blocks in its trigger blocks holds an `always = yes` that changes nothing (0.01%; it writes no `any_false`) | `CK3872` | `style-redundant-condition` | 8.2 | keyword roles: part D4's `constant_condition` (`always`, `holds_with: yes`) and `combines_conditions` with `child_always_true` | Built (format 9, 2026-11-25). It never makes a block empty, whose value the package leaves open: a condition alone in its block is not reported, and of a block holding nothing but such conditions every one but the first. A plain trigger block (`trigger`, `limit`) has no `combines_conditions` row (D4's own `not_settled`), so release 2.3.0's 375 `trigger = { always = yes }` are not judged; nor is an `OR` (which the condition makes hold) or a `NOT` (of which the part says nothing). It reads every block part D4 names, whether the reader reads it as a structural keyword (`AND`, `NAND`) or as a trigger whose body holds triggers (`any_false`), on the owner's word of 2026-11-26 (decision 163); neither the base game nor the five mods writes an `any_false`, so no figure moved. On the five mods: none in any of the five. It was blocked for want of those roles (decisions 54 and 112) | Safe: The condition taken away, the block keeping its other conditions; a suggestion where that leaves the file out of the format. |
| `style/redundant-false-condition` | hint | A condition that always fails where it changes nothing: a condition of part D4's role `constant_condition` written with its `fails_with` value (`always = no`), directly in a block of a `combines_conditions` keyword whose `child_always_false` is `neutral` (`OR`, `NOR`, `all_false`), while the block keeps another item | Best practice: pychivalry's own best-practice rules. The base game follows it: 1 of the 39,426 `OR`, `NOR` and `all_false` blocks in its trigger blocks holds an `always = no` that changes nothing (under 0.01%; 16 of the blocks are `all_false`) | new (release 2.3.0's CK3873, `trigger = { always = no }`, is another case and stays not restored) | `style-redundant-false-condition` | 8.2 | keyword roles: part D4's `constant_condition` (`always`, `fails_with: no`) and `combines_conditions` with `child_always_false` | Built (decision 158, 2026-11-25). It never makes a block empty, whose value the package leaves open: a condition alone in its block is not reported, and of a block holding nothing but such conditions every one but the first. It reads every block part D4 names, whether the reader reads it as a structural keyword (`OR`, `NOR`) or as a trigger whose body holds triggers (`all_false`). A plain trigger block (`trigger`, `limit`) has no `combines_conditions` row, so `trigger = { always = no }`, the deliberate way to switch content off, is not judged; nor is an `AND` (which the condition makes fail), a `NAND` (which it makes hold) or a `NOT`. On the five mods: none in any of the five | Safe: The condition taken away, the block keeping its other conditions; a suggestion where that leaves the file out of the format. |
| `style/option-without-ai-weight` | hint | An option of a shown event with several options that has neither of the keywords that weigh it for the AI: part D4's rows of the role `ai_weight` below the option (`ai_chance`, `ai_will_select`). An event is shown when its `hides_from_player` keyword does not hold; an event with one option is not judged | Best practice: pychivalry's own best-practice rules: the AI chooses among an event's options by their weights, and D4 says the game documents no default for an option without one (its `not_settled`). The base game follows it: 4,305 of the 21,581 options of its shown events with several options have neither (19.95%), all in `events`; by the folder an event file is in below it, 15 of 94 break it more often than they follow it ([below](#the-options-without-an-ai-weight-by-folder)) | `CK3613` | `style-option-without-ai-weight` | 8.2 | keyword roles: part D4's `ai_weight` (`ai_chance`, `ai_will_select`; confirmed since format 9), `event_option` and `hides_from_player` | Built (format 9, 2026-11-25); judges every folder, none left out (decision 109) | None: how much the AI should want the option is the author's to say. |

#### The options without an AI weight, by folder

`style/option-without-ai-weight` judges one folder of the spec's list, `events`, and the base game
follows it there (4,305 of 21,581, 19.95%). Counted by the folder an event file is in below
`events/` (94 folders, a one-off count beside the re-proof), 15 break it more often than they
follow it; the rule judges them too, none left out (decision 109):

| Folder | Options without a weight, of those judged |
| --- | ---: |
| `events/activities` | 7 of 11 |
| `events/activities/petition_liege_activity` | 47 of 79 |
| `events/courtier_guest_management_events` | 2 of 2 |
| `events/death_events` | 68 of 75 |
| `events/lifestyles/intrigue_lifestyle` | 140 of 274 |
| `events/passive_rite_learning_events` | 5 of 5 |
| `events/religion_events` | 140 of 277 |
| `events/scheme_events/elope_scheme` | 5 of 9 |
| `events/scheme_events/fabricate_hook_scheme` | 9 of 16 |
| `events/scheme_events/murder_scheme` | 127 of 147 |
| `events/scheme_events/sway_scheme` | 20 of 34 |
| `events/story_cycles/murders_at_court` | 48 of 55 |
| `events/test_events` | 97 of 97 |
| `events/trait_specific_events` | 57 of 100 |
| `events/uprising_events` | 5 of 7 |

### Retired codes

A code that is retired stays here and is never emitted again ([How a code stays
permanent](#how-a-code-stays-permanent)). Eleven below are provisional advice rows that item
4.7's re-proof found firing on the 1.21.0.3 base game; each was retired on the terms of
decisions 46 and 53 before it shipped. The counts come from a one-off script over the built core
and the base game's index, not committed. The twelfth, `encoding/not-utf8`, a step 2 parse note,
was retired on the owner's word (decision 113), its family `encoding` with it.

Since format 9 (2026-11-25) the spec package has the table `variables`, 75 keywords that set,
change, test, read or iterate variables, each with its namespace and where the name is written,
which the five `variables/*` rows below had to stand in for with a name heuristic; and its
`save_keys` lists the effects that save a value under a name. Retired codes stay retired: the
check built on the table is a new row with a new code,
[`variables/read-without-set`](#variables-on-the-table-variables).

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | Retired |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scope/saved-in-immediate-read-in-trigger` | information | A scope read in an event's `trigger` that the event saves only in `immediate`, which runs later | Advice | `CK3550` | `scope-saved-in-immediate-read-in-trigger` | 4.7 | tables (saving effects); keyword roles | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 4,657, fires on 73 (decision 46: an advice row ships only when it fires on none) |
| `scope/saved-late-read-in-triggered-desc` | information | The same, in a `triggered_desc` trigger | Advice | `CK3552` | `scope-saved-late-read-in-triggered-desc` | 4.7 | as above | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 595, fires on 10 (decision 46: an advice row ships only when it fires on none) |
| `scope/temporary-scope-passed-to-event` | information | A scope saved with `save_temporary_scope_as` passed to an event it triggers | Advice | `CK3554` | `scope-temporary-scope-passed-to-event` | 4.7 | as above | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 155, fires on 24 (decision 46: an advice row ships only when it fires on none) |
| `scope/desc-text-reads-scope-saved-late` | information | The `desc` localization text reads a scope the event saves only in an option or in `after` | Advice | `CK3560` | `scope-desc-text-reads-scope-saved-late` | 4.7 | as above; loc fields | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 595, fires on 8 (decision 46: an advice row ships only when it fires on none) |
| `scope/random-save-without-trigger-guard` | information | `immediate` saves a scope from a `random_` iterator, an option uses it, and the trigger has no `any_` check over the same list | Advice | `CK3563` | `scope-random-save-without-trigger-guard` | 4.7 | as above | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 2,569, fires on 1,089 (decision 46: an advice row ships only when it fires on none) |
| `variables/local-read-in-trigger-set-in-immediate` | information | A local variable read in `trigger` and set in `immediate` | Advice | `CK3553` | `variables-local-read-in-trigger-set-in-immediate` | 4.7 | tables (variable effects and triggers) | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 79, fires on 70 (decision 46: an advice row ships only when it fires on none); counted by a name heuristic, as the package has no table of the keywords that set and read variables |
| `variables/read-never-set` | information | A variable read but set nowhere in the mod or the base game's script | Advice | `CK3701` | `variables-read-never-set` | 4.7 | as above | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 37,295, fires on 1,968 (decision 46: an advice row ships only when it fires on none); counted by a name heuristic, as the package has no table of the keywords that set and read variables |
| `variables/set-never-read` | hint | A variable set but read nowhere | Advice | `CK3702` | `variables-set-never-read` | 4.7 | as above | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 13,871, fires on 742 (decision 46: an advice row ships only when it fires on none); counted by a name heuristic, as the package has no table of the keywords that set and read variables |
| `variables/read-in-other-namespace` | information | A variable read as one of `var`, `local_var`, `global_var` and set only as another | Advice | `CK3703` | `variables-read-in-other-namespace` | 4.7 | as above | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 35,327, fires on 2 (decision 46: an advice row ships only when it fires on none); counted by a name heuristic, as the package has no table of the keywords that set and read variables |
| `variables/list-and-value` | information | A variable used both as a list and as a value in one file | Advice | `CK3705` | `variables-list-and-value` | 4.7 | as above | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 599, fires on 18 (decision 46: an advice row ships only when it fires on none); counted by a name heuristic, as the package has no table of the keywords that set and read variables |
| `structure/event-redundant-override-background` | information | An untriggered `override_background` equal to the background its theme shows first | Advice | `CK3433` | `structure-event-redundant-override-background` | 4.7 | keyword roles | 2026-11-23, by item 4.7's re-proof on the 1.21.0.3 base game: applies to 3,511, fires on 206 (decision 46: an advice row ships only when it fires on none) |
| `encoding/not-utf8` | information | A file that is not valid UTF-8 | Advice ([why](#the-step-2-findings)) | new | `encoding-windows-1252` | 2 | none | 2026-11-23, on the owner's word (decision 113): a file not valid UTF-8 shows one finding, the warning `style/not-utf8`, whose message and data now say what this note said, how the file was read |

### Step 10: GUI syntax

Built in `packages/core/src/gui/parser.ts` (item 10.2); the identifier is the code, in the family
`syntax`, each named `syntax/gui-<what>` so that it never meets a code of the script parser's. A
GUI file (`.gui`) gets these findings and no other: no engine check and no `style/` finding reads
it ([gui-syntax.md](gui-syntax.md)). Every one is advice at information: no catalogue message is
shown to be the GUI reader's ([why](#the-gui-syntax-findings)). Each is tested by its pair,
`fixtures/mods/gui-<what>-bad` and `-good`.

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `syntax/gui-missing-closing-brace` | information | A block of a GUI file still open at the end of the file | Advice ([why](#the-gui-syntax-findings)) | new (2.3.0 read GUI files with its script parser) | `gui-missing-closing-brace` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-unexpected-closing-brace` | information | A `}` at the top level of a GUI file, where no block is open | Advice ([why](#the-gui-syntax-findings)) | new | `gui-unexpected-closing-brace` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-operator-without-key` | information | An operator with no key before it | Advice ([why](#the-gui-syntax-findings)) | new | `gui-operator-without-key` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-operator-not-equals` | information | An operator other than `=`: every statement of a GUI file is `key = value` | Advice ([why](#the-gui-syntax-findings)) | new | `gui-operator-not-equals` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-missing-value` | information | `key =` with nothing after it | Advice ([why](#the-gui-syntax-findings)) | new | `gui-missing-value` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-missing-equals` | information | `key { ... }` or `key value` among statements, without its `=` | Advice ([why](#the-gui-syntax-findings)) | new | `gui-missing-equals` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-value-without-key` | information | A value standing among statements with no key | Advice ([why](#the-gui-syntax-findings)) | new | `gui-value-without-key` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-block-without-key` | information | A block with no key among statements | Advice ([why](#the-gui-syntax-findings)) | new | `gui-block-without-key` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-missing-block-name` | information | A named-block keyword (`types`, `template`, `block`, `blockoverride`...) followed by its block with no name | Advice ([why](#the-gui-syntax-findings)) | new | `gui-missing-block-name` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-malformed-type` | information | A type definition not written `type <name> = <base> { ... }` | Advice ([why](#the-gui-syntax-findings)) | new | `gui-malformed-type` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-trailing-semicolon` | information | A `;` after a statement, which GUI syntax does not use | Advice ([why](#the-gui-syntax-findings)) | new | `gui-trailing-semicolon` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-unterminated-string` | information | Quoted text without its closing quote | Advice ([why](#the-gui-syntax-findings)) | new | `gui-unterminated-string` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |
| `syntax/gui-malformed-arithmetic` | information | `@[ ... ]` that is not well formed, or has no `]` | Advice ([why](#the-gui-syntax-findings)) | new | `gui-malformed-arithmetic` | 10.2 | the GUI reader's messages | Built (step 10) | None: no fix is offered in a GUI file; build step 10 leaves GUI files out of the formatter and of the fixes (docs/gui-syntax.md). |

### Step 10: graphics

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `graphics/missing-file` | warning | A `.dds`, `.png` or `.tga` path that exists in neither the mod, the base game nor a DLC pack. Silent when no game folder is set | Catalogue `failed_to_load_texture_X_file_not_found` ("Failed to load texture %s - file not found") | `GFX001` | `graphics-missing-file` | 10.5 | value types (which fields hold a texture path; 2.3.0 read nine names from its own code) | Not built: step 10 | Not built |

### Step 11: the game's error log

How a log line is tied to a file and line, and whether a tied line takes the code of the static
check with the same catalogue entry, is decided in items 11.2 and 11.3 from captured logs.

| Code | Severity | What it finds | Evidence | Replaces | Fixture pair | Item | Needs from the spec | State | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `log/game-message` | warning | A line of the game's own error log that names a file and line of the mod | Game output: the game's error log for the build it ran | new (2.3.0's log analyser had no codes) | `log-game-message` (with a captured log) | 11.3 | clean catalogue (to match lines) | Not built: step 11 | Not built |
| `log/unmatched-line` | information | A line of the log that cannot be tied to the mod; listed, never dropped | Advice | new | `log-unmatched-line` | 11.3 | none | Not built: step 11 | Not built |

## The inventory in numbers

78 rows: 11 built in step 2, and 67 proposed; 79 with the row format 9 added,
`variables/read-without-set`; 92 with step 10's thirteen rows of GUI syntax. By state, after items 4.2 to 4.11 (2026-11-23) and the checks
format 9 unblocked (2026-11-25):

| State | Rows | Which |
| --- | ---: | --- |
| Built | 60 | Step 2's 10 (its eleventh retired); 4.2's 4 others; 4.4's 3; 4.5's 10 others (`structure/triggered-desc-other-field` since format 9); 4.6's all 4 (the opener left open of `localization/unbalanced-brackets` since format 9); 4.7's 28 others (`scope/title-text-reads-scope-saved-late` since format 9); and `variables/read-without-set`, new with format 9 |
| Built in part | 4 | `names/unknown-trigger` and `names/unknown-effect` (the iterator sub-cases wait on the owner), `fields/wrong-kind-of-value` (7 value groups of 9: block and word fire on correct mod script), `references/unknown-name` (the game-concept half waits for the package to define a concept's aliases, docs/decisions.md row 151) |
| Retired | 12 | The provisional advice rows item 4.7's re-proof found firing on the base game, and `encoding/not-utf8` (decision 113) ([Retired codes](#retired-codes)) |
| Not built yet | 3 | `graphics/missing-file` (step 10), `log/game-message` and `log/unmatched-line` (step 11) |
| Built, step 10 | 13 | The GUI parser's codes, `syntax/gui-*`, all advice at information ([Step 10: GUI syntax](#step-10-gui-syntax)) |
| Built, step 8 | 17 | The `style/` family, added on the owner's word of 2026-11-23: nine rows on pychivalry's own formatting rules ([Formatting](#formatting-the-style-family)), one warning and eight hints; eight on its own best-practice rules ([Best practice](#best-practice-the-style-familys-best-practice-rules)), one warning and seven hints, `style/redundant-condition` built and `style/option-without-ai-weight` added since format 9 gave part D4 the roles they read, and `style/redundant-false-condition` added on the owner's word of 2026-11-25 (decision 158) |

The tables below are the inventory as item 4.1 proposed it.

| Group | Rows | Error | Warning | Information | Hint |
| --- | ---: | ---: | ---: | ---: | ---: |
| Step 2 (built) | 11 | 8 | 0 | 3 | 0 |
| 4.2 unknown names | 6 | 5 | 1 | 0 | 0 |
| 4.4 scope | 3 | 3 | 0 | 0 | 0 |
| 4.5 fields and structure | 11 | 5 | 4 | 2 | 0 |
| 4.6 event targets and localization | 4 | 0 | 2 | 1 | 1 |
| 4.7 advice that holds | 27 | 0 | 0 | 26 | 1 |
| 4.7 advice, provisional | 13 | 0 | 0 | 12 | 1 |
| Step 10 | 1 | 0 | 1 | 0 | 0 |
| Step 11 | 2 | 0 | 1 | 1 | 0 |
| **All** | **78** | **21** | **9** | **45** | **3** |

By the kind of evidence:

| Evidence | Rows | Of which error / warning / information |
| --- | ---: | --- |
| Catalogue (1.20 stand-in, found in the 1.21 executable) | 27 | 20 / 6 / 1 (`scope/undefined-event-target`, information by the MVP's decision) |
| Required field, with its catalogue message | 1 | 1 / 0 / 0 |
| Executable (1.21 only, not yet in the catalogue) | 1 | 0 / 1 / 0 |
| Game output (documentation dump, error log) | 2 | 0 / 2 / 0 |
| Reproduced in-game error | 0 | — |
| Advice | 47 | 0 / 0 / 47 (44 information, 3 hints) |

Release 2.3.0's 108 codes (23 of its engine, 85 of its plug-in catalogue) land as follows
(table [below](#release-230s-codes-one-by-one)):

| Outcome | Engine | Plug-in | All |
| --- | ---: | ---: | ---: |
| Carried over at the same severity (some folded into one code) | 20 | 31 | 51 |
| Carried over, demoted: an error or warning without game evidence | 3 | 0 | 3 |
| Carried over, raised: folded into a code with evidence | 0 | 2 | 2 |
| Carried over provisionally (re-proved in 4.7) | 0 | 13 | 13 |
| Not carried over | 0 | 39 | 39 |
| **All** | **23** | **85** | **108** |

## The step 2 findings

The eight with a catalogue message stay errors (their rows are above). The three without one
were made information by build step 2 (decisions.md, step 2). This item looked for their
evidence in the committed catalogue (all 1,968 texts) and in the 1.21.0.3 Linux executable
(725,545 strings of six characters or more, read with `strings`), and proposes to **keep all
three at information**:

| Code | Searched for | Found | Proposal |
| --- | --- | --- | --- |
| `syntax/unterminated-string` | `unterminat`, `quot`, `end of file`, `eof`, `unclosed`, `unmatched`, `string` | Catalogue: nothing about script text. Executable: `UnterminatedString`, a token name beside the `pdx_ast` parser's own grammar messages; "Unreadable String" beside the script reader (`pdx_persistent_reader.cpp`), not in the catalogue and with no condition in its words | Keep information. Neither text says the game reports quoted text left open in a script file |
| `syntax/malformed-arithmetic` | `@[`, `inline`, `math`, `arithmetic`, `formula`, `parse`, the `Expected: <...>` family | Catalogue: `failed_to_parse_advanced_statement_arithmetic_expression` ("Failed to parse advanced statement arithmetic expression") and `invalid_character_X_in_advanced_statement`. The executable keeps both inside the script reader, between the messages for `@` variables ("Unknown variable '{}'", "Invalid variable name ..."). The `Expected: <@[>`, `Expected: <]>`, `Expected: <math-scalar>` family belongs to the separate `pdx_ast` parser | Keep information until "advanced statement" is shown to mean `@[ ... ]`: by the cleaned catalogue marking the message script-facing, or by the planted-defect capture of item 11.1. Then raise it to an error with `failed_to_parse_advanced_statement_arithmetic_expression` as its evidence. The alternative, raising it now on the text alone, is question 5 |
| `encoding/not-utf8` (retired 2026-11-23, decision 113) | `utf`, `unicode`, `ansi`, `encod`, `bom`, `byte`, `invalid char` | Catalogue: only "Failed to read culture history / title history, not a valid date at: {} (check encoding, should be ansi)", about history dates. Executable: "File '%s' should be in utf8-bom encoding (will try to use it anyways)" beside the script lexer, "Missing UTF8 BOM in '%s'", "Failed conversion of utf8 string: %s"; none in the catalogue, and none says what happens to an invalid byte | Keep information. The game ships and loads 27 files that are not valid UTF-8 ([encoding.md](encoding.md)), so it does not refuse them |

## The GUI syntax findings

Build step 10 (item 10.2) looked for the message the game prints for each defect of GUI syntax,
in the committed catalogue (2,671 entries, 57 with the subject `gui`) and in the 1.21.0.3 Linux
executable (725,545 strings of six characters or more, read with `strings -n 6`), and found none
it can tie to the GUI reader, so all thirteen codes are **advice at information**:

- The executable keeps the GUI loader's words beside its source files `pdx_gui_file.cpp` and
  `pdx_gui_factory.cpp` (`types `, `using = `, `template `, `block "`, `blockoverride "`), and
  the messages kept there are about what a statement names, not how it is written: "failed
  reading property, at line %d in file %s", "'%s' is not a valid widget/type/property"
  (`X_is_not_a_valid_widget_type_property`), "Could not find template '%s'",
  `type_X_already_registered_at_X_X` and `template_X_already_registered_at_X_X`. Those are the
  GUI vocabulary's, after the MVP (docs/MVP.md).
- The script reader's parse messages, which the step 2 codes cite, sit beside
  `pdx_persistent_reader.cpp` and `pdx_reader_actions.cpp`; whether the GUI loader reads its
  files through that reader is not shown by the strings.
- A third parser, `pdx_ast_parser.cpp`, keeps the `Expected: <...>` family (`expected_7`,
  "Expected: <{>", `expected_rhs`, "Expected: <rhs>", ...) and node names that match GUI syntax
  (`named_list`, `variable_definition`, `math_expr`); its other users in the executable are tool
  states (the map editor's nudger, the log viewer), and nothing ties it to `.gui` files.

Which reader reads a `.gui` file, and which message it prints for each defect, is a request to
the spec work ([decisions.md](decisions.md)); with that evidence a code can be raised to an
error, as a changed severity, never a new code. Until then a GUI file that does not parse is
still read as far as the parser can, and every finding says what it found.

## Where the executable keeps each message

A compiled program keeps the text of each message near the other texts of the source file that
uses it, and the Linux build of the game keeps those source files' paths among its strings
([references/game-files.md](references/game-files.md#the-linux-executable)). Every catalogue
message this page cites was found, word for word, in the 1.21.0.3 executable, so each is still
the game's own text on 1.21. The nearest source path says which part of the game holds it.

This is a hint, not proof: a compiler keeps one copy of a text that several files use, beside
one of them, so a context shows a place that uses the message, not every place. Four contexts
are narrower than the check that cites the message:

| Message | Kept beside | What it means here |
| --- | --- | --- |
| `unknown_X_in_X` ("Unknown {} in {}") | `provincehistory.cpp`, the province-history reader | 2.3.0 cited it for an unknown field of any record. Whether the game prints it for another record is not shown. Question 6 |
| `unexpected_token_X_found_at_X_expected` | `faith_history_entry.cpp` | Cited by two built syntax findings and by `fields/bare-value-in-record`. The planted-defect capture of item 11.1 should include one defect for each, so item 11.5 can say whether the game prints it |
| `trying_to_use_X_link_on_an_invalid_scope_X` | `court_position_links.cpp` | Cited by `scope/link-on-wrong-scope`. The executable also has `event_target_link_X_did_not_get_a_matching_scope_type_expect` ("Event target link '%s' did not get a matching scope type. Expected '%s', but got '%s'") beside the generic scope code (`jomini_eventscope.cpp`), a candidate the capture can settle |
| `unknown_trait_X_in_event_at_X` ("Unknown trait {}, in event at {}") | `eventoption.cpp`, beside "Invalid skill {}, at {}" and "The event option already has the trait {} set" | It is the message for an event option's `trait` field, not for `has_trait` or `add_trait`, for which 2.3.0's CK3800 also cited it. `references/unknown-key` uses it only for the option's field |

The others sit where their check expects: the script reader (`pdx_persistent_reader.cpp`) for
the parse messages and the `@[ ]` messages; the script system's trigger, effect, event-target
and event-manager files (`jomini_trigger.cpp`, `jomini_effect.cpp`, `jomini_eventtarget.cpp`,
`jomini_eventmanager.cpp`) for the unknown names, the scopes, the event targets, the namespace
and the duplicated event id; `jomini_scriptvalue.cpp` for the range; `event.cpp` for the
non-character event; `casus_belli.cpp`, `character_interaction_category.cpp` and `databases.cpp`
for the three required fields; `characterhistory.cpp` for the duplicate character id;
`modifier_instance.cpp` for the unknown modifier; `pdx_data_localize.cpp` for the localization
brackets; `mapgraphics.cpp` for the missing texture. `unexpected_token_expected_key` has no
source path near it.

## Release 2.3.0's codes, one by one

Severity changes are in bold. "Base game" counts are on 1.21.0.3; where a count decided the
outcome, it is the number of base-game records the old check would fire on.

### The engine's codes (23)

Fourteen catalogue ids the engine reported directly, the three catalogue messages it reported
for required fields, and its six package-local ids.

| 2.3.0 code | 2.3.0 severity | New code | New severity | Reason |
| --- | --- | --- | --- | --- |
| `expected_after_arguments` | error | `syntax/missing-closing-brace` | error | Same finding |
| `unexpected_token_expected_key` | error | `syntax/unexpected-closing-brace`, `syntax/block-without-key`, `syntax/operator-without-key` | error | One message, three findings |
| `expected_between_equals_and_arguments` | error | `syntax/missing-value` | error | Same finding |
| `unexpected_token_X_found_at_X_expected` | error | `syntax/missing-operator`, `syntax/null-safe-operator-after-value`, `fields/bare-value-in-record` | error | One message, three findings |
| `expected_between_block_name_and_body` | error | `syntax/missing-equals-before-block` | error | Same finding |
| `unknown_trigger_X` | error | `names/unknown-trigger` | error | Same finding |
| `unknown_effect_X` | error | `names/unknown-effect` | error | Same finding |
| `unknown_modifier_type_X_at_X` | error | `names/unknown-modifier` | error | Same finding |
| `failed_to_parse_data_for_event_target_link_link_X_location_X` | error | `names/unknown-link` | error | Same finding |
| `trying_to_use_X_link_on_an_invalid_scope_X` | error | `scope/link-on-wrong-scope` | error | Same finding |
| `wrong_scope_for_trigger_X_expected_X` | error | `scope/wrong-scope-for-trigger` | error | Same finding |
| `wrong_scope_for_effect_X_expected_X` | error | `scope/wrong-scope-for-effect` | error | Same finding |
| `undefined_event_target_X` | information | `scope/undefined-event-target` | information | Same finding |
| `unknown_X_in_X` | warning | `fields/unknown-field` | warning | Same finding; its evidence is in doubt (question 6) |
| `casus_belli_X_missing_on_invalidated_desc` | error | `fields/missing-required-field` | error | One code for every required field; the message is the evidence |
| `invalid_or_undefined_index_for_character_interaction_categor` | error | `fields/missing-required-field` | error | As above |
| `missing_or_invalid_tutorial_chain_for_tutorial_lesson_X` | error | `fields/missing-required-field` | error | As above |
| `PYCH-P001` | error | `syntax/unterminated-string` | **information** | No game message (done in step 2; confirmed above) |
| `PYCH-P002` | error | `syntax/malformed-arithmetic` | **information** | No game message shown to apply (done in step 2; a candidate is recorded above) |
| `PYCH-R001` | error | folded into `names/unknown-trigger`, `-effect`, `-modifier`, `-link` | error | A removed keyword is unknown to the game, which reports it with the unknown-name message; the replacement travels as data and as a fix |
| `PYCH-R002` | error | as `PYCH-R001` | error | As above, with no replacement |
| `PYCH-S002` | error | `fields/missing-required-field` | error | The fallback text for a required field without a message; the spec's required flag is the evidence |
| `PYCH-S003` | warning | `structure/namespace-outside-events` | **information** | No game message: a file outside `events/` that declares a namespace is pychivalry's own observation |

### The plug-in catalogue (85)

| 2.3.0 code | 2.3.0 severity | New code | New severity | Reason |
| --- | --- | --- | --- | --- |
| `CK3550` | information | `scope/saved-in-immediate-read-in-trigger` | information | Provisional: re-proved in 4.7 |
| `CK3551` | information | `scope/saved-late-read-in-desc` | information | Provisional |
| `CK3552` | information | `scope/saved-late-read-in-triggered-desc` | information | Provisional |
| `CK3553` | information | `variables/local-read-in-trigger-set-in-immediate` | information | Provisional |
| `CK3554` | information | `scope/temporary-scope-passed-to-event` | information | Provisional |
| `CK3560` | information | `scope/desc-text-reads-scope-saved-late` | information | Provisional |
| `CK3561` | information | `scope/title-text-reads-scope-saved-late` | information | Provisional; built since format 9 (part D9), re-proof: applies to 757, fires on 0 |
| `CK3563` | information | `scope/random-save-without-trigger-guard` | information | Provisional |
| `CK3301` | hint | not carried over | — | Style belongs to the formatter of step 8. The base game mixes tabs and spaces on 95,860 lines |
| `CK3303` | hint | not carried over | — | Style; 158,788 base-game lines have spaces in their indentation |
| `CK3304` | hint | not carried over | — | Style; 41,284 base-game lines end in whitespace |
| `CK3306` | hint | not carried over | — | Style; about 165,000 base-game lines have an `=` without a space beside it |
| `CK3314` | hint | not carried over | — | The base game writes 25,874 empty blocks on purpose. Since 2026-11-23 (decision 105) restored as `style/empty-block`, hint, a best-practice rule: the base game breaks it in 1.05% of its blocks |
| `CK3316` | hint | not carried over | — | Style; 15,746 base-game lines are longer than 120 characters. Since 2026-11-23 the formatter's 120-column rule (decision 102, `style/block-layout`) |
| `CK3317` | hint | not carried over | — | Style; 116,096 base-game blocks are nested deeper than six. Since 2026-11-23 (decision 105) restored as `style/deep-nesting`, hint, one finding a record: the base game breaks it in 3.83% of its records |
| `CK3330` | information | not carried over | — | A guess at the line of a missing `}`, beside the parse error that already reports it |
| `CK3331` | information | not carried over | — | The same for an extra `}` |
| `COND-001` | information | not carried over | — | The base game writes 12 of its 89,641 `if`-like blocks without `limit` |
| `COND-002` | information | not carried over | — | The base game gives 27 of its 14,062 `else` and `trigger_else` blocks a `limit` |
| `COND-003` | information | `structure/else-without-if` | information | Holds: 0 on the base game |
| `CK4101` | warning | `localization/missing-key` | warning | Literal text in a key field is a missing key to the game; one code |
| `CK4102` | warning | `localization/missing-key` | warning | As above, for `custom_tooltip` |
| `CK4100` | warning | `localization/missing-key` | warning | Same finding |
| `EVENT-001` | information | `structure/event-unknown-type` | information | Holds: 0 of 10,836 |
| `EVENT-002` | information | `structure/event-letter-without-sender` | information | Holds: 0 of 705 |
| `EVENT-010` | information | folded into `structure/event-undeclared-namespace` | **warning** | The game's message names an event whose namespace its file does not define; a file that defines none is that case for every event. Item 11.1's capture confirms it |
| `EVENT-016` | warning | `structure/event-undeclared-namespace` | warning | Same finding |
| `CK3005` | information | `structure/logic-operator-without-block` | information | Holds: 0 of 96,420 |
| `CK3421` | information | `fields/usually-present` | information | Every one of the base game's 15,292 portrait blocks has `character` |
| `CK3422` | information | `references/unknown-name` | information | 4 of 16,776 base-game uses name no animation; kept as advice, the four listed by 4.7 |
| `CK3423` | information | `structure/event-triggered-animation-without-trigger` | information | Holds: 0 of 3,124 |
| `CK3424` | information | `structure/event-triggered-animation-without-animation` | information | Holds: 0 of 3,124 |
| `CK3425` | information | not carried over | — | The base game writes 13 of its 142 `triggered_outfit` blocks without `trigger` |
| `CK3426` | information | `structure/event-portrait-position-twice` | information | Holds: 0 |
| `CK3430` | warning | `references/unknown-key` | warning | One code for every database key, from the value types instead of two field names in code |
| `CK3431` | warning | `references/unknown-key` | warning | As above |
| `CK3433` | information | `structure/event-redundant-override-background` | information | Provisional |
| `CK3450` | information | not carried over | — | The base game ships 21 options without `name` |
| `CK3510` | information | `structure/trigger-else-without-trigger-if` | information | Holds: 0 |
| `CK3511` | information | not carried over | — | 34 base-game blocks hold several `trigger_else` |
| `CK3520` | information | not carried over | — | 2 of the base game's 1,274 hidden events have `after` |
| `CK3521` | information | `structure/event-after-without-option` | information | Holds: 0 of 2,641 |
| `CK3522` | hint | not carried over | — | 235 base-game `after` blocks only clean up. Measured again for decision 105 (264 of 2,643 `after` blocks, 9.99%) and not restored: cleaning up is the better practice, so the rule is a claim about the game, and it could be built only from a name pattern (`remove_`, `clear_`) |
| `CK3610` | information | not carried over | — | 10 base-game `ai_chance` blocks have a negative base |
| `CK3611` | information | not carried over | — | 1,024 base-game `ai_chance` blocks total zero whatever applies |
| `CK3612` | information | not carried over | — | 222 of the 9,658 base-game `ai_chance` blocks that can be totalled can go negative |
| `CK3613` | hint | `style/option-without-ai-weight` (since format 9) | hint | 4,305 base-game options of several-option events have neither `ai_chance` nor `ai_will_select`. Measured again for decision 105 (4,305 of 21,581 options, 19.95%): a best practice the base game follows, held for want of a part D4 role for those two keys, which a check may not name (decision 54). Since format 9 (2026-11-25) D4 gives both the role `ai_weight` (confirmed), and the rule is back as a new best-practice row, re-measured: 4,305 of 21,581 (19.95%) |
| `CK3614` | information | not carried over | — | 110 base-game `ai_chance` modifiers have no trigger |
| `CK3656` | information | not carried over | — | The base game writes an inline `opinion` in 8,524 of its 10,724 `add_opinion` blocks |
| `CK3762` | information | not carried over | — | 12 of the base game's 1,274 hidden events have options |
| `CK3763` | information | `structure/event-without-option` | information | Holds: 0 of 9,562 |
| `CK3764` | information | `structure/event-without-desc` | information | Holds: 0 of 9,562 |
| `CK3765` | information | not carried over | — | 711 of the base game's 9,562 shown events have no `title` |
| `CK3766` | information | `structure/event-several-after` | information | Holds: 0 |
| `CK3767` | information | `structure/event-empty` | information | Holds: 0 |
| `CK3768` | information | `structure/event-several-immediate` | information | Holds: 0 |
| `CK3769` | information | not carried over | — | 980 shown base-game events have no portrait |
| `CK3872` | information | `style/redundant-condition` | **hint** | The base game writes `trigger = { always = yes }` 375 times. Since 2026-11-23 (decision 112) `style/redundant-condition`, hint, a best-practice rule; blocked for want of D4 roles for `always` and the logical operators, built since format 9 gave them (2026-11-25). It judges the blocks whose `child_always_true` is `neutral` (`AND`, `NAND`, `any_false`); a plain trigger block has no such row, so the 375 are not judged; the base game breaks it in 1 of 9,350 such blocks |
| `CK3873` | hint | not carried over | — | The base game writes `trigger = { always = no }` 222 times, on purpose. Measured again for decision 105 (223 of 84,772 trigger blocks) and not restored: it is the deliberate way to switch content off, which release 2.3.0's own text says. Since decision 158 the new row `style/redundant-false-condition` judges another case, an `always = no` directly in an `OR`, a `NOR` or an `all_false` beside other conditions, where it changes nothing; a plain trigger block stays unjudged |
| `CK3875` | information | not carried over | — | 1,717 of the base game's 10,128 `random_` iterators have no `limit` |
| `CK3977` | information | not carried over | — | 3,425 of its 10,369 `every_` iterators have no `limit` |
| `CK5137` | information | not carried over | — | 3,441 of the base game's 3,517 `is_alive` checks have no `exists` beside them |
| `CK3701` | information | `variables/read-never-set` | information | Provisional; retired. Since format 9 the table-based `variables/read-without-set`, a new row |
| `CK3702` | hint | `variables/set-never-read` | hint | Provisional |
| `CK3703` | information | `variables/read-in-other-namespace` | information | Provisional |
| `CK3705` | information | `variables/list-and-value` | information | Provisional |
| `CK3800` | warning | `references/unknown-key` | warning | A trait is a database key. Its message belongs to an event option's `trait` field ([above](#where-the-executable-keeps-each-message)); elsewhere the database message applies |
| `CK3956` | information | not carried over | — | 3 base-game scripted effects or triggers call themselves |
| `VALUE-002` | error | `structure/range-min-above-max` | error | Same finding |
| `VALUE-004` | information | `structure/else-without-if` | information | The same rule inside script values; one code |
| `VALUE-005` | information | not carried over | — | 601 of the base game's 2,588 script values with arithmetic have no `value` |
| `VALUE-006` | information | `structure/round-to-not-positive` | information | Holds: 0 of 20 |
| `ITER-003` | information | not carried over | — | 41 of the base game's 1,662 `ordered_` iterators have no `order_by` |
| `ITER-004` | information | not carried over | — | 1,298 have neither `position` nor `max` |
| `SWITCH-001` | information | `structure/switch-without-trigger` | information | Holds: 0 of 1,007 |
| `SWITCH-002` | information | `structure/switch-without-branches` | information | Holds: 0 of 1,007 |
| `SWITCH-003` | warning | folded into `names/unknown-trigger` | **error** | The game reports a switch trigger that is no trigger with the unknown-trigger message, which the engine already raised as an error |
| `GFX001` | warning | `graphics/missing-file` | warning | Same finding |
| `LOC-001` | information | `style/localization-key-characters` | **hint** | 1,675 of the base game's 340,445 English keys break 2.3.0's rule (a dash, a leading digit: `innovation_men-at-arms`), and the base game ships them. Since 2026-11-23 (decision 112) restored as `style/localization-key-characters`, hint, a best-practice rule: 2.3.0's reason, that its own index could not read such a key, is no claim about the game |
| `LOC-002` | information | not carried over | — | Judged against a hand-made list of functions. Returns only as a new row when the spec carries the game's data-types dump |
| `LOC-003` | information | not carried over | — | Judged against a hand-made list of formatting codes |
| `LOC-004` | information | not carried over | — | Judged against incomplete extracted icon data |
| `LOC-005` | warning | `localization/unbalanced-brackets` | warning | Same finding |
| `LOC-006` | information | `references/unknown-name` | information | A concept is a base-game definition; re-proved in 4.7 |
| `LOC-007` | information | not carried over | — | Its basis is a convention; the part with game evidence, an unclosed `$`, is `localization/unbalanced-brackets` |

## The pre-2.0 rules, one by one

The 32 hand-written schema files of pychivalry before release 2.0 are kept in `pdx-parser-re`
under `research/seeds`. They hold 38 `required:` flags (32 say a field is required, 6 say it is
not) and 89 `diagnostic:` rule entries, naming 87 distinct codes (`CK3760` and `CK3872` are each
used twice). They also hold 6 codes for counts and invalid values (`count_diagnostic`,
`invalid_diagnostic`) and 8 codes declared in a file's header that no rule uses; those 14 are
reviewed after the 89. Nothing of the files is copied here: each row says what the rule claims
in its own words, how it fares on the 1.21.0.3 base game, and the verdict.

**The verdict rule.** A rule **returns as advice** when it holds on the 1.21 base game: it
applies to at least 10 base-game records and fires on none. It is **covered** when a row with
game evidence already finds the same thing. Otherwise it is **dropped**: the base game does what
the rule forbids (and the game accepts the base game), the rule names a field or folder 1.21
does not have, or the base game has too few records to judge. A reference check (a name that
must be defined) is the exception: base-game firings there are references to names the base
game itself does not define, and are listed, not taken as proof the rule is false.

### The 38 required-field flags

| # | File | Field | Flag | Records | With | Without | Verdict |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | activity_group_types | sort_order | not required | 6 | 6 | 0 | Dropped: an optional flag raises nothing |
| 2 | activity_group_types | gui_tags | not required | 6 | 3 | 3 | Dropped: raises nothing |
| 3 | activity_locales | on_enter_locale | required | 6 | 6 | 0 | Dropped: 6 records only |
| 4 | activity_locales | visuals | required | 6 | 6 | 0 | Dropped: 6 records only |
| 5 | activity_locales | visuals > reference | required | 21 | 21 | 0 | Advice: `fields/usually-present` |
| 6 | activity_types | is_shown | required | 24 | 24 | 0 | Advice: `fields/usually-present` |
| 7 | artifacts | slot | required | 69 | 69 | 0 | Advice: `fields/usually-present` |
| 8 | council_tasks | position | required | 75 | 75 | 0 | Advice: `fields/usually-present` |
| 9 | culture_traditions | category | required | 207 | 207 | 0 | Advice: `fields/usually-present` |
| 10 | decision_group_types | sort_order | not required | 23 | 23 | 0 | Dropped: raises nothing (its rule, #18 below, returns) |
| 11 | decision_group_types | important_decision_group | not required | 23 | 4 | 19 | Dropped: raises nothing (its rule, #19 below, returns) |
| 12 | decisions | ai_check_interval | required | 587 | 103 | 484 | Dropped: 1.21 writes `ai_check_interval_by_tier` in most decisions; 9 have neither |
| 13 | decisions | effect | required | 587 | 587 | 0 | Advice: `fields/usually-present` |
| 14 | dynasty_legacies | track | required | 24 | 0 | 24 | Dropped: the folder holds the tracks themselves; a perk names its track with `legacy` (120 of 120 perks) |
| 15 | events | type | required | 10,836 | 9,727 | 1,109 | Dropped: `_events.info`: optional, defaults to `character_event` |
| 16 | events | title | required | 10,836 | 8,851 | 1,985 | Dropped: 711 of the 1,985 are shown events |
| 17 | events | option > name | required | 24,498 | 24,477 | 21 | Dropped |
| 18 | events | portrait > character | required | 15,292 | 15,292 | 0 | Advice: `fields/usually-present` (2,388 more portraits are a single value, `left_portrait = root`, and hold no field) |
| 19 | events | triggered_desc > trigger | required | 17,965 | 17,797 | 168 | Dropped |
| 20 | events | triggered_desc > desc | required | 17,965 | 17,959 | 6 | Dropped |
| 21 | faith_doctrines | group | required | 0 | — | — | Dropped: `common/religion/doctrines` holds no file in 1.21; doctrines are in `doctrine_types` and write `doctrine_group_type` |
| 22 | guest_invite_rules | effect | required | 65 | 65 | 0 | Advice: `fields/usually-present` |
| 23 | intents | icon | not required | 69 | 63 | 6 | Dropped: raises nothing |
| 24 | intents | scripted_animation | required | 69 | 69 | 0 | Advice: `fields/usually-present` |
| 25 | intents | triggered_animation > trigger | required | 4 | 4 | 0 | Dropped: 4 records only |
| 26 | intents | triggered_animation > animation | required | 4 | 4 | 0 | Dropped: 4 records only |
| 27 | intents | ai_targets > ai_recipients | required | 20 | 20 | 0 | Advice: `fields/usually-present` |
| 28 | pulse_actions | icon | not required | 328 | 284 | 44 | Dropped: raises nothing |
| 29 | pulse_actions | is_valid | required | 328 | 328 | 0 | Advice: `fields/usually-present` |
| 30 | pulse_actions | weight | required | 328 | 327 | 1 | Dropped |
| 31 | pulse_actions | effect | required | 328 | 328 | 0 | Advice: `fields/usually-present` |
| 32 | pulse_actions | add_activity_log_entry > key | required | 324 | 324 | 0 | Advice: `fields/usually-present` |
| 33 | pulse_actions | add_activity_log_entry > tags | required | 324 | 324 | 0 | Advice: `fields/usually-present` |
| 34 | pulse_actions | add_activity_log_entry > character | required | 324 | 324 | 0 | Advice: `fields/usually-present` |
| 35 | schemes | skill | required | 136 | 136 | 0 | Advice: `fields/usually-present` (the folder is `common/schemes/scheme_types` in 1.21) |
| 36 | story_cycles | triggered_effect > trigger | required | 262 | 255 | 7 | Dropped |
| 37 | story_cycles | triggered_effect > effect | required | 262 | 262 | 0 | Advice: `fields/usually-present` |
| 38 | struggles | phases | required | 2 | 0 | 2 | Dropped: 1.21 writes `phase_list` (2 of 2) |

**In numbers:** 17 return as advice, all through `fields/usually-present`; none is covered by a
check with evidence (none of the 38 fields has a catalogue message); 21 are dropped: 8 do not
hold, 3 name a field or folder 1.21 does not use, 4 have too few records, and the 6 "not
required" flags raise nothing. Not one of the 32 "required" flags matches a field the spec
marks required with game evidence.

### The 89 rule codes

"Records" is how many base-game records the rule applies to; "fires" how many it would fire on.
The severity is the one the seed file states, or "—" where it states none.

| # | Code | File | What it claims (seed severity) | Records | Fires | Verdict |
| ---: | --- | --- | --- | ---: | ---: | --- |
| 1 | LOC001 | activity_locales | An activity locale needs `on_enter_locale` (error) | 6 | 0 | Dropped: 6 records only |
| 2 | LOC002 | activity_locales | It needs `visuals` (error) | 6 | 0 | Dropped: 6 records only |
| 3 | ACT001 | activity_types | An activity type needs `is_shown` (error) | 24 | 0 | Advice: `fields/usually-present` |
| 4 | ACT007 | activity_types | `province_filter` must be one of seven names (error) | 21 | 12 | Advice: `fields/unusual-value`, with the base game's own values; its seven names are out of date |
| 5 | ACT008 | activity_types | `province_filter = landed_title` or `geographical_region` needs `province_filter_target` (warning) | 0 | 0 | Dropped: no base-game record to judge |
| 6 | ACT010 | activity_types | `select_scripted_location` needs `location_source = scripted` (warning) | 0 | 0 | Dropped: no base-game record to judge |
| 7 | ARTIFACT-001 | artifacts | An artifact type needs `slot` (—) | 69 | 0 | Advice: `fields/usually-present` |
| 8 | BUILD-001 | buildings | A building needs `cost` (warning) | 3,548 | 3,428 | Dropped: 1.21 writes `cost_gold` (3,740 times) |
| 9 | BUILD-002 | buildings | A building needs a county, province or character modifier (information) | 3,548 | 557 | Dropped |
| 10 | CB-001 | casus_belli_types | A casus belli needs an outcome effect (warning) | 138 | 0 | Advice: `structure/casus-belli-without-outcome` |
| 11 | INTERACTION-001 | character_interactions | `category` must be one of a list (—) | 629 | 0 | Covered: `references/unknown-key` (0 name no category of the game's 16) |
| 12 | INTERACTION-002 | character_interactions | An interaction needs `on_accept`, `on_decline` or `on_send` (warning) | 652 | 4 | Dropped |
| 13 | INTERACTION-003 | character_interactions | It needs `ai_frequency` or `ai_potential` (information) | 652 | 643 | Dropped |
| 14 | COUNCIL-001 | council_tasks | A council task needs `position` (—) | 75 | 0 | Advice: `fields/usually-present` |
| 15 | COURT-001 | court_positions | A court position needs `can_be_appointed` (warning) | 87 | 87 | Dropped: 1.21 has no such field (`valid_position`, `valid_character` instead) |
| 16 | COURT-002 | court_positions | `salary` needs `opinion` (information) | 87 | 0 | Advice: `fields/usually-present` (`opinion` in 87 of 87) |
| 17 | CULTURE-001 | culture_traditions | A tradition needs `category` (—) | 207 | 0 | Advice: `fields/usually-present` |
| 18 | DECISION_GROUP-001 | decision_group_types | A group should have `sort_order` (information) | 23 | 0 | Advice: `fields/usually-present` |
| 19 | DECISION_GROUP-007 | decision_group_types | `important_decision_group` must be `yes` or `no` (warning) | 4 | 0 | Advice: `fields/wrong-kind-of-value` |
| 20 | DECISION_GROUP-002 | decision_group_types | A group should have a property (information) | 23 | 0 | Advice: `fields/usually-present` (`sort_order` in 23 of 23) |
| 21 | DECISION_GROUP-003 | decision_group_types | An important group should have `sort_order` of 50 or more (hint) | 4 | 0 | Dropped: 4 records only |
| 22 | DECISION_GROUP-010 | decision_group_types | Each group needs the key `decision_group_type_<key>` (warning) | 23 | 0 | Covered: `localization/missing-key`, once the spec carries implicit keys |
| 23 | DECISION-XREF-001 | decision_group_types | A decision's `decision_group_type` must name a group (error) | 496 | 0 | Covered: `references/unknown-key` |
| 24 | DECISION_GROUP-004 | decision_group_types | Every group should be used by a decision (hint) | 23 | 1 | Dropped |
| 25 | DECISION_GROUP-005 | decision_group_types | A group's name should carry a mod prefix (hint) | 23 | 23 | Dropped: a naming taste, not a claim about the game |
| 26 | DECISION_GROUP-006 | decision_group_types | A group defined twice is an error (error) | 23 | 0 | Covered: `definitions/clash`, if the rules table gains a clash row for the folder (overrides.md rule 5, open) |
| 27 | DECISION-001 | decisions | A decision needs `ai_check_interval` (—) | 587 | 484 | Dropped: see flag 12 |
| 28 | DECISION-002 | decisions | A decision needs `effect` (—) | 587 | 0 | Advice: `fields/usually-present` |
| 29 | DECISION-003 | decisions | A decision should have `is_shown` or `is_valid` (information) | 587 | 3 | Dropped |
| 30 | DECISION-004 | decisions | A decision with `effect` should have `cost` or `is_valid` (information) | 587 | 88 | Dropped |
| 31 | DYNASTY-001 | dynasty_legacies | A legacy needs `track` (—) | 24 | 24 | Dropped: see flag 14 |
| 32 | CK3760 | events | An event needs `type` (—) | 10,836 | 1,109 | Dropped: see flag 15 |
| 33 | CK3760 | events | An event needs `title` (—) | 10,836 | 1,985 | Dropped: see flag 16 |
| 34 | CK3764 | events | A shown event needs `desc` (—) | 9,562 | 0 | Advice: `structure/event-without-desc` |
| 35 | EVENT-003 | events | A letter event needs `sender` (—) | 705 | 0 | Advice: `structure/event-letter-without-sender` |
| 36 | CK3430 | events | `theme` must be one of 33 names (—) | 8,859 | 6,094 | Covered: `references/unknown-key` against the game's 201 themes (0 name none); its 33 names are out of date |
| 37 | CK3450 | events | An option needs `name` (—) | 24,498 | 21 | Dropped |
| 38 | CK3456 | events | An option must not be empty (—) | 24,498 | 5 | Dropped |
| 39 | CK3610 | events | `ai_chance` must not have a negative base (—) | 17,441 | 10 | Dropped |
| 40 | CK3612 | events | `ai_chance` with base 0 needs a modifier (—) | 17,441 | 970 | Dropped |
| 41 | CK3421 | events | A portrait block needs `character` (—) | 15,292 | 0 | Advice: `fields/usually-present` |
| 42 | CK3422 | events | `animation` must be one of 17 names (—) | 13,689 | 9,515 | Advice: `references/unknown-name` against the game's 330 animations (4 of 16,776 uses name none); its 17 names are out of date |
| 43 | CK3440 | events | A `triggered_desc` needs `trigger` (—) | 17,965 | 168 | Dropped |
| 44 | CK3441 | events | A `triggered_desc` needs `desc` (—) | 17,965 | 6 | Dropped |
| 45 | CK3762 | events | A hidden event must not have options (—) | 1,274 | 12 | Dropped |
| 46 | CK3520 | events | A hidden event must not have `after` (—) | 1,274 | 2 | Dropped |
| 47 | CK3521 | events | `after` without options in a shown event (—) | 2,641 | 0 | Advice: `structure/event-after-without-option` |
| 48 | CK3767 | events | An event must not be empty (—) | 10,836 | 0 | Advice: `structure/event-empty` |
| 49 | FAITH-001 | faith_doctrines | A doctrine needs `group` (—) | 0 | 0 | Dropped: see flag 21 |
| 50 | CK3870 | generic_rules | No effect in a trigger block (error) | — | — | Covered: `names/unknown-trigger` |
| 51 | CK3871 | generic_rules | No effect in `limit` (error) | — | — | Covered: `names/unknown-trigger` |
| 52 | CK3872 | generic_rules | No trigger in an effect block (warning; switched off in the file) | — | — | Covered: `names/unknown-effect` |
| 53 | CK3872 | generic_rules | `trigger = { always = yes }` is redundant (warning) | — | 375 | Dropped; since 2026-11-23 the row `style/redundant-condition` (decision 112), built with format 9, which judges an `always = yes` in an `AND` or a `NAND`, not in a plain trigger block |
| 54 | CK3873 | generic_rules | `trigger = { always = no }` means the code never runs (error) | — | 222 | Dropped: the base game switches content off this way on purpose |
| 55 | CK3875 | generic_rules | A `random_` iterator needs `limit` (warning) | 10,128 | 1,717 | Dropped |
| 56 | CK3976 | generic_rules | No effect in an `any_` iterator (warning) | — | — | Covered: `names/unknown-trigger` |
| 57 | CK3977 | generic_rules | An `every_` iterator needs `limit` (information) | 10,369 | 3,425 | Dropped |
| 58 | CK5137 | generic_rules | `is_alive` needs an `exists` check, or the game crashes (warning) | 3,517 | 3,441 | Dropped |
| 59 | CK5142 | generic_rules | `liege = root` is wrong; compare with `this` (error) | — | 2,125 | Dropped: the base game writes the form 2,125 times for twelve links alone (`liege`, `top_liege`, `employer`, `killer`, ...) |
| 60 | CK3656 | generic_rules | An inline `opinion` value should be an opinion modifier (information) | 10,724 | 8,524 | Dropped |
| 61 | PROJECT-001 | great_projects | A great project needs `cost` (warning) | 40 | 2 | Dropped |
| 62 | INT001 | intents | An intent needs `scripted_animation` (error) | 69 | 0 | Advice: `fields/usually-present` |
| 63 | INT002 | intents | `is_target_valid` needs `on_target_invalidated` (warning) | 9 | 2 | Dropped |
| 64 | INT003 | intents | `ai_targets` needs `ai_target_score` (information) | 9 | 0 | Dropped: 9 records only |
| 65 | ON_ACTION-001 | on_actions | An on-action needs effects or events (warning) | 1,073 | 103 | Dropped: 31 fire even counting chained on-actions |
| 66 | ON_ACTION-002 | on_actions | `events` must not be empty (warning) | 130 | 13 | Dropped |
| 67 | PA001 | pulse_actions | A pulse action needs `is_valid` (error) | 328 | 0 | Advice: `fields/usually-present` |
| 68 | PA002 | pulse_actions | It needs `weight` (error) | 328 | 1 | Dropped |
| 69 | PA003 | pulse_actions | It needs `effect` (error) | 328 | 0 | Advice: `fields/usually-present` |
| 70 | PA004 | pulse_actions | `is_valid` should test `is_current_phase_active` (information) | 328 | 46 | Dropped |
| 71 | PA005 | pulse_actions | `effect` should add an activity log entry (warning) | 328 | 4 | Dropped |
| 72 | SCHEME-001 | schemes | A scheme needs `skill` (—) | 136 | 0 | Advice: `fields/usually-present` |
| 73 | SCHEME-002 | schemes | A scheme needs `on_start`, `on_phase_completed` or `on_ready` (warning) | 136 | 0 | Advice: `fields/usually-present` (`on_phase_completed` in 136 of 136) |
| 74 | SCHEME-003 | schemes | `uses_agents = yes` needs `valid_agent` (warning) | 0 | 0 | Dropped: no 1.21 scheme writes `uses_agents` |
| 75 | STORY-040 | story_cycles | `on_setup` must not be empty (—) | 52 | 11 | Dropped |
| 76 | STORY-041 | story_cycles | `on_end` must not be empty (—) | 47 | 10 | Dropped |
| 77 | STORY-023 | story_cycles | An effect group's `chance` must not exceed 100 (—) | 50 | 0 | Advice: `structure/story-effect-group-chance-above-100` |
| 78 | STORY-024 | story_cycles | It must be above 0 (—) | 50 | 0 | Advice: `structure/story-effect-group-chance-not-positive` |
| 79 | STORY-001 | story_cycles | An effect group needs a timing (—) | 171 | 0 | Advice: `structure/story-effect-group-without-timing` |
| 80 | STORY-004 | story_cycles | Only one timing (—) | 171 | 0 | Advice: `structure/story-effect-group-several-timings` |
| 81 | STORY-025 | story_cycles | An effect group needs effects (—) | 171 | 0 | Advice: `structure/story-effect-group-without-effect` |
| 82 | STORY-027 | story_cycles | Do not mix `triggered_effect` with `first_valid` or `random_valid` (—) | 171 | 2 | Dropped |
| 83 | STORY-022 | story_cycles | An effect group needs `trigger` (—) | 171 | 67 | Dropped |
| 84 | STORY-043 | story_cycles | `days` below 7 is a short interval (information) | 136 | 24 | Dropped |
| 85 | STORY-044 | story_cycles | `years` above 10 is a long interval (information) | 7 | 2 | Dropped |
| 86 | STORY-005 | story_cycles | A `triggered_effect` needs `trigger` (—) | 262 | 7 | Dropped |
| 87 | STORY-006 | story_cycles | A `triggered_effect` needs `effect` (—) | 262 | 0 | Advice: `fields/usually-present` |
| 88 | STORY-020 | story_cycles | A story cycle needs `on_owner_death` (—) | 55 | 2 | Dropped |
| 89 | STRUGGLE-001 | struggles | A struggle needs `phases` (—) | 2 | 2 | Dropped: see flag 38 |

**In numbers:** 28 return as advice (15 through `fields/usually-present`, 1 through
`fields/unusual-value`, 1 through `fields/wrong-kind-of-value`, 1 through
`references/unknown-name`, 10 as `structure/*` rows), 9 are covered by a row with game
evidence, and 52 are dropped.

### The 14 other codes

| Code | File | What it claims | Base game | Verdict |
| --- | --- | --- | --- | --- |
| CK3761 | events | `type` must be one of six names | 1,584 of 10,836 events are `activity_event`, which the six omit | Advice: `structure/event-unknown-type`, with the four types of `_events.info` |
| CK3768 | events | At most one `immediate` | 0 of 10,836 | Advice: `structure/event-several-immediate` |
| CK3766 | events | At most one `after` | 0 of 10,836 | Advice: `structure/event-several-after` |
| CK3763 | events | A shown event needs an option | 0 of 9,562 | Advice: `structure/event-without-option` |
| CK3453 | events | At most one `name` per option | 1,058 of 24,498 options give several | Dropped |
| STORY-007 | story_cycles | A story cycle needs an `effect_group` | 2 of 55 have none | Dropped |
| AGT001 | activity_group_types | Groups the game's code refers to must not be removed | Not a claim about script | Dropped |
| AGT002 | activity_group_types | A group should have `sort_order` | 6 of 6 have it | Dropped: 6 records only |
| AGT003 | activity_group_types | A `gui_tags` entry must be one of a list | A list of its own | Dropped |
| ACT004 | activity_types | A phase needs `order` | 19 of 53 phases have none | Dropped |
| ACT005 | activity_types | Phase orders must differ | 1 of 24 activity types repeats one | Dropped |
| RQ001 | guest_invite_rules | An invite rule needs `effect` | 65 of 65 have it | Advice: `fields/usually-present` |
| RQ002 | guest_invite_rules | Its effect should `add_to_list = characters` | 2 of 65 do not | Dropped |
| RQ003 | guest_invite_rules | Consider a particular trigger in the limit | A suggestion | Dropped |

[wiki-era-schemas.md](references/wiki-era-schemas.md) records the outcome.

## The base game's own errors in release 2.3.0

Release 2.3.0's base-game record (`legacy/packages/engine/test/acceptance/vanilla-1.20.0.2.json`,
made on game 1.20.0.3) holds 1 parse error and 14 check errors, none classified. Their
re-measurement on 1.21 needs the 1.21 spec and is not attempted here. The row that owns each one's
classification, in item 4.9:

| # | File and line (game 1.20.0.3) | 2.3.0 code | The name | Owner row |
| ---: | --- | --- | --- | --- |
| P1 | `history/characters/japanese.txt:51367` | `expected_between_block_name_and_body` | (a dated block without `=`) | `syntax/missing-equals-before-block`. Already re-measured by step 2: 1.21.0.3 no longer has the file; the same defect, and one block left open, are classified as game defects in `tools/data/parse-classifications.json` (3 entries) |
| 1 | `common/decisions/00_major_decisions_east_europe.txt:384` | `unknown_trigger_X` | `filter` | `names/unknown-trigger` |
| 2 | `common/scripted_effects/00_laamp_effects.txt:1798` | `unknown_trigger_X` | `save_scope_as` | `names/unknown-trigger` |
| 3 | `common/scripted_effects/00_pilgrimage_effects.txt:614` | `unknown_trigger_X` | `is_eminent` | `names/unknown-trigger` |
| 4 | `common/scripted_effects/00_relation_effects.txt:755` | `unknown_trigger_X` | `is_powerful` | `names/unknown-trigger` |
| 5 | `common/scripted_effects/00_religion_effects.txt:1268` | `unknown_trigger_X` | `can_elevate_holy_site` | `names/unknown-trigger` |
| 6 | `common/scripted_effects/00_religion_effects.txt:1270` | `unknown_effect_X` | `elevate_holy_site` | `names/unknown-effect` |
| 7 | `common/scripted_effects/00_religion_effects.txt:1279` | `unknown_trigger_X` | `can_demote_holy_site` | `names/unknown-trigger` |
| 8 | `common/scripted_effects/00_religion_effects.txt:1281` | `unknown_effect_X` | `demote_holy_site` | `names/unknown-effect` |
| 9 | `common/scripted_triggers/00_relation_triggers.txt:1091` | `unknown_trigger_X` | `is_powerful` | `names/unknown-trigger` |
| 10 | `common/scripted_triggers/00_religious_triggers.txt:806` | `unknown_trigger_X` | `secret_is_blackmailable_strong_hook_trigger` | `names/unknown-trigger` |
| 11 | `common/scripted_triggers/00_religious_triggers.txt:807` | `unknown_trigger_X` | `secret_is_blackmailable_weak_hook_trigger` | `names/unknown-trigger` |
| 12 | `events/artifacts/historical_artifacts_events.txt:1111` | `unknown_effect_X` | `is_eminent` | `names/unknown-effect` |
| 13 | `events/artifacts/historical_artifacts_events.txt:1153` | `unknown_effect_X` | `faith_filter` | `names/unknown-effect` |
| 14 | `events/dlc/ep3/ep3_laamp_decision_events.txt:5518` | `unknown_trigger_X` | `list` | `names/unknown-trigger` |

Ten belong to `names/unknown-trigger` and four to `names/unknown-effect`. Whether each is a
defect of the game's files or a fault of pychivalry (a parameter such as `filter` or `list` read
as a keyword, a name the 1.20 spec lacks) is decided against the 1.21 spec and its hand-kept
tables, which say which keys of a block are parameters.

Beyond these, the rebuild's own rows add base-game errors to classify: `definitions/clash` fires
on the 3 duplicate character ids of `records/game/index.json`, which the game itself reports.

## ck3-tiger and the CWTools rule files

Open question 9 of [MVP.md](MVP.md#open-questions). Both licences were read on 2026-11-21 from
each project's own repository, through the GitHub API and the licence file itself. This is a
reading of the licences for the owner, not legal advice. Nothing is adopted in this item; each
candidate below is listed for evaluation only, with the game evidence it would need.
[references/community-tools.md](references/community-tools.md) records the same.

| | ck3-tiger | The CWTools CK3 rule files |
| --- | --- | --- |
| Repository | <https://github.com/amtep/tiger> (the address `amtep/ck3-tiger` now leads there) | <https://github.com/cwtools/cwtools-ck3-config> |
| Licence | GNU General Public License v3.0 (`LICENSE`, the GPL-3.0 text) | MIT (`LICENSE`: "Copyright (c) 2020 cwtools") |
| State | Latest release v1.19.0, 2026-06-06; last push 2026-06-06 | Last commit 2023-04-16, a game version of three years ago |
| May anything be taken into Apache-2.0 pychivalry? | **No code, tables or text.** GPL-3.0 work copied or translated into pychivalry would make the whole GPL-3.0, which Apache-2.0 does not allow. An idea for a rule may be noted, then built from the game's own evidence alone, never from tiger's code | **Yes, with the copyright and permission notice kept**, as MIT allows. By pychivalry's own rule it is still not a source of vocabulary or a basis for a finding: a rule's logic may be taken only once proved against the game, and nothing is taken in this item |

**Candidates from ck3-tiger** (from its own description of what it checks; its code was not
read):

| Candidate | Game evidence it would need |
| --- | --- |
| A history character's spouse, employer or liege exists and is alive on the date of the entry | The catalogue's `invalid_character_not_in_history_or_not_born_yet` ("Invalid Character not in history or not born yet") is a candidate; a planted-defect capture (item 11.1) would tie it to the condition |
| A title's history names a liege title that does not exist | The catalogue's `title_history_refers_to_unknown_liege_title_X_X`; it would be a `references/unknown-key` case once the value types cover `history/titles` |
| A key defined in one language the mod supports and missing in another | What the game prints when a loaded language lacks a key: unknown until a capture is made in another language |
| No one is their own ancestor | No catalogue message found; a capture would have to show the game reports it |
| `rivers.png` | Map data, outside the MVP |

**Candidates from the CWTools rule files** (`config/*.cwt`, read 2026-11-21):

| Candidate | Game evidence it would need |
| --- | --- |
| Per-field cardinality (`## cardinality = 1..1` for required, `0..1` for at most once) | A required field needs its game message, as the spec's three have; otherwise it is at most advice, which `fields/usually-present` already gives from the base game's own frequency. "At most once" is the same: advice only, from the base game |
| The scope each record type's body runs in (`push_scope`) | Agreement with the scopes the format 5 spec reads from the `.info` files and the game's documentation output; a hint where they agree, nothing where they do not |
| Scope links (`scope_links.cwt`) | None as vocabulary. A disagreement with the spec's links is a question for the spec work, not a rule |

## What the inventory needs from the 1.21 spec

Every check after step 2 depends on the 1.21 package in format 5; item 4.2 onward waits for it.
Beyond what the format 5 plan already holds, this inventory needs:

1. **The keywords structural and advice checks test, as data** ("keyword roles"): that `hidden`
   hides an event, that `option` is an event option, that `if` and `else` pair, that `namespace`
   is a declaration. The hand-kept tables carry `AND`, `OR`, `if` and their like; they do not
   carry the roles of event fields. Where these come from is question 10.
2. **Implicit localization keys**: the keys a record has by its name alone, such as
   `decision_group_type_<key>`. Without them `localization/missing-key` and
   `localization/unused-key` see only keys written in fields.
3. **The 1.21 executable's messages the 1.20 catalogue lacks**, kept by the cleaned catalogue:
   "The body of triggered_desc can only take desc and/or trigger. %s", "Unrecognized loc key %s.
   Near %s", and the localization reader's "Unterminated '[' ...", "Unterminated '(' ...",
   "Unterminated `'` ..." and "Unterminated '$' ..." messages.
4. **Value types that name a database or a file**: which database a field's value is a key of
   (`references/unknown-key`), which definition kind it names (`references/unknown-name`), which
   fields hold a texture path (`graphics/missing-file`).
5. **A clash row's message in the rules table**, for every folder the spec work finds the game
   reports a duplicate in (`definitions/clash`).

## How the counts were made

- **What was read.** Game 1.21.0.3 on Linux, read-only, never launched: `game/`, the install's
  `jomini/` beside it, and the same folder inside every DLC pack. On this build the DLC packs
  hold no file in `common/`, `events/` or `history/`, and `jomini/` adds 21 files to `common/` (coats of arms, defines, named
  colours, trigger localization), none in a folder a rule here names.
- **How.** One-off Node scripts, run on 2026-11-21 from this branch, reading each file with the
  step 2 parser (`readScript` of `packages/core`). A record is a top-level `key = { ... }` of a
  file in the folder named: not `namespace`, not a `@constant`, not a prefixed
  `scripted_trigger name = { }`. An event is such a record whose key holds a `.`. A nested block
  (an option, a portrait, a `triggered_desc`) is a block of that key anywhere inside a record.
  A list name is one of the stand-in spec's 377 lists, so `random_` and `every_` iterators are
  told apart from `random_list` and the like. The style counts are by line, over every script
  file of `common/`, `events/` and `history/` (6,913,253 lines, 4,503 files); the operator count
  is approximate. The localization counts read the `.yml` files of
  `game/localization/english` (340,445 entries).
- **The executable.** `strings -n 6` over the Linux executable `binaries/ck3` (725,545 strings),
  searched for each message's text; the nearest source path before and after it gives its
  context.
- **The community repositories.** The GitHub API (`gh api`) over HTTPS: each repository's
  metadata, its licence file and its top-level contents, on 2026-11-21.
- **Why the scripts are not committed.** They are measurements for one document, not tools with
  tests, as with the one-off scan of [overrides.md](overrides.md) (decisions.md, step 3). The
  counts are re-measured by the suites that ship with the checks: item 4.7 re-proves every
  advice row on the base game, and items 4.9 and 4.10 record every finding on the base game and
  the five mods.

Release 2.3.0's figures quoted here (10,523 event targets; the 14 errors and 1 parse error) are
from its own records, made on game 1.20.0.3.

## What the owner signs off

Signed off on 2026-11-21. The eleven questions as they were asked follow; the answer to each is
in the table after them and in [decisions.md](decisions.md#log), rows 45 to 55.

1. **The code scheme.** A: `family/name` slugs, the step 2 identifiers kept as their codes
   (proposed). B: numbered codes such as `PYC1001`. Also the twelve families and the code names
   on this page, which become permanent at sign-off.
2. **The verdict rule for old rules.** An old rule returns as advice when it applies to at least
   10 base-game records and fires on none (proposed). The alternative is a tolerance, for
   example under 1 in 1,000; under it, `CK3450` (21 of 24,498), `CK3520` (2 of 1,274) and
   `COND-001` (12 of 89,641), among others, would also return.
3. **The severities that differ from 2.3.0:** `PYCH-P001` and `PYCH-P002` from error to
   information (done in step 2, confirmed here); `PYCH-S003` from warning to information;
   `SWITCH-003` from warning to error and `EVENT-010` from information to warning, by folding
   each into a code that has the game's message.
4. **The 39 release 2.3.0 codes not carried over**, each with its reason in the mapping table:
   the seven style hints, `CK3330`, `CK3331`, `COND-001`, `COND-002`, `CK3425`, `CK3450`,
   `CK3511`, `CK3520`, `CK3522`, `CK3610` to `CK3614`, `CK3656`, `CK3762`, `CK3765`, `CK3769`,
   `CK3872`, `CK3873`, `CK3875`, `CK3977`, `CK5137`, `CK3956`, `VALUE-005`, `ITER-003`,
   `ITER-004`, `LOC-001` to `LOC-004` and `LOC-007`. Also the folding of `PYCH-R001` and
   `PYCH-R002` (removed keywords) into the unknown-name codes.
5. **`syntax/malformed-arithmetic`:** keep it information until the capture of item 11.1 or the
   cleaned catalogue shows that "advanced statement" means `@[ ... ]` (proposed), or raise it to
   an error now on `failed_to_parse_advanced_statement_arithmetic_expression`. The other two
   stay information either way.
6. **`fields/unknown-field`:** keep it a warning on the catalogue's `unknown_X_in_X`, as 2.3.0
   did (proposed), or make it information until the capture shows the game prints that message
   for a record other than a province's history.
7. **The new checks with evidence that 2.3.0 did not have:** `names/unknown-on-action` (error),
   `names/modifier-outside-use-area` (a warning whose only evidence is the documentation dump's
   use areas, with no message found), `structure/event-non-character-shown` (error; "narrative"
   read as `major`), `structure/triggered-desc-other-field` (warning, on a 1.21 executable
   message), `definitions/clash` (error) and `log/game-message` (warning).
8. **Whether a field a Paradox `.info` file calls required counts as "a required schema field"**
   (principle 1). It decides whether `structure/event-letter-without-sender` ("required for
   letter events") can be a warning, and how format 5 marks such fields.
9. **Whether the 13 provisional advice checks** (scope timing, variables, the redundant
   background) are in the MVP at all, given that each is retired unless item 4.7 shows it holds.
10. **Where structural and advice checks get the keywords they test** (`hidden`, `option`,
    `after`, `if`, `else`, `switch`, `namespace`): from the format 5 spec, as a new table
    requested from `pdx-parser-re` (proposed, because AGENTS.md rule 5 says a table a check needs
    comes from the spec), or from a pychivalry-owned data file in this repository, like the
    presentation data of step 8.
11. **The two spec requests not in the format 5 plan:** implicit localization keys, and the
    keyword roles of question 10.

### The answers

| # | Decided |
| --- | --- |
| 1 | `family/name` codes, the step 2 identifiers kept as they are; the twelve families and every code name on this page. |
| 2 | Zero exceptions: an old rule returns as advice only when it applies to at least 10 base-game records and fires on none. |
| 3 | The five severity changes against 2.3.0, as listed. |
| 4 | The 39 codes are not carried over, and the removed-keyword codes fold into the unknown-name codes. |
| 5 | `syntax/malformed-arithmetic` stays information until a capture or the cleaned catalogue shows what its candidate message is about. |
| 6 | `fields/unknown-field` stays a warning on `unknown_X_in_X`. |
| 7 | The six new evidenced checks, at the severities listed. |
| 8 | A field a Paradox `.info` file calls required does not count as a required schema field. `structure/event-letter-without-sender` stays advice, at information. |
| 9 | The 13 provisional advice checks are in the MVP on the terms written: each ships only if item 4.7 shows it holds, and is retired otherwise. |
| 10 | The keywords come from the spec package, as a table with evidence. No pychivalry-owned keyword file. |
| 11 | Both are to be requested from the spec work. The request itself is held on the owner's word, with the other requests to that work. |

