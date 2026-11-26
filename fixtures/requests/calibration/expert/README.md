# Hand-made results of the expert requests, for the judge's calibration

**Hand-made, not the work of a test session.** These twenty-four results, two for each of the
twelve expert requests, were written by hand for the judge's calibration (docs/PLAN.md item 9.6)
when the expert requests were added. Every one is in pychivalry's format, has nothing the checker
reports and meets every expectation its request checks in code: the code-checked side cannot tell
them apart. Some are right, and some are wrong on a judged dimension in a way that only reading
what the script does can show (a scope, an amount, a condition); which is which is not written
anywhere, so that the grading is done by reading them. How to grade them and run the calibration:
[the guide](../../../../docs/guide/judge-calibration.md).

It is the third sheet, beside the ten hand-made results of the first twelve requests
([../README.md](../README.md)) and the twelve real results of the second run
([../run-2/README.md](../run-2/README.md)), and the only one on the expert requests. It is graded
after those two, before the release run, as the owner chose (decision 135):
88 answers, and 24 judge test sessions to calibrate it.

Each folder under `results/` is a whole mod as a session would leave it: the request's base mod
(`fixtures/requests/bases/`) with the result's files written into it. The judge is shown exactly
these files, so grade from them alone, the way the judge must.

[grades.json](grades.json) is the sheet, in the format `task scored:calibrate` reads: replace each
`?` with `yes`, `no` or `cannot-tell`.

## Six results changed on 2026-11-25: an AI weight for every option

On the owner's word (docs/decisions.md, decision 160) every option of a shown event with several
options was given an AI weight, so that the hint `style/option-without-ai-weight` finds nothing
here, as the checker's other findings do not. **Six results changed**, those of the three event
requests: `results/event-granary-inspection-1` and `-2` (the two options of `granary.0002`),
`results/event-envoy-chain-1` and `-2` (the two options of `authoring_envoy.0002`), and
`results/event-county-unrest-1` and `-2` (the two options of `authoring_unrest.0001`). Each of
those twelve options gained one line, `ai_chance = { base = 50 }`, after its `name`: the same
weight for each option of an event, so that the AI favours neither. Nothing else in them changed,
no effect, condition, scope or text, and the other eighteen results are as they were (they have
no event with more than one option).

**If you graded any of these six already,** in a copy of [grades.json](grades.json) of your own,
grade their rows again: the files the judge is shown changed. The committed sheet is not changed:
its answers are all still `?`, and `task scored:calibrate` names the sheet by its hash only, not
the results, so no hash had to change.

## The results and their questions

### `results/event-granary-inspection-1`

Request `event-granary-inspection`: The mod in this folder already has the character event `granary.0001` and a scripted effect that thanks a vassal who keeps a granary. Write a second character event (`character_event`), `granary.0002`, in a new file under `events/`, in the mod's own namespace: the character rides out to inspect the granaries. It has two options. The first runs the mod's scripted effect that thanks a vassal on each of the character's vassals (`every_vassal`) who is an adult (`is_adult`): find that effect and use it, do not write what it does again. The second lowers the character's stress by 15 (`add_stress`). Then make the one option of `granary.0001` also fire `granary.0002` 10 days later (`trigger_event`), keeping everything else of `granary.0001` as it is. Write the English localization of the new event in a new file under `localization/english/`: `granary.0002.t`, `granary.0002.desc`, `granary.0002.a` and `granary.0002.b`. Change nothing else in the mod.

- `effects-as-asked`: Does the first option of granary.0002 run the mod's scripted effect that thanks a vassal, and the second lower the character's stress by 15, and does granary.0001's option now also fire granary.0002 10 days later?
- `scope-as-asked`: Is the mod's effect run on each of the character's vassals who is an adult, and is the stress lowered for the character?
- `text-as-asked`: Do the new event's texts tell of the character riding out to inspect the granaries, each option's text fitting what it does?
- `nothing-unasked`: Is granary.0001 otherwise unchanged, are the mod's other files unchanged, and does the result add nothing else that changes the game?

