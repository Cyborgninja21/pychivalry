# localization-missing-key-bad

The fixture pair of `localization/missing-key` ([docs/checks.md](../../../docs/checks.md#46-event-targets-and-localization)),
with `localization-missing-key-good`, from which it differs only in the defects. Read over the
base-game stub [event-targets-and-localization](../../game/event-targets-and-localization/README.md).

Keys written in the fields the spec package marks as holding one (an event's `title`, `desc` and
option `name`), and keys records have by their names (part D5):

- silent: a key the mod defines, with and without a version number (`fixture_loc.0001.a:`);
  one defined only in the base game (`fixture_base_key`); one defined only in the mod's
  `localization/english/replace/` folder; a data-binding expression in brackets; a dynamic
  description (`first_valid`, `triggered_desc`), whose block is not a key;
- warnings, with the game's message "Unknown loc key %s": `fixture_loc.0001.missing`, defined
  nowhere; `"fixture text with spaces"`, literal text the game reads as a key; and the court
  position type's `fixture_court_position` and `fixture_court_position_desc`, which the package
  shows the game requires (D5 `required`, confirmed);
- information, advice: `decision_group_type_fixture_decision_group`, the key every decision group
  of the base game has (D5 `always-present-in-base-game`, a measurement, not a requirement).

`fixture_loc_no_bom` is defined only in `fixture_loc_no_bom_l_english.yml`, a file without the
UTF-8 byte-order mark. On Linux the game reads no key from such a file (the package's override
rule `msg-localization-missing-bom`), which the index applies, and the check takes the index's
answer: a fifth warning. `expected.json` holds the findings.

With no base game read the check reports nothing.
