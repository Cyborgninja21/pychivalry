# Real results for the judge's calibration

**Real results of test sessions, not hand-made.** These twelve results are the work of the
second scored authoring run (2026-11-24, [`records/scored/authoring.json`](../../../../records/scored/authoring.json)):
Opus 5.5 test sessions, one result of each of the twelve requests. Each is **trial 1** of its
request, taken by its number before any result was read, so that none was picked for being good
or bad. How to grade them and run the calibration: [the guide](../../../../docs/guide/judge-calibration.md),
which also says why the [hand-made results](../README.md) are graded first.

Each folder under `results/` is the trial's mod as its test session left it: the request's base
mod (`fixtures/requests/bases/`) with the files the session wrote. The skills folder the run gave
the session (`.claude/skills/`) is taken out, and nothing else of the trial is here: not its
output, its configuration or the judge's answers. The judge is shown exactly these files, with
each marked as written, changed or as given, so grade from them alone, the way the judge must.
Grade them before you read the judge's answers in the record.

[grades.json](grades.json) is the sheet, in the format `task scored:calibrate` reads: replace each
`?` with `yes`, `no` or `cannot-tell`. It has 36 answers.

## The results and their questions

### `results/event-merchant-debt-1`

Request `event-merchant-debt`: Write a character event (`character_event`) with the id `authoring_merchant.0001` in a new file under `events/`, in the namespace `authoring_merchant`. A merchant comes back to repay an old debt to the character. The event has a title, a description and two options: the first gives the character 100 gold (`add_gold`), the second gives 50 prestige (`add_prestige`) instead. Write its English localization in a new file under `localization/english/`: the title `authoring_merchant.0001.t`, the description `authoring_merchant.0001.desc` and the two options `authoring_merchant.0001.a` and `authoring_merchant.0001.b`.

- `effects-as-asked`: Does the first option give the character 100 gold and the second 50 prestige, each that and nothing else?
- `text-as-asked`: Do the title, the description and the two options tell of a merchant repaying an old debt, each option's text fitting what it does?
- `nothing-unasked`: Does the result add nothing that changes the game beyond the one event and its localization (no other effect, condition, event or record)?

### `results/event-sleepless-night-1`

Request `event-sleepless-night`: Write a character event (`character_event`) with the id `authoring_sleep.0001` in a new file under `events/`, in the namespace `authoring_sleep`: the character cannot sleep. It may happen only to an adult (`is_adult`) who is not imprisoned (`is_imprisoned`) and whose stress is at least 50 (`stress`). It has three options. The first lowers the character's stress by 20 (`add_stress`) and takes 25 gold from the character (`add_gold`). The second gives 25 piety (`add_piety`) and lowers stress by 10. The third is shown only to a character with at least 100 prestige (`prestige`); it lowers stress by 30 and takes 50 prestige from the character (`add_prestige`). Write its English localization in a new file under `localization/english/`: `authoring_sleep.0001.t`, `authoring_sleep.0001.desc`, `authoring_sleep.0001.a`, `authoring_sleep.0001.b` and `authoring_sleep.0001.c`.

- `conditions-as-asked`: Can the event happen only to an adult who is not imprisoned and has at least 50 stress, and is the third option shown only to a character with at least 100 prestige?
- `effects-as-asked`: Does each option change stress, gold, piety and prestige by exactly the amounts the request gives it, and nothing else?
- `text-as-asked`: Do the texts tell of a character who cannot sleep, each option's text fitting what it does?

### `results/event-letter-from-spouse-1`

Request `event-letter-from-spouse`: Write two character events (`character_event`) in a new file under `events/`, in the namespace `authoring_letter`. The first, `authoring_letter.0001`, comes once a year through the on-action `yearly_playable_pulse`, which you hook in a new file under `common/on_action/`; it may happen only to a ruler (`is_ruler`) who is married (`is_married`): a letter arrives from the character's spouse. Its one option gives the character 10 piety (`add_piety`) and fires the second event, `authoring_letter.0002`, 3 days later (`trigger_event`). In the second event the character answers: one option gives the character's spouse (`primary_spouse`) 20 prestige (`add_prestige`), the other lowers the character's own stress by 10 (`add_stress`). Write the English localization of both events in a new file under `localization/english/`: `authoring_letter.0001.t`, `authoring_letter.0001.desc`, `authoring_letter.0001.a`, `authoring_letter.0002.t`, `authoring_letter.0002.desc`, `authoring_letter.0002.a` and `authoring_letter.0002.b`.