### `results/event-granary-inspection-2`

Request `event-granary-inspection`: The mod in this folder already has the character event `granary.0001` and a scripted effect that thanks a vassal who keeps a granary. Write a second character event (`character_event`), `granary.0002`, in a new file under `events/`, in the mod's own namespace: the character rides out to inspect the granaries. It has two options. The first runs the mod's scripted effect that thanks a vassal on each of the character's vassals (`every_vassal`) who is an adult (`is_adult`): find that effect and use it, do not write what it does again. The second lowers the character's stress by 15 (`add_stress`). Then make the one option of `granary.0001` also fire `granary.0002` 10 days later (`trigger_event`), keeping everything else of `granary.0001` as it is. Write the English localization of the new event in a new file under `localization/english/`: `granary.0002.t`, `granary.0002.desc`, `granary.0002.a` and `granary.0002.b`. Change nothing else in the mod.

- `effects-as-asked`: Does the first option of granary.0002 run the mod's scripted effect that thanks a vassal, and the second lower the character's stress by 15, and does granary.0001's option now also fire granary.0002 10 days later?
- `scope-as-asked`: Is the mod's effect run on each of the character's vassals who is an adult, and is the stress lowered for the character?
- `text-as-asked`: Do the new event's texts tell of the character riding out to inspect the granaries, each option's text fitting what it does?
- `nothing-unasked`: Is granary.0001 otherwise unchanged, are the mod's other files unchanged, and does the result add nothing else that changes the game?

### `results/event-envoy-chain-1`

Request `event-envoy-chain`: Write an envoy's visit as four pieces that use each other. A scripted trigger `authoring_envoy_host_trigger`, in a new file under `common/scripted_triggers/`, holds for a ruler (`is_ruler`) who is an adult (`is_adult`) and not at war (`is_at_war`). A scripted effect `authoring_envoy_gift_effect`, in a new file under `common/scripted_effects/`, gives the character it runs on 30 gold (`add_gold`) and 10 prestige (`add_prestige`). Two character events (`character_event`), in a new file under `events/`, in the namespace `authoring_envoy`. The first, `authoring_envoy.0001`, may happen only to characters for whom `authoring_envoy_host_trigger` holds: an envoy arrives at court. Its one option picks one of the character's courtiers who is an adult (`random_courtier`), saves that courtier as the scope named envoy (`save_scope_as`), and fires `authoring_envoy.0002` for the character 5 days later (`trigger_event`). In `authoring_envoy.0002` the character sends the envoy home: its first option runs `authoring_envoy_gift_effect` on the envoy the first event saved, not on the character; its second gives the character 20 piety (`add_piety`). Write the English localization of both events in a new file under `localization/english/`: `authoring_envoy.0001.t`, `authoring_envoy.0001.desc`, `authoring_envoy.0001.a`, `authoring_envoy.0002.t`, `authoring_envoy.0002.desc`, `authoring_envoy.0002.a` and `authoring_envoy.0002.b`.

- `conditions-as-asked`: Can the first event happen only to characters for whom authoring_envoy_host_trigger holds, and does that trigger hold exactly for an adult ruler not at war?
- `effects-as-asked`: Does the gift effect give 30 gold and 10 prestige, does the first event's option fire the second event 5 days later, and does the second event's second option give 20 piety?
- `scope-as-asked`: Is the courtier the first event saves the one the gift effect runs on in the second event, and is the second event fired for the character, who gets the 20 piety?
- `text-as-asked`: Do the texts tell of an envoy arriving at court and being sent home, each option's text fitting what it does?

### `results/event-envoy-chain-2`

