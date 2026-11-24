# The planted-defect mod

The mod the scored agent-use test is graded on (docs/PLAN.md, items 6.7 to 6.9;
[tools/scored-run/README.md](../../tools/scored-run/README.md)). Written by hand: a "Harvest
Festival" mod with events in four files, two decisions, scripted effects and triggers, script
values, two traditions, on-actions, two modifiers, two interaction categories and their
localization: 17 files and 591 lines.

```text
fixtures/defects/
  mod/             the mod as an agent receives it: 32 defects, every error and warning code
                   at least once, and 29 lines that look wrong and are not
  reference/       the same mod with every defect fixed; it passes every grader
  manifest.json    each planted defect: the check code, where the checker reports it, the text
                   of that line, what it is, and the lines a fix may change; and each
                   look-alike line with why it is right
```

The mod is checked over the game stub [fixtures/game/planted-defects](../game/planted-defects/README.md),
which defines the few base-game names it uses and does not define itself, so that public CI can
check it without the game. The scored test starts the agent server over the same stub, and the
extension's smoke test and same-answers test (`task vscode:test`, build step 7) open a copy of
`mod/` in a real VS Code with the stub as the game folder.

Neither `mod/` nor `reference/` holds a README of its own: everything in `mod/` is handed to the
agent, and this page would tell it where the defects are.


