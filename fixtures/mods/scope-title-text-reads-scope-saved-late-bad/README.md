# scope-title-text-reads-scope-saved-late-bad

The fixture pair of `scope/title-text-reads-scope-saved-late`
([docs/checks.md](../../../docs/checks.md#47-advice-carried-over-provisionally)), with
`scope-title-text-reads-scope-saved-late-good`, from which it differs only in the defect. An
event whose `title` is a dynamic description of two keys, whose localization text reads the scope
`fixture_rival`, which the event saves only in its option: one at the head of a chain
(`[fixture_rival.GetName]`, part D9's confirmed form) and one through
`[TopScope.sC('fixture_rival')...]` (a measured-only form, read because the check is advice). The
scope `fixture_host`, saved in `immediate`, is read too and is not reported.

A correct tool reports two findings, one at each title key. `expected.json` holds the findings.
The localization file defines every key the script names.