Request `event-envoy-chain`: Write an envoy's visit as four pieces that use each other. A scripted trigger `authoring_envoy_host_trigger`, in a new file under `common/scripted_triggers/`, holds for a ruler (`is_ruler`) who is an adult (`is_adult`) and not at war (`is_at_war`). A scripted effect `authoring_envoy_gift_effect`, in a new file under `common/scripted_effects/`, gives the character it runs on 30 gold (`add_gold`) and 10 prestige (`add_prestige`). Two character events (`character_event`), in a new file under `events/`, in the namespace `authoring_envoy`. The first, `authoring_envoy.0001`, may happen only to characters for whom `authoring_envoy_host_trigger` holds: an envoy arrives at court. Its one option picks one of the character's courtiers who is an adult (`random_courtier`), saves that courtier as the scope named envoy (`save_scope_as`), and fires `authoring_envoy.0002` for the character 5 days later (`trigger_event`). In `authoring_envoy.0002` the character sends the envoy home: its first option runs `authoring_envoy_gift_effect` on the envoy the first event saved, not on the character; its second gives the character 20 piety (`add_piety`). Write the English localization of both events in a new file under `localization/english/`: `authoring_envoy.0001.t`, `authoring_envoy.0001.desc`, `authoring_envoy.0001.a`, `authoring_envoy.0002.t`, `authoring_envoy.0002.desc`, `authoring_envoy.0002.a` and `authoring_envoy.0002.b`.

- `conditions-as-asked`: Can the first event happen only to characters for whom authoring_envoy_host_trigger holds, and does that trigger hold exactly for an adult ruler not at war?
- `effects-as-asked`: Does the gift effect give 30 gold and 10 prestige, does the first event's option fire the second event 5 days later, and does the second event's second option give 20 piety?
- `scope-as-asked`: Is the courtier the first event saves the one the gift effect runs on in the second event, and is the second event fired for the character, who gets the 20 piety?
- `text-as-asked`: Do the texts tell of an envoy arriving at court and being sent home, each option's text fitting what it does?

### `results/event-county-unrest-1`

Request `event-county-unrest`: Write a character event (`character_event`) `authoring_unrest.0001` in a new file under `events/`, in the namespace `authoring_unrest`: unrest in one of the counties of a ruler's realm. It may happen only to a ruler (`is_ruler`) with at least one county in their sub-realm (`any_sub_realm_county`) whose people's opinion of their holder is below -20. When it happens (`immediate`), it picks one such county (`random_sub_realm_county`) and saves it as the scope named unrest_county (`save_scope_as`). The first option raises that county's control by 20 (`change_county_control`) and takes 50 gold from the character (`add_gold`). The second raises the opinion of that county's people of their holder by 10, and takes 25 prestige from the character (`add_prestige`). Write its English localization in a new file under `localization/english/`: `authoring_unrest.0001.t`, `authoring_unrest.0001.desc`, `authoring_unrest.0001.a` and `authoring_unrest.0001.b`.

- `conditions-as-asked`: Can the event happen only to a ruler with a county of their sub-realm whose people's opinion of their holder is below -20, and is the county it picks always one such county?
- `effects-as-asked`: Does the first option raise the county's control by 20 and take 50 gold, and the second raise its people's opinion of their holder by 10 and take 25 prestige?
- `scope-as-asked`: Are the control and the opinion changed on the county the event picked, and the gold and the prestige taken from the character?
- `text-as-asked`: Do the texts tell of unrest in one of the ruler's counties, each option's text fitting what it does?

### `results/event-county-unrest-2`

Request `event-county-unrest`: Write a character event (`character_event`) `authoring_unrest.0001` in a new file under `events/`, in the namespace `authoring_unrest`: unrest in one of the counties of a ruler's realm. It may happen only to a ruler (`is_ruler`) with at least one county in their sub-realm (`any_sub_realm_county`) whose people's opinion of their holder is below -20. When it happens (`immediate`), it picks one such county (`random_sub_realm_county`) and saves it as the scope named unrest_county (`save_scope_as`). The first option raises that county's control by 20 (`change_county_control`) and takes 50 gold from the character (`add_gold`). The second raises the opinion of that county's people of their holder by 10, and takes 25 prestige from the character (`add_prestige`). Write its English localization in a new file under `localization/english/`: `authoring_unrest.0001.t`, `authoring_unrest.0001.desc`, `authoring_unrest.0001.a` and `authoring_unrest.0001.b`.