**The `style/` family is not planted.** The mod is not in pychivalry's format, so the checker
reports `style/` findings on its files beside the planted defects (build step 8,
[docs/formatting.md](../../docs/formatting.md)); they rest on pychivalry's own formatting rules,
not on the game, and the manifest, the graders and the mod's tests leave them out. Whether the mod
and its reference copy should be brought into the format is a question for the owner
([docs/decisions.md](../../docs/decisions.md#asked-awaiting-the-owner)).

## Why it is this hard

The first mod, of 27 defects (one per code) and 10 look-alikes in 254 lines, was fixed whole by
every one of item 6.11's five test sessions, each in about a minute, reading every file once:
the pass rate could not tell a better agent server from a worse one
([tools/scored-run/README.md](../../tools/scored-run/README.md#what-this-says-about-the-agent-server),
proposal 1). This one is harder without being unfair. Every defect is still something a modder
writes, the checker reports each one, and the right fix can be found with the server's tools:

- **Defects whose fix needs a lookup.** The scope an effect or a trigger takes and the link
  that leads there from the scope it is in (`add_county_modifier`, `change_fervor`, `tier`,
  `holder`); the exact name of an effect, a modifier, a field, an on-action and a link; a
  scripted effect, a scripted trigger and an event defined in another file under another
  spelling; the values the base game gives a required field.
- **Defects that interact.** The hidden event `harvst.0004` misspells its namespace; renaming it
  `harvest.0004`, the obvious fix, clashes with the court event of that id in another file,
  and the on-action that names the event must follow its new id. Two events share
  `harvest.0002`; the one for the court is the `harvest.0012` the on-action names and its own
  keys say, so the right fix answers the unknown key too. The faith event must be hidden, not
  stripped of its `scope = faith`, which would leave its faith trigger and effect in a
  character scope.
- **Defects fixed away from the finding.** A description key that no localization file defines,
  fixed by a line in the localization file; a scripted effect that lost its name, which its
  caller in the same file gives; an unclosed block the game reports at the last block's opening
  brace, whose closing brace belongs after the block's last line, not at the end of the file.
- **More and closer look-alikes,** many next to a defect of the same shape: the right link
  inside `primary_title`, the right `?=`, the right event id, the right field name, a
  multi-area modifier in the county block, and a faith effect in a faith scope beside the one
  that is not.

The graders judge a fix by the checker and the manifest's fix ranges, not by equality with
`reference/`: `liege` and `primary_title.holder` both fix the link, and
`add_character_modifier` passes as well as wrapping the county effect in `capital_county` (the
reference's fix, which gives the county a modifier of county modifiers). The obvious fixes of
the interacting defects fail: a clash or an unknown key stays (`zero-errors`, `defects-gone`),
or a brace lands outside the lines its fix may change (`only-planted-lines`). Tests hold both
(`tools/src/scored-run/graders.test.ts`).

## What the checker reports

On `mod/`, over the stub: exactly the planted defects, one finding each and two for the clash
(one at each definition), at every severity: 26 errors and 7 warnings, no information, no hint.
On `reference/`: nothing at all. It is the same with unused keys on (`localization/unused-key`,
off by default in the runner and in the agent server's `check`): the mod has none. A test holds
all of it (`tools/src/scored-run/defects.test.ts`), and another gets the same 33 findings from
the built agent server's `check`, with the data that says what is valid at the scope and field
findings (`tools/src/scored-run/server.test.ts`).

## The defects

Every check code this build has that is an error or a warning is planted at least once, 21
errors and 6 warnings; `names/unknown-effect` three times, `names/unknown-trigger`,
`references/unknown-key` and `scope/wrong-scope-for-effect` twice. No advice code is planted.

| Code | Reported at | The defect |
| --- | --- | --- |
| `definitions/clash` | `events/harvest_events.txt:45`, `events/harvest_court_events.txt:34` | Two events share the id harvest.0002. The second, for the court, is the one the on-action names harvest.0012 and whose keys say harvest.0012. |
| `fields/bare-value-in-record` | `common/decision_group_types/harvest_groups.txt:4` | important_decision_group is written without "= yes"; the game reports it at the token after it. |
| `fields/missing-required-field` | `common/character_interaction_categories/harvest_categories.txt:9` | An interaction category without its required index; the base game's categories use 0 to 15 and the mod's other one 16. A fix may rewrite the record. |
| `fields/unknown-field` | `common/decisions/harvest_decisions.txt:7` | ai_check_interval misspelled. |
| `localization/missing-key` | `events/harvest_court_events.txt:48` | The description key harvest.0013.desc is defined in no localization file: the fix is a line added to the localization file, or the field changed to a key that exists. |
| `localization/unbalanced-brackets` | `localization/english/harvest_l_english.yml:3` | A [ without its ]. |
| `names/modifier-outside-use-area` | `common/culture/traditions/harvest_traditions.txt:24` | monthly_piety, a character modifier, in the county_modifier block; it belongs in the character_modifier block above. |
| `names/unknown-effect` | `common/scripted_effects/harvest_cleanup_effects.txt:4` | The scripted effect the cleanup calls has no definition: the block below it lost its name, which this call gives. |
| `names/unknown-effect` | `events/harvest_events.txt:34` | The scripted effect harvest_alms_giving_effect, defined in another file, called by another name. |
| `names/unknown-effect` | `events/harvest_events.txt:39` | add_piety_experience misspelled. |
| `names/unknown-link` | `events/harvest_events.txt:52` | The link primary_spouse misspelled. |
| `names/unknown-modifier` | `common/culture/traditions/harvest_traditions.txt:18` | monthly_prestige_gain_mult misspelled. |
| `names/unknown-on-action` | `common/on_action/harvest_on_actions.txt:30` | The mod's own on-action harvest_festival_pulse_late misspelled; harvest_festival_pulse, above it, is right. |
| `names/unknown-trigger` | `events/harvest_events.txt:11` | is_imprisoned misspelled. |
| `names/unknown-trigger` | `events/harvest_events.txt:74` | The scripted trigger harvest_can_attend_trigger, defined in another file, called by another name. |
| `references/unknown-key` | `common/decisions/harvest_decisions.txt:25` | trigger_event names harvest_markt.0001; the event is harvest_market.0001, in another file. |
| `references/unknown-key` | `common/on_action/harvest_on_actions.txt:6` | The on-action names harvest.0012, which no file defines: the court event that should have it is written harvest.0002 (the clash above). Renaming that event fixes both; another free id fixes the clash, and then this line must follow it. |
| `scope/link-on-wrong-scope` | `common/decisions/harvest_decisions.txt:18` | holder, a link from a title, used in the character scope of a decision; liege is meant, and any link to a title before it (primary_title.holder) is also valid. A fix may rewrite the is_valid block. |
| `scope/wrong-scope-for-effect` | `events/harvest_events.txt:17` | add_county_modifier, an effect of titles, run in the character scope of the event; the modifier holds county modifiers, so it belongs in a county, such as capital_county. A fix may rewrite the block. |
| `scope/wrong-scope-for-effect` | `events/harvest_faith_events.txt:35` | change_fervor, an effect of faiths, run in the character scope of an option; the link faith leads there. |
| `scope/wrong-scope-for-trigger` | `common/decisions/harvest_decisions.txt:12` | tier, a trigger of titles, tested in the character scope of a decision; highest_held_title_tier, or tier inside primary_title, tests it. |
| `structure/event-non-character-shown` | `events/harvest_faith_events.txt:4` | An event in the faith scope that is neither hidden nor major. The fix is a line that hides it; removing its scope = faith would leave its faith effects in a character scope. |
| `structure/event-undeclared-namespace` | `events/harvest_events.txt:102` | The namespace harvest misspelled in the id of the hidden event. harvest.0004 is taken (the court event), so the obvious fix makes a clash; the event needs a free id, and the on-action that names it must follow. |
| `structure/range-min-above-max` | `common/script_values/harvest_values.txt:5` | A range written high first. |
| `syntax/block-without-key` | `common/scripted_effects/harvest_cleanup_effects.txt:8` | A scripted effect whose name was left out; the call above names it harvest_remove_bounty_effect. |
| `syntax/missing-closing-brace` | `common/scripted_effects/harvest_reward_effects.txt:9` | The add_character_modifier block is never closed, so the last block of the file is not either; the game reports it at that block's opening brace. The } belongs after years = 2, not at the end of the file. |
| `syntax/missing-equals-before-block` | `common/scripted_effects/harvest_effects.txt:4` | limit written without its =. |
| `syntax/missing-operator` | `common/script_values/harvest_values.txt:2` | A script constant written without its =. |
| `syntax/missing-value` | `common/scripted_effects/harvest_effects.txt:20` | add_piety with no amount; the game reports it at the token after the =. |
| `syntax/null-safe-operator-after-value` | `common/scripted_triggers/harvest_triggers.txt:5` | A saved scope written in quotes before ?=. |
| `syntax/operator-without-key` | `common/scripted_effects/harvest_effects.txt:15` | A branch of a random list without its weight. |
| `syntax/unexpected-closing-brace` | `common/scripted_triggers/harvest_triggers.txt:24` | One closing brace too many at the end of the file. |

## The look-alikes

Lines an agent may be tempted to "fix" that are right; the checker reports nothing on them.
Two sit inside lines a fix may rewrite (the decision's `is_valid`, the market's interaction
category), where only the `look-alikes-untouched` grader protects them.

| Line | Text | Why it is right |
| --- | --- | --- |
| `events/harvest_events.txt:32` | `add_gold = -10` | A negative amount in an add effect is how gold is taken away. |
| `events/harvest_events.txt:33` | `ruler_feast_gift_effect = yes` | A scripted effect the base game defines, not the mod. |
| `events/harvest_events.txt:40` | `faith = { change_fervor = 5 }` | change_fervor in the faith scope, reached by the link faith: right, where the same effect in the faith event file is not. |
| `events/harvest_events.txt:51` | `exists = root.primary_spouse` | The link primary_spouse, spelled right, in a value. |
| `events/harvest_events.txt:53` | `scope:harvest_host = root` | "=" between two scopes compares them; it assigns nothing. |
| `events/harvest_events.txt:75` | `NOT = { harvest_famine_trigger = yes }` | A scripted trigger the mod defines, called by its own name. |
| `events/harvest_court_events.txt:56` | `capital_county = { change_county_control = 5 }` | A county effect inside capital_county: the right scope. |
| `events/harvest_faith_events.txt:5` | `scope = faith` | The event runs in the faith scope on purpose: its trigger and immediate test and change the faith. |
| `events/harvest_faith_events.txt:14` | `change_fervor = 3` | change_fervor in the faith scope of the faith event: right. |
| `common/decisions/harvest_decisions.txt:16` | `this = root` | "this = root" compares two scopes. |
| `common/decisions/harvest_decisions.txt:48` | `primary_title = { tier >= 3 }` | tier inside primary_title: a title trigger in a title scope. |
| `common/decisions/harvest_decisions.txt:53` | `liege = { is_adult = yes }` | liege, a link from a character, in a character scope. |
| `common/decisions/harvest_decisions.txt:59` | `trigger_event = { id = harvest_market.0002 days = 7 }` | An event of the harvest_market namespace, spelled right. |
| `common/decisions/harvest_decisions.txt:44` | `ai_check_interval = 60` | The field ai_check_interval, spelled right. |
| `common/decisions/harvest_decisions.txt:58` | `harvest_alms_giving_effect = yes` | The scripted effect the mod defines, called by its own name. |
| `common/scripted_triggers/harvest_triggers.txt:19` | `always = no` | A trigger that is never true, on purpose, as its comment says. |
| `common/scripted_triggers/harvest_triggers.txt:23` | `has_cultural_tradition = tradition_agrarian` | A cultural tradition the base game defines, not the mod. |
| `common/scripted_triggers/harvest_triggers.txt:14` | `scope:harvest_host ?= { is_ai = no }` | A saved scope written bare before ?=: the null-safe form, right. |
| `common/character_interaction_categories/harvest_categories.txt:5` | `color = hsv { 0.12 0.7 0.8 }` | A colour in HSV: "hsv" before the block names the colour space; no "=" is missing. |
| `common/character_interaction_categories/harvest_categories.txt:11` | `color = { 0.8 0.6 0.2 }` | A colour in RGB, with no prefix: right as it is. |
| `common/culture/traditions/harvest_traditions.txt:19` | `bowmen_damage_mult = 0.05` | A modifier no list names, which a template (<men-at-arms type>_damage_mult) makes. |
| `common/culture/traditions/harvest_traditions.txt:23` | `levy_size = 0.05` | A modifier whose use areas include counties: right in the county_modifier block. |
| `common/scripted_effects/harvest_effects.txt:24` | `ROOT = {` | Upper-case ROOT is the same scope as root. |
| `common/scripted_effects/harvest_effects.txt:12` | `60 = {` | A branch of the random list with its weight. |
| `common/script_values/harvest_values.txt:1` | `@harvest_tithe = 25` | A script constant with its =. |
| `common/script_values/harvest_values.txt:8` | `harvest_loss_value = { -10 -5 }` | A range of negative numbers, low first: right. |
| `common/on_action/harvest_on_actions.txt:29` | `harvest_festival_pulse` | The on-action harvest_festival_pulse, spelled right. |
| `common/scripted_effects/harvest_reward_effects.txt:3` | `primary_spouse ?= {` | The link primary_spouse with ?=: null-safe, right. |
| `localization/english/harvest_l_english.yml:5` | `harvest.0001.b:0 "Give #P 10#! gold to the poor."` | #P and #! format the text; they are not brackets. |

## How it is used

For each trial the scored test makes a fresh copy of `mod/` with no history and starts one test
session of the Claude Code installed on the developer's machine, with pychivalry's agent server
attached, asked to fix it. A trial passes when:

1. the checker reports zero errors;
2. every planted defect is gone;
3. nothing outside the planted lines changed;
4. the look-alike lines are untouched;
5. no content was deleted.

The graders are code (`tools/src/scored-run/graders.ts`) and have their own tests, which run in
public CI: they pass on `reference/`, fail on the untouched `mod/`, each fails on its own on a
result made to break it alone, a fix the reference does not use passes, and the obvious fixes of
the interacting defects fail. The test sessions themselves are Claude Code's, not pychivalry's:
pychivalry holds no key and makes no model call, and each test session counts against the
developer's own Claude plan, so a run is started by a person, or by an agent on the owner's
word, and never by CI. The target is every test session passing: 10 of 10 in a release run
(docs/decisions.md, decision 82).

## Rules

- Every error and warning code is planted at least once, so a code no session can fix shows
  in the pass rate; a code may be planted again where that makes the mod harder.
- A defect added here is added to `manifest.json` and fixed in `reference/` in the same change;
  the test fails until the checker reports exactly the manifest's defects on `mod/`.
- A fix range (`fix` in the manifest) covers the lines a correct fix may change, and no more:
  the line, or the block a fix may rewrite, and where a fix may add lines. Where a defect's
  obvious fix is wrong in a way the checker cannot see (a brace at the end of the file), the
  range leaves it out.
- A defect is fair: the checker reports it, and the server's tools can find its right fix.
- The mod is written by hand, like every fixture.
