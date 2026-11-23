# The planted-defect mod

The mod the scored agent-use run is graded on (docs/PLAN.md, items 6.7 to 6.9;
[tools/scored-run/README.md](../../tools/scored-run/README.md)). Written by hand: a small
"Harvest Festival" mod with events, decisions, scripted effects and triggers, a script value, a
tradition, an on-action, a modifier and its localization.

```text
fixtures/defects/
  mod/             the mod as an agent receives it: 27 defects, one per check code, and
                   10 lines that look wrong and are not
  reference/       the same mod with every defect fixed; it passes every grader
  manifest.json    each planted defect: the check code, where the checker reports it, the text
                   of that line, what it is, and the lines a fix may change; and each
                   look-alike line with why it is right
```

The mod is checked over the game stub [fixtures/game/planted-defects](../game/planted-defects/README.md),
which defines the few base-game names it uses and does not define itself, so that public CI can
check it without the game. The scored run starts the agent server over the same stub.

Neither `mod/` nor `reference/` holds a README of its own: everything in `mod/` is handed to the
agent, and this page would tell it where the defects are.

## What the checker reports

On `mod/`, over the stub: exactly the planted defects, one finding each and two for the clash
(one at each definition), at every severity: 22 errors and 6 warnings, no information, no hint.
On `reference/`: nothing at all. A test holds both (`tools/src/scored-run/defects.test.ts`).

## The defects

Every check code this build has that is an error or a warning is planted once, 21 errors and 6
warnings; no advice code was needed to reach 20. Each is a mistake a modder makes: a misspelled
name, a block in the wrong scope, a missing brace.

| Code | Reported at | The defect |
| --- | --- | --- |
| `definitions/clash` | `events/harvest_events.txt:36`, `events/harvest_faith_events.txt:14` | Two events share the id harvest.0002; the second one's keys say it is harvest.0011. |
| `fields/bare-value-in-record` | `common/decision_group_types/harvest_groups.txt:4` | important_decision_group is written without "= yes"; the game reports it at the token after it. |
| `fields/missing-required-field` | `common/character_interaction_categories/harvest_categories.txt:2` | An interaction category without its required index; a fix may rewrite the record. |
| `fields/unknown-field` | `common/decisions/harvest_decisions.txt:7` | ai_check_interval misspelled. |
| `localization/missing-key` | `events/harvest_events.txt:39` | The description key harvest.0002.desc is defined in no localization file. |
| `localization/unbalanced-brackets` | `localization/english/harvest_l_english.yml:3` | A [ without its ]. |
| `names/modifier-outside-use-area` | `common/culture/traditions/harvest_traditions.txt:23` | monthly_piety, a character modifier, in the county_modifier block. |
| `names/unknown-effect` | `events/harvest_events.txt:24` | add_gold misspelled. |
| `names/unknown-link` | `events/harvest_events.txt:42` | The link father misspelled; a fix may rewrite the trigger block. |
| `names/unknown-modifier` | `common/culture/traditions/harvest_traditions.txt:18` | monthly_prestige misspelled; a fix may rewrite the character_modifier block. |
| `names/unknown-on-action` | `common/on_action/harvest_on_actions.txt:10` | The mod's own on-action harvest_festival_pulse misspelled. |
| `names/unknown-trigger` | `events/harvest_events.txt:10` | is_adult misspelled. |
| `references/unknown-key` | `events/harvest_events.txt:25` | trigger_event names an event id no file defines. |
| `scope/link-on-wrong-scope` | `common/decisions/harvest_decisions.txt:16` | holder, a link of titles, used in the character scope of a decision; a fix may rewrite the is_valid block. |
| `scope/wrong-scope-for-effect` | `events/harvest_events.txt:16` | add_county_modifier, an effect of titles, run in the character scope of the event. |
| `scope/wrong-scope-for-trigger` | `common/decisions/harvest_decisions.txt:11` | tier, a trigger of titles, tested in the character scope of a decision. |
| `structure/event-non-character-shown` | `events/harvest_faith_events.txt:4` | An event in the faith scope that is neither hidden nor major. |
| `structure/event-undeclared-namespace` | `events/harvest_events.txt:53` | The namespace harvest misspelled in an event id. |
| `structure/range-min-above-max` | `common/script_values/harvest_values.txt:4` | A range written high first. |
| `syntax/block-without-key` | `common/scripted_effects/harvest_cleanup_effects.txt:7` | A scripted effect whose name was left out. |
| `syntax/missing-closing-brace` | `common/scripted_effects/harvest_reward_effects.txt:2` | The last block of the file is never closed; the game reports it at its opening brace. |
| `syntax/missing-equals-before-block` | `common/scripted_effects/harvest_effects.txt:4` | limit written without its =. |
| `syntax/missing-operator` | `common/script_values/harvest_values.txt:1` | A script constant written without its =. |
| `syntax/missing-value` | `common/scripted_effects/harvest_effects.txt:20` | add_piety with no amount; the game reports it at the token after the =. |
| `syntax/null-safe-operator-after-value` | `common/scripted_triggers/harvest_triggers.txt:5` | A saved scope written in quotes before ?=. |
| `syntax/operator-without-key` | `common/scripted_effects/harvest_effects.txt:15` | A branch of a random list without its weight. |
| `syntax/unexpected-closing-brace` | `common/scripted_triggers/harvest_triggers.txt:17` | One closing brace too many at the end of the file. |

