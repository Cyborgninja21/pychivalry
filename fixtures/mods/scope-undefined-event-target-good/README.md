# scope-undefined-event-target-good

The silent half of `scope-undefined-event-target-bad`: the event saves the two names the bad
mod reads without saving (`save_scope_as`, `save_temporary_scope_as`). A correct tool reports
nothing here, with or without the base-game stub.
