# Diagnostic evidence: why each plug-in code has its severity (2.2 audit)

pychivalry 2.2 (post-2.0 Phase 4) audited every code the extension's plug-ins emit against one
rule, and every new code since follows it. The engine's own diagnostics (catalogue ids such as
`unknown_trigger_X`) are not part of this audit: their texts are the game's.

## The evidence rule

A plug-in diagnostic may be an **error or a warning** only with engine evidence:

1. a message of the spec package's error catalogue (the game prints it in `error.log`);
2. a `required` field of a directory schema of the spec package;
3. an entry of the game's own `script_docs` oracle (scope validity, supported targets);
4. a reproduced in-game error whose `error.log` text is cited.

Without it the check is a **convention**: it ships at **information** (semantic advice) or
**hint** (style), its catalogue entry says "Convention" and its message starts with
`Convention:` (style codes: `Convention (style):`). A check that needs knowledge it does not
have (the base game, the workspace index) does not report at all while that knowledge is
missing. A check that cannot be made right is removed, with the reason recorded here. Nothing
is ever dropped from the spec package: a false positive that traces to a name in the spec is
worked around in the rule.

The rule is enforced where it can be: `data/diagnostics.yaml` carries an `evidence` for every
code, and `npm run docs:diagnostics` (and its `--check`) refuses a code whose evidence starts
with "Convention" at error or warning severity. The generated reference pages
(`Documentation/user-guide/diagnostics/plugin-*.md`) show the evidence next to each code.

### Sources the plug-ins may cite that are not evidence

- `game/events/_events.info`, the game's own events documentation (type optional, defaults to
  `character_event`; `sender` required for letter events; "Missing localization keys are
  logged as errors"): it decides what is *false* (CONV-001, CK3760) and what a convention
  says, but it is not one of the four classes above.
- Strings of the 1.20.0.2 executable that the spec package's catalogue does not hold (the
  namespace warning of EVENT-016): a gap of the catalogue extraction, to be fixed in
  pdx-parser-re; until then the code stays a convention.
- Usage counts in the base game: they prove a false positive (1,475 `liege = root`, 167
  `always = no`, 864 immediate-saved scopes read in a desc trigger), never a defect.

## What the plug-ins know (2.2)

| Knowledge | Where it comes from | Codes that need it (silent without it) |
| --- | --- | --- |
| The base game's localization keys | `game/localization/english/**/*.yml` (about 297,000 keys in 1.20.0.2), read once by `BaseGameData` when `ck3LanguageServer.gamePath` resolved a game | CK4100 |
| Event themes and backgrounds | `game/common/event_themes`, `game/common/event_backgrounds` plus the workspace's top-level keys in the same directories | CK3430 (and CK3431, CK3433 from 4.3) |
| Traits | `game/common/traits` (keys, `group`, `group_equivalence`) plus the workspace's traits and trait groups and the optional extracted data | CK3800 |
| Variables across files | the engine Indexer's variable uses (`hasVariableUse`) of the workspace and of the base game's indexed directories | CK3701, CK3702 (ordinary and global variables) |
| Scripted triggers of the base game | the engine's vanilla index | SWITCH-003 |
| The workspace's localization files | the LocalizationIndex, which since 2.2 also reads `key: "text"` entries without a version number (135,037 such entries in the base game's English files) and entries with a trailing comment | CK4100, LOC-001, LOC-002 |

## The audit of the 2.1 catalogue

The 2.1 catalogue (`data/diagnostics.yaml` at `aabeda2`) held 94 codes: 22 error, 54 warning,
17 information, 1 hint. (The Phase 4 brief counted 82 codes, 66 of them at error or warning;
the measured file is the reference here.) The table lists all 76 codes that were at error or
warning, with the evidence that decides their severity now. "Before" and "after" are the
editor-path corpus counts summed over the five mods
(`packages/engine/test/corpus/real-mods/<slug>.counts.json`, `editor.counts`): before = the
2.1 records at `aabeda2`, after = the records of this commit.

### Summary

| 2.1 severity | Now error | Now warning | Now information | Now hint | Removed or merged | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| error | 1 | 0 | 14 | 1 | 6 | 22 |
| warning | 0 | 8 | 28 | 3 | 15 | 54 |

