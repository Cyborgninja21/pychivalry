# The content requests

The fixed list of content requests of the scored authoring test (docs/PLAN.md items 9.4 and
9.5; [tools/scored-run/README.md](../../tools/scored-run/README.md#the-scored-authoring-test)).
Each request asks for new content of one of the four types the authoring skill writes: events,
decisions, scripted effects and scripted triggers. A test session is given one request, word for
word, in a fresh copy of the request's base mod, and what it leaves is graded three ways: by
pychivalry's checker (validity), by the request's expectations, checked in code, and by a judge
on the request's judged dimensions (the match to the request).

```text
fixtures/requests/
  requests.json   the requests: each with its id, type, difficulty, base, text, the names it
                  relies on, its expectations and its judged dimensions
  bases/          the mods a trial starts as: empty/ (a descriptor only), banquet/ (an event,
                  a scripted effect, a scripted trigger and their localization) and granary/
                  (an event, three scripted effects, two scripted triggers and localization)
  examples/       one correct result per request, for the tests only; never shown to a session
  drafts/         for each expert request, a first draft with the mistake the request invites,
                  and drafts.json, what fails each; for the tests only, never shown to anyone
  calibration/    ten hand-made results and a sheet for grading them by hand, for the judge's
                  calibration (docs/guide/judge-calibration.md); never shown to a session
    run-2/        twelve real results of the second scored run, trial 1 of each request, and
                  their sheet: each the trial's mod, its skills folder taken out
    expert/       twenty-four hand-made results of the expert requests, two of each, and their
                  sheet: the third, graded last, before the release run
  judge/          hand-made, labelled cases of what the judge is given, each from a case a run
                  found it getting wrong; for the tests only (judge/README.md)
```

Nothing here is copied from the game or from a published mod. The real results of
`calibration/run-2/` were written by test sessions over the base game, using its names as the
requests ask; they hold no file of the game's. The script and localization files
of `bases/` and `examples/` are in pychivalry's format (Windows line breaks, the byte-order mark,
the formatter's layout), and `.gitattributes` keeps their bytes exact.

## The requests

Twenty-four, six of each type: one easy, one medium and one hard, and three expert. An easy
request asks for one record whose every name it gives; a medium one adds conditions, branches or
a second record; a hard one spans several folders, follows references between records, or builds
on a mod that already has content and must leave the rest of it alone.

The **expert** requests were added after the second scored authoring run, which was at the
ceiling on every measure of the first twelve (docs/decisions.md, decision 131). Each sets a trap a
first draft is likely to fall into, of a kind that matters to a modder and that the game files
ground: a name the game renamed in 1.21.0.3 (`county_opinion`, `house_power`) or never had
(`is_at_peace`, `has_spouse`, `release_prisoner`), described in words so that only a lookup finds
the right one; a scope a list leads into (a county of the realm, a member of a house, a sibling of
the heir), where an effect or a condition of the wrong scope is an error; a saved scope passed from
one event to another; a definition of the base that the request only describes, to find and use
instead of writing again; a definition changed in place, the file's other definitions left byte
for byte; a new events file of the base's namespace, which must declare it again. Four of them,
one of each type, build on the mod `granary`. Results are read with them and
without them (`task scored:targets`). Eight of the twelve set a trap the checker itself catches,
so that a first draft that falls into it draws an error or a warning and needs a round of repair;
the other four set one only the expectations in code catch.

| Id | Type | Difficulty | Base | What it asks for |
| --- | --- | --- | --- | --- |
| `event-merchant-debt` | event | easy | empty | A character event with two options, 100 gold or 50 prestige, and its localization |
| `event-sleepless-night` | event | medium | empty | A character event for an adult, free, stressed character, three options changing stress, gold, piety and prestige, the third shown only with 100 prestige |
| `event-letter-from-spouse` | event | hard | empty | Two events: the first through the on-action `yearly_playable_pulse` for a married ruler, firing the second 3 days later, whose option rewards the spouse |
| `decision-give-alms` | decision | easy | empty | A decision for rulers with 100 gold, taking the gold for 50 piety |
| `decision-night-vigil` | decision | medium | empty | A decision for adults at peace with a cooldown and an AI weight, firing an event it also writes |
| `decision-hold-banquet` | decision | hard | banquet | A decision built on the mod's scripted trigger, scripted effect and event, changing none of the mod's files |
| `effect-reward` | scripted effect | easy | empty | 50 gold and 25 prestige |
| `effect-war-chest` | scripted effect | medium | empty | Gold at war, prestige in peace (`if` and `else`), stress either way |
| `effect-children-gift` | scripted effect | hard | empty | Gold for each adult child (`every_child`), prestige for the parent, and a second effect that runs the first |
| `trigger-can-host` | scripted trigger | easy | empty | An adult ruler with 50 gold |
| `trigger-family-ready` | scripted trigger | medium | empty | Married or the parent of an adult child (`any_child`), and not imprisoned |
| `trigger-banquet-guest` | scripted trigger | hard | banquet | A trigger tested partly on the liege, then added to the mod's event's trigger, keeping what is there |
| `event-granary-inspection` | event | expert | granary | A second event of the base's namespace in a new file (which must declare it again), running the base's vassal effect, found from its description, on each adult vassal; the base's event changed in place to fire it |
| `event-envoy-chain` | event | expert | empty | A scripted trigger, a scripted effect and two events that use each other: a courtier saved in the first event, and the effect run on that saved courtier in the second, not on the character |
| `event-county-unrest` | event | expert | empty | A county of the sub-realm picked and saved; its control and its people's opinion changed in its own scope, the opinion's trigger and effect described in words (1.21.0.3 renamed them) |
| `decision-fund-granaries` | decision | expert | granary | A decision built on the base's trigger and two effects, which the request only describes: found with the tools, not guessed or written again |
| `decision-pardon-prisoners` | decision | expert | empty | Prisoners set free in an iterator, at peace: being at peace and setting free described in words, where the names that read well do not exist |
| `decision-house-feast` | decision | expert | empty | A house's power score (renamed in 1.21.0.3) and its members, both in the house's scope; the gold and the event for the character; the event written too |
| `effect-realm-relief` | scripted effect | expert | empty | Counties of the sub-realm changed in their own scope, gold to each county's holder (its link not named), prestige once from the ruler |
| `effect-granary-gift-edit` | scripted effect | expert | granary | One of the base's three scripted effects changed in place, by the vassal's opinion of their liege; the other two and every other file left byte for byte |
| `effect-heir-household` | scripted effect | expert | empty | The heir's own siblings, reached from the heir, not the ruler's; the stress lowered for the ruler either way |
| `trigger-loyal-realm` | scripted trigger | expert | empty | At least 3 counties of the sub-realm meeting two conditions together, one of them the county's opinion of its holder (renamed in 1.21.0.3) |
| `trigger-granary-patron` | scripted trigger | expert | granary | The base's two triggers, which the request only describes, one tested on the character and one on at least two vassals |
| `trigger-settled-ruler` | scripted trigger | expert | empty | At peace, married and with adult children, said in words where the names that read well do not exist; the heir tested in its own scope |

### Retired requests

`retired` in `requests.json` lists the ids taken out of the list, with why; no request may take
one again (a record names a request by its id).

| Id | Replaced by | Why |
| --- | --- | --- |
| `decision-hold-feast` | `decision-hold-banquet` | Its base, `feast`, defined the event `feast.0001`, an id the base game defines too (`events/activities/feast_activity/feast_events.txt`): `definitions/clash`, an error in every result, which the request forbade fixing. Found by the first scored authoring run (2026-11-24), whose 5 trials of it each have that error |
| `trigger-feast-guest` | `trigger-banquet-guest` | The same base and the same clash, in the event the request asked to change |

## What each request holds

The format is stated field by field in `tools/src/scored-run/requests.ts`, which reads it:

- **`id`**: stable, lower-case words joined by hyphens. A record names a request by it, so an id
  is never changed or given to another request.
- **`request`**: the text the session is given. Every name it writes between backticks is either
  a name it relies on, a name or key the result must define, or a folder the result writes into.
- **`relies_on`**: each name of the game or of the base mod the request names: a name of a bucket
  of the spec package (an effect, a trigger, a link, an on-action), an iterator (a prefix of the
  package before one of its lists), a field of a folder's records and a value the base game
  writes in it, or a definition of the base mod. A name the request describes in words and does
  not write, so that a session must find it with the tools, says `unnamed: true`; it is proved to
  exist like any other, and a test holds it absent from the text.
- **`expect`**: what a correct result must contain, checked in code, each met or not on its own:
  a new file in a folder; a top-level `key = value` (an event namespace); a name defined in a
  database; a field written directly in a record, with a value or a number of times; a name used
  inside a record; a name used there that the mod or the base game defines in a given database
  (a reference that resolves); an English localization key; a file of the base left byte for
  byte. A name used may also be reached `through` records of the mod in a database that the
  record uses, one after another: `event-letter-from-spouse` accepts its event in an on-action of
  the mod that `yearly_playable_pulse` fires, the way the game's own
  `common/on_action/_on_actions.info` tells a mod to append to one of the game's on-actions and
  the way the base game hooks its own content into that on-action. Since the expert requests, a
  name used may be required `within` a block written with a given key (an iterator, a link, a
  saved scope such as `scope:envoy`, a field such as `effect`), at any depth: how code tells that
  an effect or a condition was written in the scope the request names. A definition may be
  required exactly `count` times (`1`: changed in place, not defined a second time beside the
  base's), and a definition of the base `kept`, its text byte for byte, for a file the request
  changes elsewhere.
- **`judged`**: the dimensions the judge answers for this request, each with the question it is
  asked. The dimensions are one closed set, `dimensions` at the top of the file, shared by every
  request so that the judge's agreement with hand grading can be measured per dimension:
  `effects-as-asked`, `conditions-as-asked`, `scope-as-asked`, `text-as-asked` and
  `nothing-unasked`. The judge answers each `yes`, `no` or `cannot-tell`.

What a check of the result cannot say in code, such as whether 100 gold went to the right
character or whether the texts tell the story asked for, is left to the judged dimensions.

## What the tests hold

`tools/src/scored-run/requests.test.ts`, in public CI, with no game, model or network:

- the list is well formed, and covers the four types with one easy, one medium and one hard
  request each and three expert, the expert ones after the first twelve;
- **every name a request relies on exists in the game as the spec package states it** (a bucket's
  name, an iterator over one of its lists, a schema field and a value the base game writes in
  it), or is defined by the request's base mod as the index reads it; the run checks the same
  before it starts any session, and refuses to start if one is missing;
- every name between backticks in a request's text is relied on, expected or a folder, and each
  relied-on or expected name is in the text, but for an unnamed one, which is nowhere in it; a
  block an expectation names with `within` is a name relied on, a field of the record, or a scope
  the text asks to save by name; a definition `kept` is one the base is relied on for;
- every field an expectation names is a field the spec package gives that folder, and every
  dimension of the set is asked by some request;
- each base mod and each example result is in pychivalry's format, and the checker reports
  nothing on either, hints included (over an empty base game: the requests rely on no name of
  the base game's own files). Since decision 160 every option of an example's events with
  several options has an AI weight, `ai_chance = { base = 50 }` after its `name`, the same for
  each option of an event: six examples gained one (`event-merchant-debt`,
  `event-sleepless-night`, `event-letter-from-spouse`, `event-granary-inspection`,
  `event-envoy-chain`, `event-county-unrest`), and no test leaves a code out any more. Over the
  installed game only the run can check a base: it refuses to start any
  test session while the checker finds an error or a warning in a base it would use, as it would
  have for `feast` (a name of the base the game defines too);
- **every request can be met**: its example result meets every one of its expectations;
- **each expert request's first draft fails** the code-checked side for exactly the reason
  `drafts/drafts.json` gives: the errors and warnings the checker reports on it, by code, and the
  expectations it does not meet, with their problems. Eight of the twelve draw an error or a
  warning.

`tools/src/scored-run/repair.test.ts` plays the authoring skill's documented steps on those eight
drafts, with no model: the built agent server, started as a trial's configuration starts it,
reports exactly those errors and warnings to `check` at warning and above, and none once the
draft is repaired (its example written over it). Whether a model makes the repair is what only a
real run shows.

The examples, the drafts, the base `granary` and the third calibration sheet were also checked
over the installed game 1.21.0.3 when they were added: every example, every result of the sheet
and the base have no finding at all, and each draft draws the same errors and warnings as over an
empty base game. The run's own guard passes the three bases.

`tools/src/scored-run/expectations.test.ts` breaks the examples one way at a time and shows each
kind of expectation failing, with its reason, `within`, `count` and `kept` among them.

## Adding a request

Give it a new id, its type, difficulty and base, its text, the names it relies on, its
expectations and its judged questions; write its example under `examples/<id>/`, in the format;
run the tests. What a session and the judge are given, a request's text and its judged
questions, is never edited in place once a record names it: the request is retired and replaced
under a new id. An expectation that game evidence shows to be wrong (too strict or too lenient)
is corrected in place, the decision log says so, and the record's `requests_sha256` says which
list its measures were made on.
