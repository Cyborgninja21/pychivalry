# Reference: the pre-2.0 schema files and the wiki

Before release 2.0, pychivalry described the game in 32 schema files written by hand from the
CK3 wiki. Release 2.x replaced them with the spec package and no longer shipped them. The spec
derivation keeps its own copy and uses it as a source of hints.

## What they held

| What | How much |
| --- | --- |
| Schema files | 32 |
| Fields with a value type | 594 |
| Field descriptions | 737 |
| Required-field flags (`required:`) | 38: 32 say a field is required, 6 say it is not |
| Rule entries (`diagnostic:`) | 89, naming 87 distinct codes (`CK3760` and `CK3872` are each used twice) |
| Other codes | 6 for counts and invalid values (`count_diagnostic`, `invalid_diagnostic`); 8 declared in a file's header and used by no rule |
| Also | Lists of allowed values, snippets, outline rules, field order |

Counted by build step 4, item 4.1, on 2026-11-21.

## How they are used now

- **As hints, never as evidence.** A value type or description from these files enters the spec
  package marked as a wiki-era hint, beside what was measured from the game. Where the game
  says otherwise, the game wins.
- **The required flags and rule codes are reviewed, not trusted.** The check inventory of build
  step 4 goes through all 38 flags and 89 codes. Those that still hold on the 1.21 base game
  return as advice: information or a hint, never an error or a warning.

## What the review found (build step 4, item 4.1)

Each flag and rule was counted on the 1.21.0.3 base game, one by one, in
[checks.md](../checks.md#the-pre-20-rules-one-by-one). A rule holds when it applies to at least
10 base-game records and fires on none (a criterion awaiting the owner's sign-off).

| | Return as advice | Covered by a check with game evidence | Dropped |
| --- | ---: | ---: | ---: |
| 38 required-field flags | 17 | 0 | 21 |
| 89 rule entries | 28 | 9 | 52 |
| 14 other codes | 5 | 0 | 9 |

- **None of the 32 "required" flags is a requirement the game states.** None of the fields has a
  catalogue message, and none is among the 3 fields the spec marks required. The 17 that hold
  return through one advice check, "usually present", fed by how often the base game sets each
  field.
- **Many are out of date.** Folders and fields were renamed or moved since the files were
  written: `common/religion/doctrines` holds no file in 1.21, buildings write `cost_gold`,
  struggles `phase_list`, decisions mostly `ai_check_interval_by_tier`; the files' lists of event
  themes (33 names against the game's 201), portrait animations (17 against 330) and event types
  (6, without `activity_event`) are far behind the game.
- **Many describe what the base game itself does.** `type` and `title` are absent from 1,109 and
  1,985 base-game events, `every_` iterators without `limit` number 3,425, and `liege = root` is
  written 2,125 times by twelve links alone.
- **The presentation data returns as pychivalry's own.** Outline rules, snippets, field order
  and inline hints come back as a separate data file in this repository, built at step 8. It is
  never used to raise a finding.

## The wiki itself

The CK3 wiki is written by players from observation. It is often right and sometimes behind
the game. pychivalry does not scrape it and takes no vocabulary from it. It is the lowest rank
in the order of trust: useful to explain a thing the game already proves, not to prove it.