- `conditions-as-asked`: Can the event happen only to a ruler with a county of their sub-realm whose people's opinion of their holder is below -20, and is the county it picks always one such county?
- `effects-as-asked`: Does the first option raise the county's control by 20 and take 50 gold, and the second raise its people's opinion of their holder by 10 and take 25 prestige?
- `scope-as-asked`: Are the control and the opinion changed on the county the event picked, and the gold and the prestige taken from the character?
- `text-as-asked`: Do the texts tell of unrest in one of the ruler's counties, each option's text fitting what it does?

### `results/decision-fund-granaries-1`

Request `decision-fund-granaries`: The mod in this folder already has a scripted trigger for a ruler with the gold to pay for new granaries, a scripted effect that pays for them, and a scripted effect that rewards a ruler who keeps the granaries full. Write a decision `authoring_fund_granaries_decision` in a new file under `common/decisions/`. It is shown to rulers (`is_ruler`), and can be taken only when the mod's trigger for paying holds. Taking it runs the mod's effect that pays, and then the mod's effect that rewards. Find the mod's own trigger and effects and use them: do not write their conditions or effects again. It can be taken again only 10 years after it was last taken (`cooldown`). Write its English localization in a new file under `localization/english/`: the title `authoring_fund_granaries_decision` and the description `authoring_fund_granaries_decision_desc`. Change none of the mod's files.

- `conditions-as-asked`: Is the decision shown only to rulers, can it be taken only when the mod's trigger for paying for granaries holds, and can it be taken again only 10 years later?
- `effects-as-asked`: Does taking the decision run the mod's effect that pays for granaries and then the mod's effect that rewards, and nothing else?
- `text-as-asked`: Do the title and the description say what the decision is and does?
- `nothing-unasked`: Are the mod's files unchanged, and does the result add nothing beyond the decision and its localization that changes the game?

### `results/decision-fund-granaries-2`

Request `decision-fund-granaries`: The mod in this folder already has a scripted trigger for a ruler with the gold to pay for new granaries, a scripted effect that pays for them, and a scripted effect that rewards a ruler who keeps the granaries full. Write a decision `authoring_fund_granaries_decision` in a new file under `common/decisions/`. It is shown to rulers (`is_ruler`), and can be taken only when the mod's trigger for paying holds. Taking it runs the mod's effect that pays, and then the mod's effect that rewards. Find the mod's own trigger and effects and use them: do not write their conditions or effects again. It can be taken again only 10 years after it was last taken (`cooldown`). Write its English localization in a new file under `localization/english/`: the title `authoring_fund_granaries_decision` and the description `authoring_fund_granaries_decision_desc`. Change none of the mod's files.

- `conditions-as-asked`: Is the decision shown only to rulers, can it be taken only when the mod's trigger for paying for granaries holds, and can it be taken again only 10 years later?
- `effects-as-asked`: Does taking the decision run the mod's effect that pays for granaries and then the mod's effect that rewards, and nothing else?
- `text-as-asked`: Do the title and the description say what the decision is and does?
- `nothing-unasked`: Are the mod's files unchanged, and does the result add nothing beyond the decision and its localization that changes the game?

### `results/decision-pardon-prisoners-1`

Request `decision-pardon-prisoners`: Write a decision `authoring_pardon_decision` in a new file under `common/decisions/`: a ruler pardons their prisoners. It is shown to rulers (`is_ruler`), and can be taken only by a ruler who is at peace and holds at least one prisoner (`any_prisoner`). Taking it takes 25 gold from the ruler (`add_gold`), and then sets free each of the ruler's prisoners (`every_prisoner`) who is an adult (`is_adult`), lowering each freed prisoner's stress by 10 (`add_stress`). It can be taken again only 5 years later (`cooldown`), and the AI takes it with a base weight of 5 (`ai_will_do`). Write its English localization in a new file under `localization/english/`: the title `authoring_pardon_decision` and the description `authoring_pardon_decision_desc`.

