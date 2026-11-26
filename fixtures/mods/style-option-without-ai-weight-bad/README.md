# style-option-without-ai-weight-bad

The fixture pair of `style/option-without-ai-weight` (the family `style`, pychivalry's own
best-practice rules; release 2.3.0's CK3613), with `style-option-without-ai-weight-good`, from
which it differs only in the defect. A shown event with two options, the second with neither
`ai_chance` nor `ai_will_select` (part D4's keywords of the role `ai_weight`); and a shown event
with one option, which the rule does not judge.

A correct tool reports one hint, at the second option of `fixture.0001`, with no fix: how much
the AI should want an option is the author's to say. `expected.json` holds the finding. Its
files are in pychivalry's format; the localization file defines every key the script names.
