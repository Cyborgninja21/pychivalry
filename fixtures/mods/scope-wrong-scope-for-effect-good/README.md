# scope-wrong-scope-for-effect-good

The good half of the `scope/wrong-scope-for-effect` pair: `scope-wrong-scope-for-effect-bad`
with each effect moved to a scope it supports (`add_county_modifier` after `primary_title`,
`add_gold` and `every_vassal` at the root) and the option's `add_trait` replaced by
`add_province_modifier`. A correct tool reports nothing.
