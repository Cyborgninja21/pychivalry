## Summary

Add validation diagnostics for `after` blocks in event files. The `after` block has special execution semantics (runs after options/immediate) and several misuse patterns should be caught by the language server.

## Missing Checks (proposed)

- **CK3520** (Warning): `after` in hidden event — `after` blocks in hidden events will not execute (no options to trigger them).
- **CK3521** (Warning): `after` in optionless event — `after` block present but event has no `option` blocks, so it will never run.
- **CK3522** (Information): Cleanup pattern detected — `after` block removes variables/scopes (informational, can be encouraged as best practice).
- **CK3523** (Warning): `trigger` used in `after` block — `after` is effect-context; using trigger-only constructs is incorrect.

## Rationale

`after` blocks are only executed in specific situations (usually after an option runs). Misplacing or expecting `after` to run in hidden events or events without options causes silent failures and confusing behavior for modders. The language server should warn when such patterns are detected to improve mod reliability.

## Proposed Implementation

1. Detect event nodes (namespace.number = { ... }).
2. For each event, locate child nodes with key `after`.
3. Emit diagnostics:
   - If event has `hidden = yes` and contains any `after` child → emit **CK3520** (Warning).
   - If event has no `option` child blocks and contains `after` → emit **CK3521** (Warning).
   - If `after` block contains only cleanup-like operations (e.g., `remove_variable`, `clear_scope`) → emit **CK3522** (Information) to encourage cleanup practice.
   - If `after` block contains trigger-only constructs (e.g., `is_adult`, `has_trait`) → emit **CK3523** (Warning/Error) because `after` is an effect context.

## Tests

- Add unit tests in `tests/test_paradox_checks.py` covering:
  - Hidden event with `after` → expect CK3520
  - Event with no options but `after` → expect CK3521
  - Event with `after` that only clears variables → expect CK3522 (info)
  - `after` containing a trigger → expect CK3523

## Files to Modify

- `pychivalry/paradox_checks.py`: add functions `check_after_block_in_hidden_event`, `check_after_block_without_options`, `check_after_block_cleanup_pattern`, `check_after_block_trigger_usage` and wire them into `check_paradox_conventions()`.
- `plan docs/workspace (current state)/VALIDATION_GAPS.md`: mark these checks as planned (Phase 11).
- `plan docs/workspace (current state)/IMPLEMENTATION_PLAN.md`: add Phase 11 task details if desired.

## Labels

- `validation`, `enhancement`, `needs-triage`

## Additional Context / Examples

```pdx
# CK3520: after in hidden event
my_event.1 = {
    hidden = yes
    after = { remove_variable = temp }  # WARNING: after will never execute
}

# CK3521: after without options
my_event.2 = {
    type = character_event
    after = { clear_scope = my_target }  # WARNING: No options -> after never runs
}

# CK3523: trigger in after block
my_event.3 = {
    option = { name = my_event.3.a }
    after = { is_adult = yes }  # WARNING: 'is_adult' is a trigger, not an effect
}
```
