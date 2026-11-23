# fix-scope-links

A fixture of the fixes (docs/PLAN.md item 8.7): the fixes of the scope findings, which wrap a
keyword in a link, or write a link before a link, from the links the finding's data names.
Read over the game stub `planted-defects`, which defines nothing these lines use.

`events/fixture_events.txt` holds one hidden event in the character scope (the root scope of
the `events` folder), whose `immediate` block runs:

- `add_dynasty_prestige`, an effect of dynasties: one plain link, `dynasty`, leads from a
  character to a dynasty, so the fix, `dynasty = { add_dynasty_prestige = 10 }`, is safe;
- `change_fervor`, an effect of faiths: two links lead there (`faith`, `secret_faith`), so the
  fix is a suggestion of the two;
- `religious_head`, a link that starts from a faith: the fix writes `faith.` or
  `secret_faith.` before it, a suggestion of the two.

Each fix applied takes its finding away and brings no other.