Kept at error: VALUE-002 (catalogue `min_value_in_range_directive_is_larger_than_the_max_value_un`).
Kept at warning, each with a catalogue message: LOC-001 and LOC-002 in script files and
CK4100 (`unknown_loc_key_X`), CK3430 (`failed_to_read_key_reference_X_from_database_X`), CK3800
(`unknown_trait_X_in_event_at_X`), SWITCH-003 (`unknown_trigger_X`), GFX001
(`failed_to_load_texture_X_file_not_found`), LOC-005 (`loc_key_X_unexpected_extra_at_position_X_file_X`).
Removed or merged, 21 of the 76 (plus CONV-003, an information code merged into CK3764):
CK3340, CK3341, CK3420 (into the engine's checks); CK5142, CK3760, CONV-001 (false); CK3950,
CK3951, VALUE-001, VALUE-003 (cannot be made right); EVENT-005, EVENT-006 (never reported);
CK3761, CONV-004, EVENT-003, EVENT-004, EVENT-007, EVENT-009, EVENT-011, EVENT-012, EVENT-013
(merged into the code that reports the same thing). The catalogue went from 94 codes to 72 (1
error, 8 warning, 54 information, 9 hint) before the new codes of steps 4.1 to 4.6.

### Corpus totals by severity (editor path, base game set)

| Mod | Before: error / warning / information / hint | After 4.0: error / warning / information / hint | Engine-path errors (real defects) |
| --- | --- | --- | ---: |
| balance-of-power-ui | 0 / 312 / 15 / 15 | 0 / 0 / 7 / 331 | 0 |
| divine-intervention | 8 / 23,065 / 2,279 / 77 | 0 / 0 / 468 / 24,547 | 0 |
| elf-destiny | 338 / 25,511 / 24,602 / 427 | 15 / 500 / 1,546 / 47,117 | 15 |
| rice | 438 / 65,327 / 91,811 / 347 | 92 / 1,064 / 2,945 / 144,752 | 92 |
| viet-events | 12 / 1,338 / 9,378 / 10 | 1 / 29 / 613 / 9,829 | 1 |

Every error-severity editor finding is now a real defect the engine path proves (0 / 15 / 92 /
1 on the four script mods). The warnings left are the engine's schema check (`unknown_X_in_X`,
1,581) and three evidence-backed plug-in classes: CK3800 (6), CK4100 (3) and GFX001 (3), each
listed with its reason in `packages/engine/test/corpus/real-mods/FINDINGS.md`. Totals went
from 245,310 findings to 233,856; most of the rest are style hints (CK3303 79,559, CK3317
49,058, CK3304 36,571, CK3306 34,904, CK3301 20,427). Style counts rose slightly (CK3303 79,302
to 79,559) because of the 1000-diagnostics-per-file cap: files at the cap now fill it with
findings that removed codes used to push out.

### Every 2.1 code at error or warning