- `conditions-as-asked`: Is the decision shown only to rulers, can it be taken only at peace and while the ruler holds at least one prisoner, and can it be taken again only 5 years later?
- `effects-as-asked`: Does taking it take 25 gold, set free each adult prisoner and lower each one's stress by 10, and does the AI weigh it with a base of 5?
- `scope-as-asked`: Is the gold taken from the ruler, once, and are the freeing and the lower stress given to each adult prisoner?
- `text-as-asked`: Do the title and the description say what the decision is and does?

### `results/decision-pardon-prisoners-2`

Request `decision-pardon-prisoners`: Write a decision `authoring_pardon_decision` in a new file under `common/decisions/`: a ruler pardons their prisoners. It is shown to rulers (`is_ruler`), and can be taken only by a ruler who is at peace and holds at least one prisoner (`any_prisoner`). Taking it takes 25 gold from the ruler (`add_gold`), and then sets free each of the ruler's prisoners (`every_prisoner`) who is an adult (`is_adult`), lowering each freed prisoner's stress by 10 (`add_stress`). It can be taken again only 5 years later (`cooldown`), and the AI takes it with a base weight of 5 (`ai_will_do`). Write its English localization in a new file under `localization/english/`: the title `authoring_pardon_decision` and the description `authoring_pardon_decision_desc`.

- `conditions-as-asked`: Is the decision shown only to rulers, can it be taken only at peace and while the ruler holds at least one prisoner, and can it be taken again only 5 years later?
- `effects-as-asked`: Does taking it take 25 gold, set free each adult prisoner and lower each one's stress by 10, and does the AI weigh it with a base of 5?
- `scope-as-asked`: Is the gold taken from the ruler, once, and are the freeing and the lower stress given to each adult prisoner?
- `text-as-asked`: Do the title and the description say what the decision is and does?

### `results/decision-house-feast-1`

Request `decision-house-feast`: Write a decision `authoring_house_feast_decision` in a new file under `common/decisions/`, with the event it fires: a ruler feasts the members of their house. It is shown to rulers (`is_ruler`), and can be taken only when the power score of the character's house (`house`) is at least 50 and the character has at least 75 gold (`gold`). Taking it takes 75 gold from the character (`add_gold`), gives each member of the character's house (`every_house_member`) who is an adult (`is_adult`) 10 prestige (`add_prestige`), and fires for the character, 3 days later (`trigger_event`), the character event (`character_event`) `authoring_house_feast.0001`, which you write in a new file under `events/`, in the namespace `authoring_house_feast`: the feast ends, and the event's one option gives 15 piety (`add_piety`). Write the English localization in a new file under `localization/english/`: `authoring_house_feast_decision`, `authoring_house_feast_decision_desc`, `authoring_house_feast.0001.t`, `authoring_house_feast.0001.desc` and `authoring_house_feast.0001.a`.

- `conditions-as-asked`: Is the decision shown only to rulers, and can it be taken only when the character's house has a power score of at least 50 and the character at least 75 gold?
- `effects-as-asked`: Does taking it take 75 gold, give 10 prestige to each adult member of the house and fire the event 3 days later, and does the event's option give 15 piety?
- `scope-as-asked`: Is the power score tested on the character's house, the prestige given to each adult member of it, and the gold taken from and the event fired for the character?
- `text-as-asked`: Do the decision's texts describe a feast for the house, and do the event's texts tell of the feast ending?

### `results/decision-house-feast-2`

