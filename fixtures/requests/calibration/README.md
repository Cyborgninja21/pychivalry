# Hand-made results for the judge's calibration

**Hand-made, not the work of a test session.** These ten results were written by hand for the
judge's calibration (docs/PLAN.md item 9.6), because the first scored authoring run kept none of
its results. Some are right, some are deliberately wrong, and some cannot be judged from their
files alone; which is which is not written anywhere, so that the grading is done by reading
them. How to grade them and run the calibration: [the guide](../../../docs/guide/judge-calibration.md).

Since the second scored authoring run (2026-11-24) kept its results, real results are graded
too: twelve of them, one of each request, in [run-2/](run-2/README.md), with a sheet of their own.
These hand-made ones stay, and are graded first: they are the only results of the first twelve
requests made wrong on purpose, and whether the judge can say no shows only on a result that is
wrong. A third sheet, in [expert/](expert/README.md), holds twenty-four hand-made results of the
expert requests added after the second run, two of each, every one passing everything code
checks; it is graded last, before the release run (decision 135).

Each folder under `results/` is a whole mod as a session would leave it: the request's base mod
(`fixtures/requests/bases/`) with the result's files written into it. The judge is shown exactly
these files, so grade from them alone, the way the judge must.

[grades.json](grades.json) is the sheet, in the format `task scored:calibrate` reads: replace each
`?` with `yes`, `no` or `cannot-tell`.

## The results and their questions

### `results/decision-give-alms-1`

Request `decision-give-alms`: Write a decision `authoring_alms_decision` in a new file under `common/decisions/`. It is shown to rulers (`is_ruler`) and can be taken only with at least 100 gold (`gold`). Taking it takes 100 gold from the character (`add_gold`) and gives 50 piety (`add_piety`). Write its English localization in a new file under `localization/english/`: the title `authoring_alms_decision` and the description `authoring_alms_decision_desc`.

- `conditions-as-asked`: Is the decision shown only to rulers, and can it be taken only with at least 100 gold?
- `effects-as-asked`: Does taking the decision take 100 gold from the character and give 50 piety, and nothing else?
- `text-as-asked`: Do the title and the description say what the decision is and does?

### `results/effect-reward-1`

Request `effect-reward`: Write a scripted effect `authoring_reward_effect` in a new file under `common/scripted_effects/`. It gives the character it runs on 50 gold (`add_gold`) and 25 prestige (`add_prestige`).

- `effects-as-asked`: Does the effect give the character it runs on 50 gold and 25 prestige?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-reward-2`

Request `effect-reward`: Write a scripted effect `authoring_reward_effect` in a new file under `common/scripted_effects/`. It gives the character it runs on 50 gold (`add_gold`) and 25 prestige (`add_prestige`).

- `effects-as-asked`: Does the effect give the character it runs on 50 gold and 25 prestige?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-reward-3`

Request `effect-reward`: Write a scripted effect `authoring_reward_effect` in a new file under `common/scripted_effects/`. It gives the character it runs on 50 gold (`add_gold`) and 25 prestige (`add_prestige`).

- `effects-as-asked`: Does the effect give the character it runs on 50 gold and 25 prestige?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-war-chest-1`

Request `effect-war-chest`: Write a scripted effect `authoring_war_chest_effect` in a new file under `common/scripted_effects/`, for a character. When the character is at war (`is_at_war`) it gives 100 gold (`add_gold`); otherwise it gives 50 prestige (`add_prestige`): write it with `if` and `else`. Either way it then raises the character's stress by 5 (`add_stress`).

- `conditions-as-asked`: Is the gold given only when the character is at war, and the prestige only when it is not?
- `effects-as-asked`: Does the effect give 100 gold or 50 prestige as the request says, and raise stress by 5 in both cases?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-war-chest-2`

Request `effect-war-chest`: Write a scripted effect `authoring_war_chest_effect` in a new file under `common/scripted_effects/`, for a character. When the character is at war (`is_at_war`) it gives 100 gold (`add_gold`); otherwise it gives 50 prestige (`add_prestige`): write it with `if` and `else`. Either way it then raises the character's stress by 5 (`add_stress`).

