# Reference: release 2.3.0

Release 2.3.0 is the last version of the old code. It lives unchanged in
[`legacy/`](../../legacy/) and still builds from inside that folder. It is published as the
`ck3-language-support` extension.

## What it is used for

1. **The behaviour to match.** It is run on the current game to record baselines
   (`records/baseline-2.3.0/`). The rebuild must stay within a stated tolerance of its speed and
   reach at least its results.
2. **Test data.** Its tests, fixtures and records are carried over by the step that owns each
   behaviour. The table is in [PLAN.md](../PLAN.md#what-is-carried-over-from-230).
3. **Lessons.** The mistakes that cost it false findings or time are listed in
   [MVP.md](../MVP.md#lessons-from-230); the rebuild has a test for each.

No code is copied from it. Reading it for how it solved a problem is expected.

## Where things are

| What | Where in `legacy/` |
| --- | --- |
| The engine | `packages/engine/` |
| The tables it kept in code, which move into the spec package | `packages/engine/src/check/` (`structural.ts`, `contexts.ts`, `scope-types.ts`) and `packages/engine/src/index/` (`indexer.ts`, `call-graph.ts`) |
| Acceptance records | `packages/engine/test/acceptance/` |
| Real-mod records and the classification rules | `packages/engine/test/corpus/real-mods/` |
| The plug-in catalogue: 85 codes (1 error, 10 warnings, 63 information, 11 hints) | `data/diagnostics.yaml` |
| The extension and its tests | `vscode-extension/` |
| Its documents | `Documentation/` |

## Facts worth keeping

- Its records were made on game 1.20.0.3 files and cannot be reproduced on 1.21. New baselines
  come from running it on the current game.
- It could judge the scope of 93,665 of 561,077 keyword uses in the base game, about 17%.
- On the five-mod corpus all 108 of its errors were real defects.
- Its base-game record shows 1 parse error and 14 check errors that were never classified.
- On game 1.21.0.3 its base-game script runs out of memory under Node's default heap limit.

## When it goes

`legacy/` is deleted at build step 13, when the new code meets the definition of done. After
that the reference for anything not rebuilt is the tag `v2.3.0` in this repository's history.
