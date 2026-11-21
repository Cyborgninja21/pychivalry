# Reference: the spec package

The spec package is the one source of CK3 vocabulary in pychivalry. It is derived from the game
by a separate, private project, `pdx-parser-re`, and committed here as a built file with its
checksum ([spec/README.md](../../spec/README.md)). The core holds no keyword lists of its own.

## What is committed today

The package for game 1.20.0.2, in format 4, as a stand-in until the 1.21 package arrives. Facts
about it, checked 2026-11-21:

| Part | What it holds |
| --- | --- |
| Names | 1,447 triggers, 1,007 effects, 312 links, 377 lists, 217 on-actions, 609 modifiers |
| Descriptions | Free text for most triggers, effects, links and lists; none for modifiers or on-actions; no structured argument types |
| Scope data | Which scopes a trigger or effect is valid in, from the game's own documentation output. 55 triggers and 99 effects have no entry; a further 157 and 320 declare no requirement |
| Record schemas | A field list for 185 of 227 game folders: 18,234 fields, each with a kind and no value type. 3 fields are marked required. Nothing for `gui`, `gfx` or `localization` |
| Error catalogue | 1,968 message texts from the executable: text only, with no severity or condition, and including strings that are not game errors |

## What format 5 adds

The 1.21 derivation keeps all of the above and adds twelve things, listed with their sources in
[MVP.md](../MVP.md#what-the-121-spec-adds): the tables release 2.3.0 kept in code, a value type
per field, observed values, how often each field is set, the wiki descriptions marked as such,
which fields hold a localization key, a cleaned error catalogue, a structured "what it takes"
for triggers and effects, where each modifier may be used, Paradox's documentation files, the
data types usable in localization and GUI, and a measured GUI vocabulary.

Every fact in format 5 records which source it came from, so a check can tell game evidence
from a hint.

## What no derivation can supply

- Scope data for the triggers and effects the game does not document.
- Descriptions for on-actions.
- A GUI vocabulary derived from the executable. The one collected is measured from the base
  game's files and is labelled so.

These stay documented gaps. Lookup says what the spec says; where the spec has nothing, it says
so and does not guess.

## How a new package arrives

1. `pdx-parser-re` derives it for a game build and writes the package, its checksum and its
   schema.
2. The three files replace the ones in `spec/`. `task spec:check` verifies the checksum of the
   uncompressed bytes and that the format is one the tools support.
3. Every committed record made on the old package now fails `task records:check`, so the
   suites that need game files are re-run and their records committed with the package.

After 1.21 the spec is re-derived on the owner's word. Until then pychivalry reports a mismatch
between the spec's game build and the installed one once, and keeps working.