Request `decision-house-feast`: Write a decision `authoring_house_feast_decision` in a new file under `common/decisions/`, with the event it fires: a ruler feasts the members of their house. It is shown to rulers (`is_ruler`), and can be taken only when the power score of the character's house (`house`) is at least 50 and the character has at least 75 gold (`gold`). Taking it takes 75 gold from the character (`add_gold`), gives each member of the character's house (`every_house_member`) who is an adult (`is_adult`) 10 prestige (`add_prestige`), and fires for the character, 3 days later (`trigger_event`), the character event (`character_event`) `authoring_house_feast.0001`, which you write in a new file under `events/`, in the namespace `authoring_house_feast`: the feast ends, and the event's one option gives 15 piety (`add_piety`). Write the English localization in a new file under `localization/english/`: `authoring_house_feast_decision`, `authoring_house_feast_decision_desc`, `authoring_house_feast.0001.t`, `authoring_house_feast.0001.desc` and `authoring_house_feast.0001.a`.

- `conditions-as-asked`: Is the decision shown only to rulers, and can it be taken only when the character's house has a power score of at least 50 and the character at least 75 gold?
- `effects-as-asked`: Does taking it take 75 gold, give 10 prestige to each adult member of the house and fire the event 3 days later, and does the event's option give 15 piety?
- `scope-as-asked`: Is the power score tested on the character's house, the prestige given to each adult member of it, and the gold taken from and the event fired for the character?
- `text-as-asked`: Do the decision's texts describe a feast for the house, and do the event's texts tell of the feast ending?

### `results/effect-realm-relief-1`

Request `effect-realm-relief`: Write a scripted effect `authoring_realm_relief_effect` in a new file under `common/scripted_effects/`, run on a ruler. For each county of the ruler's sub-realm (`every_sub_realm_county`) whose county control is below 50 (`county_control`), it raises that county's control by 10 (`change_county_control`) and gives the character who holds that county 10 gold (`add_gold`). Then, once, it takes 25 prestige from the ruler (`add_prestige`).

- `conditions-as-asked`: Are only the counties of the sub-realm whose county control is below 50 changed?
- `effects-as-asked`: Does the effect raise each such county's control by 10, give 10 gold for each, and take 25 prestige once?
- `scope-as-asked`: Is the control raised on each county, the gold given to that county's holder, and the prestige taken from the ruler, once?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-realm-relief-2`

Request `effect-realm-relief`: Write a scripted effect `authoring_realm_relief_effect` in a new file under `common/scripted_effects/`, run on a ruler. For each county of the ruler's sub-realm (`every_sub_realm_county`) whose county control is below 50 (`county_control`), it raises that county's control by 10 (`change_county_control`) and gives the character who holds that county 10 gold (`add_gold`). Then, once, it takes 25 prestige from the ruler (`add_prestige`).

- `conditions-as-asked`: Are only the counties of the sub-realm whose county control is below 50 changed?
- `effects-as-asked`: Does the effect raise each such county's control by 10, give 10 gold for each, and take 25 prestige once?
- `scope-as-asked`: Is the control raised on each county, the gold given to that county's holder, and the prestige taken from the ruler, once?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-granary-gift-edit-1`

Request `effect-granary-gift-edit`: The mod in this folder already has the scripted effect `granary_vassal_gift_effect`, which gives the vassal it runs on 20 gold, in a file with two other scripted effects. Change it in place, in that file: it should give the 20 gold (`add_gold`) only when the vassal's opinion of their liege (`opinion`, with the vassal's `liege` as its target) is at least 30, and otherwise give the vassal 10 prestige (`add_prestige`), written with `if` and `else`. Leave the file's other scripted effects exactly as they are, and change none of the mod's other files.

- `conditions-as-asked`: Does the effect give the gold only when the vassal's opinion of their liege is at least 30, and the prestige otherwise?
- `effects-as-asked`: Does it give 20 gold or 10 prestige as the request says, and nothing else?
- `scope-as-asked`: Is the opinion tested as the vassal's opinion of their liege, not the liege's opinion of the vassal, and are the gold and the prestige given to the vassal?
- `nothing-unasked`: Are the file's other scripted effects and the mod's other files unchanged, and does the result add nothing else that changes the game?

