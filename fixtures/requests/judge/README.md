# Cases of the judge

Hand-made results that hold what the judge of the scored authoring test is given, each for a case
a real run found the judge getting wrong, so that the cause cannot come back unnoticed
([tools/scored-run/README.md](../../../tools/scored-run/README.md#the-judge)). They are for the
tests only (`judge.test.ts`), never shown to a session and never graded by hand: the owner's
calibration sheets are in [../calibration/](../calibration/README.md).

Each folder is the files a result writes over its request's base mod
(`fixtures/requests/bases/`), in pychivalry's format, as `examples/` holds them.

## `trigger-loyal-realm-popular-opinion`

**Hand-made, labelled.** The logic every one of the five `trigger-loyal-realm` results of the
expert requests' development run wrote (2026-11-25, `records/scored/authoring-expert-run-1.json`):

```text
authoring_loyal_realm_trigger = {
	any_sub_realm_county = {
		count >= 3
		county_control >= 50
		popular_opinion >= 20
	}
}
```

The five results differ only in their comments. The judge of that run (Fable 5.2, given the
request, its questions and the result, and nothing from the game) answered "conditions-as-asked"
yes for two of them, cannot-tell for one and no for two, each time saying from its own memory that
the county's opinion of its holder is the trigger `county_opinion` and that `popular_opinion` is
not a trigger. In game 1.21.0.3 it is the other way round: the spec package's trigger
`popular_opinion` is the game's own "Compares the county's current opinion of its holder", in the
scope `landed_title`, and it lists `county_opinion` as removed from the triggers in 1.21.0.3; the
base game compares `popular_opinion` in 206 lines of 57 script files and never writes
`county_opinion` in a script file, and it writes the same shape inside `any_sub_realm_county`,
beside `county_control` (`events/story_cycles/story_cycle_conqueror_events.txt`, lines 329 to
332). The checker reports nothing in it; the
request's first draft, which writes `county_opinion`, draws `names/unknown-trigger`
(`../drafts/trigger-loyal-realm/`). The result was right, the expectation was right, and the judge
was wrong: it took a keyword's existence and meaning from its memory of an earlier version.

Since version 2 of the judge's prompt the judge is given what pychivalry's checker reports in the
result over the installed game and the game's own description of every trigger, effect, iterator
and link the result writes, and takes names from them, never from memory. `judge.test.ts` holds
what the judge is given for this case, word for word, and for its first draft: the checker's
report (nothing here; `names/unknown-trigger` on `county_opinion` there) and the keyword lines
(`popular_opinion`, a trigger of `landed_title` with the game's own description, here;
`county_opinion`, not a trigger in 1.21.0.3, there). Whether a model then answers yes is the
calibration's and the runs' to measure; no test can make it.