| Code | Plug-in | Meaning (2.1) | 2.1 severity | Evidence or reason (2.2) | 2.2 severity | Corpus before | Corpus after |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| `CK3005` | paradox-checks | A logical operator (AND, OR, NOT, NOR, NAND) with a scalar value instead of a block. | error | Convention (no catalogue message; the engine does not report it). | information | 0 | 0 |
| `CK3301` | style-checks | Inconsistent indentation within a block. | warning | Convention (style). | hint | 20,392 | 20,427 |
| `CK3303` | style-checks | Indentation uses spaces instead of tabs. | warning | Convention (style; Paradox's own files indent with tabs). | hint | 79,302 | 79,559 |
| `CK3314` | style-checks | Empty block. | warning | Convention (style; the base game writes empty blocks on purpose). | hint | 2,163 | 2,164 |
| `CK3330` | style-checks | Unclosed brace (dropped where the engine reports the brace on the same line). | error | The engine's parse error, with the game's message, is the evidence and is reported by the engine; this code only points at the probable line, from a per-top-level-block heuristic. | information | 0 | 0 |
| `CK3331` | style-checks | Extra closing brace (dropped where the engine reports the brace on the same line). | error | As CK3330. | information | 0 | 0 |
| `CK3340` | style-checks | Unknown or suspicious scope reference (possible typo). | warning | Merged into the engine: the first chain segment was judged against 17 hard-coded names; the engine's scope check reports an unknown chain segment with the game's message (failed_to_parse_data_for_event_target_link_link_X_location_X), and every corpus finding was a valid link (domicile, county, capital_county …). | removed | 425 | 0 |
| `CK3341` | style-checks | Scope reference appears truncated. | warning | Merged into the engine: a truncated reference (`root. = …`) is reported by the engine's registry as unknown_trigger_X / unknown_effect_X with the game's message. | removed | 1 | 0 |
| `CK3420` | paradox-checks | Invalid portrait position. | error | Merged into the engine (issue #94): every key ending in _portrait was checked (portrait cameras and accessories, decisions); an unknown event field is reported by the engine's schema check, unknown_X_in_X, and highlight_portrait is an option field. | removed | 10 | 0 |
| `CK3421` | paradox-checks | A portrait block has no character field. | warning | Convention. | information | 0 | 0 |
| `CK3422` | paradox-checks | Unknown portrait animation. | warning | Convention (the extracted data is not the game's complete animation list). | information | 0 | 0 |
| `CK3430` | paradox-checks | Unknown event theme. | warning | The theme is a key of the event_themes database; the game cannot read an unknown key (catalogue failed_to_read_key_reference_X_from_database_X, "Failed to read key reference %s from database %s"). EVENT-003 (the same check against 32 hard-coded names) is merged into it. | warning | 1,688 | 0 |
| `CK3450` | paradox-checks | An option has no name field for its localization. | warning | Convention. CONV-004 and EVENT-007 (the same check) are merged into it. | information | 1 | 1 |
| `CK3510` | paradox-checks | trigger_else without a preceding trigger_if has no effect. | error | Convention. | information | 0 | 0 |
| `CK3511` | paradox-checks | Several trigger_else blocks; only the first one executes. | warning | Convention. | information | 3 | 3 |
| `CK3520` | paradox-checks | An after block in a hidden event has no effect. | warning | Convention. EVENT-012 (the same check) is merged into it. | information | 0 | 0 |
| `CK3550` | scope-timing | A scope used in the trigger block is saved in immediate, which runs after the trigger is evaluated. | error | Convention. Not reported when the trigger saves the scope before reading it (issue | information | 2 | 4 |
| `CK3551` | scope-timing | A scope used in the desc block is saved in immediate; desc may be evaluated before immediate runs. | warning | Convention. Before 2.2 it reported scopes saved in immediate, which the window can read (issue #95). | information | 0 | 0 |
| `CK3552` | scope-timing | A scope used in a triggered_desc trigger is saved in immediate, which runs after those triggers. | error | Convention. Before 2.2 an error for scopes saved in immediate: the window is evaluated after immediate, and 864 vanilla events read an immediate-saved scope in a triggered_desc trigger (issue #95). | information | 78 | 12 |
| `CK3553` | scope-timing | A variable checked in the trigger block is set in immediate, which runs after the trigger is evaluated. | error | Convention. Before 2.2 an error for any variable: ordinary and global variables persist, and checking one an earlier firing set is the intended pattern (issue #97). | information | 1 | 0 |
| `CK3554` | scope-timing | A temporary scope (save_temporary_scope_as) is passed to a triggered event; it does not persist across events. | warning | Convention. | information | 0 | 0 |
| `CK3610` | paradox-checks | Negative base in ai_chance; the AI never selects the option. | warning | Convention. | information | 0 | 0 |
| `CK3614` | paradox-checks | An ai_chance modifier without a trigger applies unconditionally. | warning | Convention. | information | 0 | 0 |
| `CK3701` | variables | A variable is used but never set in the file. | warning | Convention: the base game's events, GUI and localization can also set variables and are not indexed, so the absence cannot be proved. | information | 716 | 276 |
| `CK3703` | variables | A local variable accessed as global, or a global variable accessed as local. | error | Convention. | information | 0 | 3 |
| `CK3705` | variables | A variable used both as a list and as a value. | warning | Convention. | information | 0 | 0 |
| `CK3760` | paradox-checks | An event has no type declaration. | error | False: `type` is optional and defaults to character_event (game/events/_events.info). | removed | 0 | 0 |
| `CK3761` | paradox-checks | Invalid event type. | error | Merged into EVENT-001 (the same check; its list held story_cycle and feast_event, which are not event types). | removed | 0 | 0 |
| `CK3762` | paradox-checks | A hidden event has options. | warning | Convention. EVENT-011 (the same check) is merged into it. | information | 0 | 2 |
| `CK3763` | paradox-checks | An event has no options. | warning | Convention. EVENT-013 (the same check) is merged into it. | information | 0 | 1 |
| `CK3764` | paradox-checks | A non-hidden event has no desc. | error | Convention (desc is an optional field of the events schema). CONV-003 (the same check) is merged into it. | information | 0 | 1 |
| `CK3766` | paradox-checks | Several after blocks in one event. | warning | Convention. | information | 0 | 0 |
| `CK3767` | paradox-checks | An empty event. | error | Convention. | information | 0 | 0 |
| `CK3768` | paradox-checks | Several immediate blocks in one event. | error | Convention. | information | 0 | 0 |
| `CK3800` | traits | Unknown trait (not in the extracted trait data or the workspace's traits). | warning | The game logs an unknown trait (catalogue unknown_trait_X_in_event_at_X, "Unknown trait {}, in event at {}", and invalid_trait_name). | warning | 155 | 6 |
| `CK3873` | paradox-checks | Impossible trigger = { always = no }. | error | Convention. Before 2.2 an error; the base game writes trigger = { always = no } 167 times and the game reports nothing (issue #92). | hint | 128 | 128 |
| `CK3950` | scripted-blocks | Call to an undefined scripted effect. | error | Cannot be made right (issue #93): the check took every block with a value as a call, which in the AST is only a tagged value (`rgb { }`, `hsv { }`), so it reported colour values and never a call; an undefined scripted effect is the engine registry's unknown_effect_X, against the workspace and the base game. | removed | 101 | 0 |
| `CK3951` | scripted-blocks | Call to an undefined scripted trigger. | error | As CK3950, for scripted triggers (the engine registry's unknown_trigger_X). | removed | 101 | 0 |
| `CK3956` | scripted-blocks | Recursive scripted effect or trigger call. | warning | Convention (no catalogue message for recursion). | information | 0 | 0 |
| `CK4100` | localization-references | A localization key referenced from script is not defined in the workspace's localization files. | warning | The game logs the missing key: catalogue unknown_loc_key_X ("Unknown loc key %s") and game/events/_events.info ("Missing localization keys are logged as errors"). | warning | 7,622 | 3 |
| `CK5142` | paradox-checks | A character comparison written as `link = root` (or prev, this, scope:x); compare with `link = { this = root }`. | error | False (issue #91): `liege = root`, `employer = scope:x` is the ordinary comparison form (1,475 uses in the 1.20.0.2 base game) and a parameter inside create_character. | removed | 267 | 0 |
| `COND-001` | conventions | if, else_if, trigger_if or trigger_else_if without a limit. | warning | Convention. | information | 10 | 10 |
| `COND-002` | conventions | else or trigger_else with a limit (it is ignored). | warning | Convention. | information | 5 | 5 |
| `COND-003` | conventions | else or trigger_else without a preceding if. | warning | Convention. | information | 2 | 2 |
| `CONV-001` | conventions | An event with options has no type. | warning | False: `type` is optional and defaults to character_event (game/events/_events.info). | removed | 9 | 0 |
| `CONV-002` | conventions | An event with options has no title. | warning | Convention (title is an optional field of the events schema). | information | 44 | 44 |
| `CONV-004` | conventions | An option block has no name. | warning | Merged into CK3450 (the same check: an option without name). | removed | 1 | 0 |
| `EVENT-001` | events | Invalid event type. | warning | Convention (the four types of game/events/_events.info, the only ones the 1.20.0.2 base game uses). | information | 0 | 0 |
| `EVENT-002` | events | An event is missing a required field. | warning | Convention (game/events/_events.info "sender = X | information | 172 | 0 |
| `EVENT-003` | events | Invalid event theme. | warning | Merged into CK3430 (one code for an unknown theme, judged against the workspace and the base game instead of 32 hard-coded names). | removed | 1,192 | 0 |
| `EVENT-004` | events | Invalid portrait position or animation. | warning | Merged into CK3422 (unknown portrait animation). | removed | 0 | 0 |
| `EVENT-005` | events | Malformed event id (expected namespace.number). | warning | Unreachable: only `namespace.number` keys reach the validator, so the id is never malformed. | removed | 0 | 0 |
| `EVENT-006` | events | Invalid dynamic description (first_valid, random_valid, triggered_desc). | warning | Never reported: the check read plain-object fields (`config.triggered_desc`) that an AST node does not have. | removed | 0 | 0 |
| `EVENT-007` | events | Invalid option configuration. | warning | Merged into CK3450 (an option without name). | removed | 0 | 0 |
| `EVENT-009` | events | An event id does not match the file's namespace declaration. | warning | Merged into EVENT-016 (the same game message, for one declared namespace instead of several). | removed | 0 | 0 |
| `EVENT-010` | events | An event file has no namespace declaration. | warning | As EVENT-016. | information | 0 | 0 |
| `EVENT-011` | events | A hidden event has options. | warning | Merged into CK3762 (a hidden event with options). | removed | 0 | 0 |
| `EVENT-012` | events | A hidden event has an after block. | warning | Merged into CK3520 (an after block in a hidden event). | removed | 0 | 0 |
| `EVENT-013` | events | A non-hidden event has no options. | warning | Merged into CK3763 (a non-hidden event without options). | removed | 0 | 0 |
| `EVENT-016` | events | An event uses a namespace that is not declared in its file (the game's own warning). | warning | Convention under the evidence rule: the game prints "Namespace '{}' used in event '{}' (file: {}) is not defined in this file - it might not load properly.", a string of the 1.20.0.2 executable that the spec package's error catalogue does not hold. | information | 0 | 0 |
| `GFX001` | graphics | Graphics file not found: a .dds, .png or .tga path that exists in no workspace mod, not in the base game's game/ and not in any game/dlc/<dlc>/ folder. | warning | The game logs it (catalogue failed_to_load_texture_X_file_not_found, "Failed to load texture %s - file not found"). | warning | 3 | 3 |
| `ITER-003` | iterators | An ordered_ iterator without order_by. | warning | Convention (every vanilla ordered_ iterator has one; no catalogue message). | information | 22 | 22 |
| `LOC-001` | localization-references, localization | In script files, a title, desc or name value contains spaces (literal text where a localization key belongs). In localization files, an entry key the localization index cannot read (it starts with a digit, or contains spaces, dashes or other punctuation). | warning | Script files: the game reads the text as a key and logs it missing (catalogue unknown_loc_key_X, "Unknown loc key %s"; game/events/_events.info: "Missing localization keys are logged as errors"); a key with spaces cannot be defined. Localization files: convention. | warning | 31 | 0 |
| `LOC-002` | localization-references, localization | In script files, a tooltip value contains spaces (literal text where a localization key belongs). In localization files, an unknown character function such as [ROOT.Char.GetNam]. | warning | Script files: as LOC-001. Localization files: convention (the function list is not the game's own data). | warning | 0 | 0 |
| `LOC-004` | localization | Unknown icon reference (@name! or £name£). | warning | Convention (the extracted icon data is not complete). | information | 0 | 0 |
| `LOC-005` | localization | Unbalanced brackets in localization text. | warning | The game prints "Loc key `{}`: Unexpected extra `[` at position {} - file `{}`" (catalogue loc_key_X_unexpected_extra_at_position_X_file_X, and _2 for `]`). | warning | 0 | 0 |
| `LOC-006` | localization | Unknown concept in a [concept\|E] link. | warning | Convention (the extracted concept data is not complete). | information | 0 | 0 |
| `LOC-007` | localization | Invalid $VARIABLE$ substitution (name or format specifier). | warning | Convention. | information | 0 | 0 |
| `SWITCH-001` | switch | A switch block has no trigger field. | error | Convention. | information | 0 | 0 |
| `SWITCH-002` | switch | A switch block has no branch values. | warning | Convention. | information | 0 | 0 |
| `SWITCH-003` | switch | The switch trigger names no trigger of the spec package and no workspace scripted trigger. | warning | The game logs an unknown trigger (catalogue unknown_trigger_X, "Unknown trigger '%s'"). | warning | 13 | 0 |
| `VALUE-001` | script-values | Invalid script value type. | warning | A hand-made name list: a fixed value naming anything outside 11 hard-coded game values was reported, while a script value may name any script value; the engine registry judges names against the spec package. | removed | 0 | 0 |
| `VALUE-002` | script-values | Invalid range (min greater than max). | error | The game prints "min value in range directive is larger than the max value" (catalogue min_value_in_range_directive_is_larger_than_the_max_value_un). | error | 0 | 0 |
| `VALUE-003` | script-values | Unknown formula operation. | warning | A hand-made name list: formula keys outside 13 hard-coded operations were reported, while a formula holds limits, iterators and saved values; the engine registry judges every key against the spec package. | removed | 0 | 0 |
| `VALUE-004` | script-values | Invalid conditional structure (else_if after else). | error | Convention. | information | 0 | 0 |
| `VALUE-006` | script-values | Invalid round_to parameter (it must be positive). | error | Convention. | information | 0 | 0 |