## The look-alikes

Lines an agent may be tempted to "fix" that are right; the checker reports nothing on them.
Four sit inside lines a fix may rewrite (the interaction category, the decision's `is_valid`,
the event's trigger, the tradition's `character_modifier`), where only the `look-alikes-untouched`
grader protects them.

| Line | Text | Why it is right |
| --- | --- | --- |
| `events/harvest_events.txt:30` | `add_gold = -10` | A negative amount in an add effect is how gold is taken away. |
| `events/harvest_events.txt:31` | `ruler_feast_gift_effect = yes` | A scripted effect the base game defines, not the mod. |
| `events/harvest_events.txt:43` | `scope:harvest_host = root` | "=" between two scopes compares them; it assigns nothing. |
| `common/decisions/harvest_decisions.txt:15` | `this = root` | "this = root" compares two scopes. |
| `common/scripted_triggers/harvest_triggers.txt:12` | `always = no` | A trigger that is never true, on purpose, as its comment says. |
| `common/scripted_triggers/harvest_triggers.txt:16` | `has_cultural_tradition = tradition_agrarian` | A cultural tradition the base game defines, not the mod. |
| `common/character_interaction_categories/harvest_categories.txt:4` | `color = hsv { 0.12 0.7 0.8 }` | A colour in HSV: "hsv" before the block names the colour space; no "=" is missing. |
| `common/culture/traditions/harvest_traditions.txt:19` | `bowmen_damage_mult = 0.05` | A modifier no list names, which a template (<men-at-arms type>_damage_mult) makes. |
| `common/scripted_effects/harvest_effects.txt:23` | `ROOT = {` | Upper-case ROOT is the same scope as root. |
| `localization/english/harvest_l_english.yml:5` | `harvest.0001.b:0 "Give #P 10#! gold to the poor."` | #P and #! format the text; they are not brackets. |

## How it is used

For each trial the scored run makes a fresh copy of `mod/` with no history, and an AI agent is
asked to fix it using pychivalry's agent server. A trial passes when:

1. the checker reports zero errors;
2. every planted defect is gone;
3. nothing outside the planted lines changed;
4. the look-alike lines are untouched;
5. no content was deleted.

The graders are code (`tools/src/scored-run/graders.ts`) and have their own tests, which run in
public CI: they pass on `reference/`, fail on the untouched `mod/`, and each fails on its own on
a result made to break it alone. The scored runs themselves call a model, so they are started by
a person or an agent and never by CI.

## Rules

- One defect per check code, so a failure names the check.
- A defect added here is added to `manifest.json` and fixed in `reference/` in the same change;
  the test fails until the checker reports exactly the manifest's defects on `mod/`.
- A fix range (`fix` in the manifest) covers the lines a correct fix may change, and no more:
  the line, or the block a fix may rewrite, and where a fix may add lines.
- The mod is written by hand, like every fixture.
