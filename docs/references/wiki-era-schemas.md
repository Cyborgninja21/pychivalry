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
| Fields flagged as required | 38 |
| Rule codes | 89 |
| Also | Lists of allowed values, snippets, outline rules, field order |

## How they are used now

- **As hints, never as evidence.** A value type or description from these files enters the spec
  package marked as a wiki-era hint, beside what was measured from the game. Where the game
  says otherwise, the game wins.
- **The required flags and rule codes are reviewed, not trusted.** The check inventory of build
  step 4 goes through all 38 flags and 89 codes. Those that still hold on the 1.21 base game
  return as advice: information or a hint, never an error or a warning.
- **The presentation data returns as pychivalry's own.** Outline rules, snippets, field order
  and inline hints come back as a separate data file in this repository, built at step 8. It is
  never used to raise a finding.

## The wiki itself

The CK3 wiki is written by players from observation. It is often right and sometimes behind
the game. pychivalry does not scrape it and takes no vocabulary from it. It is the lowest rank
in the order of trust: useful to explain a thing the game already proves, not to prove it.