- `conditions-as-asked`: Does the first event come through the yearly on-action, and can it happen only to a ruler who is married?
- `effects-as-asked`: Does the first event's option give 10 piety and fire the second event 3 days later, and do the second event's two options give 20 prestige and lower stress by 10?
- `scope-as-asked`: Are the 20 prestige given to the character's spouse, and the 10 piety and the lower stress to the character?
- `text-as-asked`: Do the texts tell of a letter from the spouse and of the character's answer, each option's text fitting what it does?

### `results/decision-give-alms-1`

Request `decision-give-alms`: Write a decision `authoring_alms_decision` in a new file under `common/decisions/`. It is shown to rulers (`is_ruler`) and can be taken only with at least 100 gold (`gold`). Taking it takes 100 gold from the character (`add_gold`) and gives 50 piety (`add_piety`). Write its English localization in a new file under `localization/english/`: the title `authoring_alms_decision` and the description `authoring_alms_decision_desc`.

- `conditions-as-asked`: Is the decision shown only to rulers, and can it be taken only with at least 100 gold?
- `effects-as-asked`: Does taking the decision take 100 gold from the character and give 50 piety, and nothing else?
- `text-as-asked`: Do the title and the description say what the decision is and does?

### `results/decision-night-vigil-1`

Request `decision-night-vigil`: Write a decision `authoring_vigil_decision` in a new file under `common/decisions/`, with the event it fires. The decision is shown to adults (`is_adult`), can be taken only by a character who is not at war (`is_at_war`), and can be taken again only 3 years after it was last taken (`cooldown`). The AI takes it seldom: its `ai_will_do` has a base of 10. Taking it fires, 5 days later (`trigger_event`), the character event (`character_event`) `authoring_vigil.0001`, which you write in a new file under `events/`, in the namespace `authoring_vigil`: the vigil ends at dawn, and the event's one option gives 25 piety (`add_piety`). Write the English localization in a new file under `localization/english/`: `authoring_vigil_decision`, `authoring_vigil_decision_desc`, `authoring_vigil.0001.t`, `authoring_vigil.0001.desc` and `authoring_vigil.0001.a`.

- `conditions-as-asked`: Is the decision shown only to adults, can it be taken only by a character not at war, and can it be taken again only 3 years later?
- `effects-as-asked`: Does taking the decision fire the event 5 days later, does the event's one option give 25 piety, and does the AI weigh the decision with a base of 10?
- `text-as-asked`: Do the decision's texts describe a night vigil, and do the event's texts tell of the vigil ending at dawn?

### `results/decision-hold-banquet-1`

Request `decision-hold-banquet`: The mod in this folder already has the scripted trigger `banquet_can_host_trigger`, the scripted effect `banquet_host_reward_effect` and the character event `banquet.0001`. Write a decision `authoring_hold_banquet_decision` in a new file under `common/decisions/` that uses them. It is shown to characters for whom `banquet_can_host_trigger` holds, and can be taken only with at least 100 gold (`gold`). Taking it takes 100 gold from the character (`add_gold`), runs `banquet_host_reward_effect`, and fires `banquet.0001` 7 days later (`trigger_event`). It can be taken again only 5 years after it was last taken (`cooldown`). Write its English localization in a new file under `localization/english/`: the title `authoring_hold_banquet_decision` and the description `authoring_hold_banquet_decision_desc`. Change none of the mod's other files.

- `conditions-as-asked`: Is the decision shown only where the mod's banquet_can_host_trigger holds, can it be taken only with at least 100 gold, and can it be taken again only 5 years later?
- `effects-as-asked`: Does taking the decision take 100 gold from the character, run banquet_host_reward_effect and fire banquet.0001 7 days later?
- `text-as-asked`: Do the title and the description say what the decision is and does?
- `nothing-unasked`: Are the mod's other files unchanged, and does the result add nothing that changes the game beyond the decision and its localization?