- `conditions-as-asked`: Is the gold given only when the character is at war, and the prestige only when it is not?
- `effects-as-asked`: Does the effect give 100 gold or 50 prestige as the request says, and raise stress by 5 in both cases?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/event-letter-from-spouse-1`

Request `event-letter-from-spouse`: Write two character events (`character_event`) in a new file under `events/`, in the namespace `authoring_letter`. The first, `authoring_letter.0001`, comes once a year through the on-action `yearly_playable_pulse`, which you hook in a new file under `common/on_action/`; it may happen only to a ruler (`is_ruler`) who is married (`is_married`): a letter arrives from the character's spouse. Its one option gives the character 10 piety (`add_piety`) and fires the second event, `authoring_letter.0002`, 3 days later (`trigger_event`). In the second event the character answers: one option gives the character's spouse (`primary_spouse`) 20 prestige (`add_prestige`), the other lowers the character's own stress by 10 (`add_stress`). Write the English localization of both events in a new file under `localization/english/`: `authoring_letter.0001.t`, `authoring_letter.0001.desc`, `authoring_letter.0001.a`, `authoring_letter.0002.t`, `authoring_letter.0002.desc`, `authoring_letter.0002.a` and `authoring_letter.0002.b`.

- `conditions-as-asked`: Does the first event come through the yearly on-action, and can it happen only to a ruler who is married?
- `effects-as-asked`: Does the first event's option give 10 piety and fire the second event 3 days later, and do the second event's two options give 20 prestige and lower stress by 10?
- `scope-as-asked`: Are the 20 prestige given to the character's spouse, and the 10 piety and the lower stress to the character?
- `text-as-asked`: Do the texts tell of a letter from the spouse and of the character's answer, each option's text fitting what it does?

### `results/event-merchant-debt-1`

Request `event-merchant-debt`: Write a character event (`character_event`) with the id `authoring_merchant.0001` in a new file under `events/`, in the namespace `authoring_merchant`. A merchant comes back to repay an old debt to the character. The event has a title, a description and two options: the first gives the character 100 gold (`add_gold`), the second gives 50 prestige (`add_prestige`) instead. Write its English localization in a new file under `localization/english/`: the title `authoring_merchant.0001.t`, the description `authoring_merchant.0001.desc` and the two options `authoring_merchant.0001.a` and `authoring_merchant.0001.b`.

- `effects-as-asked`: Does the first option give the character 100 gold and the second 50 prestige, each that and nothing else?
- `text-as-asked`: Do the title, the description and the two options tell of a merchant repaying an old debt, each option's text fitting what it does?
- `nothing-unasked`: Does the result add nothing that changes the game beyond the one event and its localization (no other effect, condition, event or record)?

### `results/trigger-family-ready-1`

Request `trigger-family-ready`: Write a scripted trigger `authoring_family_ready_trigger` in a new file under `common/scripted_triggers/`, for a character. It holds when the character is married (`is_married`) or has at least one child who is an adult (`any_child`, `is_adult`), and in either case is not imprisoned (`is_imprisoned`).

- `conditions-as-asked`: Does the trigger hold exactly when the character is married or has an adult child, and is not imprisoned?
- `scope-as-asked`: Is being an adult tested on the child, and being married and not imprisoned on the character?

### `results/trigger-family-ready-2`

Request `trigger-family-ready`: Write a scripted trigger `authoring_family_ready_trigger` in a new file under `common/scripted_triggers/`, for a character. It holds when the character is married (`is_married`) or has at least one child who is an adult (`any_child`, `is_adult`), and in either case is not imprisoned (`is_imprisoned`).

- `conditions-as-asked`: Does the trigger hold exactly when the character is married or has an adult child, and is not imprisoned?
- `scope-as-asked`: Is being an adult tested on the child, and being married and not imprisoned on the character?
