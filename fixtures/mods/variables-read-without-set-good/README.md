# variables-read-without-set-good

The good half of the `variables/read-without-set` pair, read over the same game stub: the list is
tested with `is_target_in_variable_list`, the chain reads `var:fixture_count`, and the change is
`change_variable`. A correct tool reports nothing.
