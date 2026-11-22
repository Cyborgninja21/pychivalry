# Reference: community tools

Two community projects check CK3 script: ck3-tiger, a validator, and the CWTools rule files, a
set of rules for the CWTools editor extension. Both were written by people who know the game
well.

## How they may be used

- They may be evaluated, and a rule or its logic taken where it proves true against the game.
- Neither is a source of vocabulary, and neither is the basis for a finding. A rule taken from
  one enters the check inventory with game evidence of its own, or as advice.
- pychivalry does not depend on either, and does not run either.

## Their licences

Read on 2026-11-21 from each project's own repository, through the GitHub API and the licence
file itself. This is a reading of the licences for the owner, not legal advice.

| | ck3-tiger | The CWTools CK3 rule files |
| --- | --- | --- |
| Repository | <https://github.com/amtep/tiger> (the address `amtep/ck3-tiger` now leads there) | <https://github.com/cwtools/cwtools-ck3-config> |
| Licence | GNU General Public License v3.0, in `LICENSE` | MIT, in `LICENSE` ("Copyright (c) 2020 cwtools") |
| State on 2026-11-21 | Latest release v1.19.0 (2026-06-06); still worked on | Last commit 2023-04-16, three years of game versions ago |
| What may come into this Apache-2.0 repository | **Nothing**: no code, no tables, no text. GPL-3.0 work copied or translated into pychivalry would make the whole GPL-3.0, which Apache-2.0 does not allow. An idea for a rule may be noted and then built from the game's own evidence alone, never from tiger's code | Code or data may be copied if the copyright and permission notice is kept, as MIT allows. By pychivalry's own rules it is still not a source of vocabulary or of a finding; a rule's logic is taken only once it is proved against the game |

## What was evaluated (build step 4, item 4.1)

Open question 9 of [MVP.md](../MVP.md#open-questions). Nothing was adopted: each candidate is
listed for evaluation, with the game evidence it would need. ck3-tiger was judged from its own
description of what it checks; its code was not read. The CWTools rules were judged from their
`config/*.cwt` files.

| Tool | Candidate | What it claims | Game evidence it would need | Outcome |
| --- | --- | --- | --- | --- |
| ck3-tiger v1.19.0 | History dates | A history character's spouse, employer or liege exists and is alive on the date of the entry | The catalogue holds `invalid_character_not_in_history_or_not_born_yet` ("Invalid Character not in history or not born yet"); a planted-defect capture (PLAN.md item 11.1) would tie it to the condition | Candidate |
| ck3-tiger v1.19.0 | Title history lieges | A title's history names a liege title that exists | The catalogue holds `title_history_refers_to_unknown_liege_title_X_X`; it would be a case of `references/unknown-key` once the value types cover `history/titles` | Candidate |
| ck3-tiger v1.19.0 | Localization per language | A key defined in one language the mod supports is defined in the others | What the game prints when a loaded language lacks a key; unknown until a capture is made in another language | Candidate |
| ck3-tiger v1.19.0 | Ancestry | No one is their own ancestor | None found in the catalogue | Candidate, no evidence in sight |
| ck3-tiger v1.19.0 | `rivers.png` | The river map is valid | Map data, outside the MVP | Not taken |
| CWTools (2023-04-16) | Cardinality | `## cardinality = 1..1` marks a field required, `0..1` at most once | A required field needs the game's message, as the spec's three have. Without one it is at most advice, which `fields/usually-present` gives from the base game's own frequency | Candidate, as advice only |
| CWTools (2023-04-16) | Record scopes | `push_scope` names the scope a record's body runs in | Agreement with the scopes format 5 reads from the `.info` files and the documentation output | Candidate, a hint where they agree |
| CWTools (2023-04-16) | Scope links | `scope_links.cwt` lists links | None: links come only from the spec. A disagreement is a question for the spec work | Not taken |

The inventory is [checks.md](../checks.md#ck3-tiger-and-the-cwtools-rule-files).

## What to record here when they are evaluated again

For each rule considered: the tool and its version, what the rule claims, the test against the
1.21 base game, and the outcome (taken with evidence, taken as advice, or not taken, with the
reason).
