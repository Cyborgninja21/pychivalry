# fix-near-values

A fixture of the fixes (docs/PLAN.md item 8.7): three values of advice findings, each a
misspelling of exactly one value its place takes, so that the fix of each is a suggestion with
that value. Read over the game stub `planted-defects`, which defines none of these names.

- `events/fixture_events.txt`: an event whose `type` is `character_evnt` (`fields/unusual-value`
  and `structure/event-unknown-type`, both fixed by `character_event`), and whose portrait's
  `animation` is `fixture_idel` (`references/unknown-name`, fixed by `fixture_idle`, which the
  mod defines in `gfx/portraits/portrait_animations`).
- `common/nicknames/fixture_nicknames.txt`: a nickname whose `is_bad` is `yess`
  (`fields/unusual-value` and `fields/wrong-kind-of-value`, fixed by `yes`).

Advice is never fixed safely: each fix is a suggestion. The localization file defines every key
the script names.
