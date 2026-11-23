# localization-missing-key-good

The silent half of `localization-missing-key-bad`: every key its fields and records need is
defined, `fixture_loc_no_bom` in a file with the byte-order mark as well as in the one without,
and the option written as literal text names a key instead. A correct tool reports nothing.
