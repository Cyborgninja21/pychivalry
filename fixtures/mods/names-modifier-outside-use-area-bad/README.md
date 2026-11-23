# names-modifier-outside-use-area-bad

The fixture pair of `names/modifier-outside-use-area` ([docs/checks.md](../../../docs/checks.md#42-unknown-names)),
with `names-modifier-outside-use-area-good`, from which it differs only in the defects. A
culture era's three blocks that hold modifiers, each read with the use area part D7 of the
spec package confirms: `character_modifier` with `character`, `county_modifier` with `county`
(a block the record schema does not list, and D7 does), `province_modifier` with `province`.

A correct tool reports two warnings: `baron_levy_contribution_add`, whose only use area is
`county`, in the character block, and `diplomacy`, whose only use area is `character`, in the
county block. It is silent on the rest, among them a name that fills a modifier template
(`bowmen_damage_mult`), whose template tags' use areas include `character`.
`expected.json` holds the findings.