### `results/effect-granary-gift-edit-2`

Request `effect-granary-gift-edit`: The mod in this folder already has the scripted effect `granary_vassal_gift_effect`, which gives the vassal it runs on 20 gold, in a file with two other scripted effects. Change it in place, in that file: it should give the 20 gold (`add_gold`) only when the vassal's opinion of their liege (`opinion`, with the vassal's `liege` as its target) is at least 30, and otherwise give the vassal 10 prestige (`add_prestige`), written with `if` and `else`. Leave the file's other scripted effects exactly as they are, and change none of the mod's other files.

- `conditions-as-asked`: Does the effect give the gold only when the vassal's opinion of their liege is at least 30, and the prestige otherwise?
- `effects-as-asked`: Does it give 20 gold or 10 prestige as the request says, and nothing else?
- `scope-as-asked`: Is the opinion tested as the vassal's opinion of their liege, not the liege's opinion of the vassal, and are the gold and the prestige given to the vassal?
- `nothing-unasked`: Are the file's other scripted effects and the mod's other files unchanged, and does the result add nothing else that changes the game?

### `results/effect-heir-household-1`

Request `effect-heir-household`: Write a scripted effect `authoring_heir_household_effect` in a new file under `common/scripted_effects/`, for a ruler. If the ruler has a primary heir (`primary_heir`), it gives that heir 50 gold (`add_gold`) and gives each of the heir's own siblings (`every_sibling`) who is an adult (`is_adult`) 10 prestige (`add_prestige`): the siblings of the heir, reached from the heir, not the ruler's own siblings. Whether or not there is an heir, it then lowers the ruler's stress by 10 (`add_stress`).