### `results/effect-reward-1`

Request `effect-reward`: Write a scripted effect `authoring_reward_effect` in a new file under `common/scripted_effects/`. It gives the character it runs on 50 gold (`add_gold`) and 25 prestige (`add_prestige`).

- `effects-as-asked`: Does the effect give the character it runs on 50 gold and 25 prestige?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-war-chest-1`

Request `effect-war-chest`: Write a scripted effect `authoring_war_chest_effect` in a new file under `common/scripted_effects/`, for a character. When the character is at war (`is_at_war`) it gives 100 gold (`add_gold`); otherwise it gives 50 prestige (`add_prestige`): write it with `if` and `else`. Either way it then raises the character's stress by 5 (`add_stress`).

- `conditions-as-asked`: Is the gold given only when the character is at war, and the prestige only when it is not?
- `effects-as-asked`: Does the effect give 100 gold or 50 prestige as the request says, and raise stress by 5 in both cases?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-children-gift-1`

Request `effect-children-gift`: Write two scripted effects in a new file under `common/scripted_effects/`, for a character. `authoring_children_gift_effect` gives each of the character's children who is an adult (`every_child`, `is_adult`) 25 gold (`add_gold`), and then gives the character 20 prestige (`add_prestige`). `authoring_family_feast_effect` runs `authoring_children_gift_effect` and then lowers the character's stress by 15 (`add_stress`).

- `conditions-as-asked`: Do only the children who are adults get the gold?
- `effects-as-asked`: Does the first effect give 25 gold and 20 prestige, and does the second run the first and then lower stress by 15?
- `scope-as-asked`: Is the gold given to each adult child, and the prestige and the lower stress to the character itself, once each?
- `nothing-unasked`: Do the two effects do nothing else, and does the result add nothing else that changes the game?

### `results/trigger-can-host-1`

Request `trigger-can-host`: Write a scripted trigger `authoring_can_host_trigger` in a new file under `common/scripted_triggers/`. It holds for a character who is an adult (`is_adult`), is a ruler (`is_ruler`) and has at least 50 gold (`gold`).

- `conditions-as-asked`: Does the trigger hold exactly for an adult ruler with at least 50 gold?
- `nothing-unasked`: Does the result add nothing else that changes the game?

### `results/trigger-family-ready-1`

Request `trigger-family-ready`: Write a scripted trigger `authoring_family_ready_trigger` in a new file under `common/scripted_triggers/`, for a character. It holds when the character is married (`is_married`) or has at least one child who is an adult (`any_child`, `is_adult`), and in either case is not imprisoned (`is_imprisoned`).

- `conditions-as-asked`: Does the trigger hold exactly when the character is married or has an adult child, and is not imprisoned?
- `scope-as-asked`: Is being an adult tested on the child, and being married and not imprisoned on the character?

### `results/trigger-banquet-guest-1`

Request `trigger-banquet-guest`: The mod in this folder already has the character event `banquet.0001`. Write a scripted trigger `authoring_banquet_guest_trigger` in a new file under `common/scripted_triggers/`, for a character: it holds for an adult (`is_adult`) who is not at war (`is_at_war`) and whose liege (`liege`) is a ruler (`is_ruler`) with at least 100 gold (`gold`). Then let `banquet.0001` happen only to characters for whom the new trigger holds, by adding it to that event's trigger and keeping what is there. Change nothing else in the mod.

- `conditions-as-asked`: Does the trigger hold exactly for an adult not at war whose liege is a ruler with at least 100 gold, and does banquet.0001 now need the trigger as well as what its trigger held before?
- `scope-as-asked`: Are being a ruler and the 100 gold tested on the liege, and being an adult and not at war on the character?
- `nothing-unasked`: Is banquet.0001 otherwise unchanged, are the mod's other files unchanged, and does the result add nothing else that changes the game?