- `conditions-as-asked`: Are the gold and the prestige given only when the ruler has a primary heir, the prestige only to siblings who are adults, and is the stress lowered whether or not there is an heir?
- `effects-as-asked`: Does the effect give 50 gold, 10 prestige to each such sibling, and lower stress by 10?
- `scope-as-asked`: Is the gold given to the heir, the prestige to each adult sibling of the heir, and the lower stress to the ruler?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/effect-heir-household-2`

Request `effect-heir-household`: Write a scripted effect `authoring_heir_household_effect` in a new file under `common/scripted_effects/`, for a ruler. If the ruler has a primary heir (`primary_heir`), it gives that heir 50 gold (`add_gold`) and gives each of the heir's own siblings (`every_sibling`) who is an adult (`is_adult`) 10 prestige (`add_prestige`): the siblings of the heir, reached from the heir, not the ruler's own siblings. Whether or not there is an heir, it then lowers the ruler's stress by 10 (`add_stress`).

- `conditions-as-asked`: Are the gold and the prestige given only when the ruler has a primary heir, the prestige only to siblings who are adults, and is the stress lowered whether or not there is an heir?
- `effects-as-asked`: Does the effect give 50 gold, 10 prestige to each such sibling, and lower stress by 10?
- `scope-as-asked`: Is the gold given to the heir, the prestige to each adult sibling of the heir, and the lower stress to the ruler?
- `nothing-unasked`: Does the effect do nothing else, and does the result add nothing else that changes the game?

### `results/trigger-loyal-realm-1`

Request `trigger-loyal-realm`: Write a scripted trigger `authoring_loyal_realm_trigger` in a new file under `common/scripted_triggers/`, for a ruler. It holds when at least 3 counties of the ruler's sub-realm (`any_sub_realm_county`) each have a county control of at least 50 (`county_control`) and people whose opinion of their holder is at least 20, the same 3 counties meeting both.

- `conditions-as-asked`: Does the trigger hold exactly when at least 3 counties of the ruler's sub-realm each have county control of at least 50 and an opinion of their holder of at least 20, the same counties meeting both?
- `scope-as-asked`: Are the county control and the opinion tested on the counties, not on the ruler?
- `nothing-unasked`: Does the result add nothing else that changes the game?

### `results/trigger-loyal-realm-2`

Request `trigger-loyal-realm`: Write a scripted trigger `authoring_loyal_realm_trigger` in a new file under `common/scripted_triggers/`, for a ruler. It holds when at least 3 counties of the ruler's sub-realm (`any_sub_realm_county`) each have a county control of at least 50 (`county_control`) and people whose opinion of their holder is at least 20, the same 3 counties meeting both.

- `conditions-as-asked`: Does the trigger hold exactly when at least 3 counties of the ruler's sub-realm each have county control of at least 50 and an opinion of their holder of at least 20, the same counties meeting both?
- `scope-as-asked`: Are the county control and the opinion tested on the counties, not on the ruler?
- `nothing-unasked`: Does the result add nothing else that changes the game?

### `results/trigger-granary-patron-1`

Request `trigger-granary-patron`: The mod in this folder already has two scripted triggers: one for a ruler with the gold to pay for new granaries, and one for a ruler free to ride out to see them. Write a scripted trigger `authoring_granary_patron_trigger` in a new file under `common/scripted_triggers/`, for a character. It holds when the mod's trigger for a ruler free to ride out holds for the character, and the mod's trigger for paying holds for at least two of the character's vassals (`any_vassal`). Find the two triggers and use them: do not write their conditions again. Change none of the mod's files.

- `conditions-as-asked`: Does the trigger hold exactly when the mod's trigger for riding out holds for the character and the mod's trigger for paying holds for at least two of its vassals?
- `scope-as-asked`: Is the trigger for riding out tested on the character, and the one for paying on the vassals?
- `nothing-unasked`: Are the mod's files unchanged, and does the result add nothing else that changes the game?

### `results/trigger-granary-patron-2`

Request `trigger-granary-patron`: The mod in this folder already has two scripted triggers: one for a ruler with the gold to pay for new granaries, and one for a ruler free to ride out to see them. Write a scripted trigger `authoring_granary_patron_trigger` in a new file under `common/scripted_triggers/`, for a character. It holds when the mod's trigger for a ruler free to ride out holds for the character, and the mod's trigger for paying holds for at least two of the character's vassals (`any_vassal`). Find the two triggers and use them: do not write their conditions again. Change none of the mod's files.

- `conditions-as-asked`: Does the trigger hold exactly when the mod's trigger for riding out holds for the character and the mod's trigger for paying holds for at least two of its vassals?
- `scope-as-asked`: Is the trigger for riding out tested on the character, and the one for paying on the vassals?
- `nothing-unasked`: Are the mod's files unchanged, and does the result add nothing else that changes the game?

### `results/trigger-settled-ruler-1`

Request `trigger-settled-ruler`: Write a scripted trigger `authoring_settled_ruler_trigger` in a new file under `common/scripted_triggers/`, for a ruler. It holds when the ruler is at peace, is married, and has at least two children who are adults, and the ruler's primary heir (`primary_heir`) is an adult (`is_adult`) who is not imprisoned (`is_imprisoned`).

- `conditions-as-asked`: Does the trigger hold exactly when the ruler is at peace, is married and has at least two adult children, and the primary heir is an adult who is not imprisoned?
- `scope-as-asked`: Are being at peace and being married tested on the ruler, being an adult on the children, and being an adult and not imprisoned on the heir?

### `results/trigger-settled-ruler-2`

Request `trigger-settled-ruler`: Write a scripted trigger `authoring_settled_ruler_trigger` in a new file under `common/scripted_triggers/`, for a ruler. It holds when the ruler is at peace, is married, and has at least two children who are adults, and the ruler's primary heir (`primary_heir`) is an adult (`is_adult`) who is not imprisoned (`is_imprisoned`).

- `conditions-as-asked`: Does the trigger hold exactly when the ruler is at peace, is married and has at least two adult children, and the primary heir is an adult who is not imprisoned?
- `scope-as-asked`: Are being at peace and being married tested on the ruler, being an adult on the children, and being an adult and not imprisoned on the heir?
