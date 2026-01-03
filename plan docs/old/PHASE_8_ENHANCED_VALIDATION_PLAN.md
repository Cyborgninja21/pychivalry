# Phase 8: Enhanced Validation Features Implementation Plan

## Overview

This phase implements missing validation capabilities identified during the schema-driven architecture review. These enhancements will provide more comprehensive validation coverage and better utilize the type system defined in `_types.yaml`.

## Current State Analysis

### What's Working
- ✅ Required field validation (simple and conditional)
- ✅ Enum value validation
- ✅ Count constraints (min/max occurrences)
- ✅ Cross-field condition evaluation
- ✅ Nested schema validation
- ✅ Diagnostic generation with custom codes

### What's Missing
- ❌ Field order validation (e.g., `type` before `title` before `desc`)
- ❌ Pattern matching for field values (localization keys, scope references, numbers)
- ❌ Type system integration from `_types.yaml`
- ❌ Type-specific validation rules

## Implementation Plan

### Phase 8.1: Pattern Validation System (Priority: High)

**Goal**: Enforce value patterns defined in `_types.yaml` and schemas.

**Tasks**:
1. Extend schema_validator.py with pattern validation
   - Add `_validate_pattern()` method
   - Support regex patterns from type definitions
   - Generate appropriate diagnostics for pattern mismatches

2. Update _types.yaml with comprehensive patterns:
   - Localization key: `^[a-z][a-z0-9_.]*$`
   - Scope reference: `^(scope:|root|prev|this|from|[a-z_]+).*$`
   - Integer: `^-?[0-9]+$`
   - Number: `^-?[0-9]+\.?[0-9]*$`
   - Script value reference: `^[a-z_][a-z0-9_]*$`

3. Add pattern validation to field validation flow:
   - Check field type in schema
   - Resolve type from `_types.yaml` if referenced
   - Apply pattern validation if pattern is defined
   - Generate diagnostic with examples on mismatch

4. Add diagnostic codes to diagnostics.yaml:
   - SCHEMA-001: "Invalid localization key format: '{value}'"
   - SCHEMA-002: "Invalid scope reference format: '{value}'"
   - SCHEMA-003: "Invalid number format: '{value}'"
   - SCHEMA-004: "Value '{value}' does not match required pattern '{pattern}'"

**Testing**:
- Unit tests for pattern validation (10+ tests)
- Integration tests with events.yaml (5+ tests)
- Test each pattern type from _types.yaml
- Test pattern mismatch diagnostics

**Estimated Time**: 4-6 hours

---

### Phase 8.2: Type System Integration (Priority: High)

**Goal**: Fully integrate `_types.yaml` type definitions into validation.

**Tasks**:
1. Extend SchemaLoader to load and cache type definitions:
   - Add `get_type_definition()` method
   - Support type resolution (including `one_of` types)
   - Handle type inheritance and composition

2. Update SchemaValidator to use type definitions:
   - When field has `type` property, resolve from _types.yaml
   - Apply all type constraints (pattern, values, context)
   - Support `one_of` types (e.g., localization_key_or_block)
   - Support nested type validation

3. Enhance field validation logic:
   - Check if field type is defined in schema
   - If type references _types.yaml, load type definition
   - Apply type-specific validation rules
   - Validate context (effect_block vs trigger_block)

4. Add validation for type-specific constraints:
   - Boolean: must be one of [yes, no, true, false]
   - Integer: must match integer pattern
   - Number: must match number pattern
   - Enum: must be one of defined values
   - Block: must be a nested block structure

**Testing**:
- Unit tests for type resolution (8+ tests)
- Unit tests for type validation (12+ tests)
- Integration tests for each type in _types.yaml
- Test one_of type handling

**Estimated Time**: 6-8 hours

---

### Phase 8.3: Field Order Validation (Priority: Medium)

**Goal**: Validate that fields appear in expected order for readability.

**Tasks**:
1. Extend schema format to support field ordering:
   ```yaml
   field_order:
     enabled: true
     sequence:
       - type
       - title
       - desc
       - immediate
       - option
     flexible: true  # Allow other fields between sequence items
     diagnostic: SCHEMA-010
   ```

2. Implement field order validation:
   - Add `_validate_field_order()` method
   - Track field positions in AST
   - Check sequence adherence
   - Support flexible vs strict ordering
   - Generate helpful diagnostics with suggestions

3. Add field_order to major schemas:
   - events.yaml: type → title → desc → theme → immediate → option
   - story_cycles.yaml: (timing keywords) → on_setup → effect_group → on_end
   - decisions.yaml: is_shown → is_valid → effect → ai_check_interval
   - character_interactions.yaml: category → is_shown → can_send → on_accept

4. Add diagnostic codes:
   - SCHEMA-010: "Field '{field}' should appear before '{other_field}' for consistency"
   - SCHEMA-011: "Recommended field order: {expected_order}"

**Testing**:
- Unit tests for order validation (8+ tests)
- Test flexible vs strict ordering
- Test diagnostic generation
- Integration tests for each schema

**Estimated Time**: 4-5 hours

---

### Phase 8.4: Enhanced Type Validation (Priority: Medium)

**Goal**: Add validation for complex type constraints.

**Tasks**:
1. Implement range validation for integer_or_range type:
   - Validate range blocks have exactly 2 values
   - Validate min < max
   - Validate both values are integers

2. Implement number_or_script_value validation:
   - Check if value is valid number
   - OR check if value matches script value pattern
   - Generate helpful error for neither case

3. Implement localization_key_or_block validation:
   - Check if simple string matches localization key pattern
   - OR validate block contains valid fields (triggered_desc, first_valid, random_valid)
   - Ensure block structure is valid for desc blocks

4. Add context validation for effect_block and trigger_block:
   - Track validation context (in effect vs in trigger)
   - Validate effect_block only contains effects
   - Validate trigger_block only contains triggers
   - Cross-reference with generic_rules.yaml for consistency

5. Add diagnostic codes:
   - SCHEMA-020: "Range block must have exactly 2 values (min and max)"
   - SCHEMA-021: "Range minimum ({min}) must be less than maximum ({max})"
   - SCHEMA-022: "Expected number or script value reference, got '{value}'"
   - SCHEMA-023: "Description block must contain one of: triggered_desc, first_valid, random_valid"

**Testing**:
- Unit tests for each complex type (15+ tests)
- Integration tests with real schema examples
- Test error message clarity

**Estimated Time**: 5-7 hours

---

### Phase 8.5: Pattern Library and Documentation (Priority: Low)

**Goal**: Document all patterns and provide examples.

**Tasks**:
1. Create PATTERN_VALIDATION_GUIDE.md:
   - List all supported patterns
   - Provide valid and invalid examples
   - Explain pattern syntax
   - Show how to add new patterns

2. Update SCHEMA_AUTHORING_GUIDE.md:
   - Add section on type system
   - Document pattern validation
   - Provide examples of using types from _types.yaml
   - Show field order configuration

3. Add inline documentation:
   - Update _types.yaml with examples for each type
   - Add comments explaining pattern syntax
   - Document one_of and complex types

4. Create validation examples:
   - Example schemas using all type features
   - Example test cases for pattern validation
   - Common pattern mistakes and fixes

**Testing**:
- Documentation review
- Example validation

**Estimated Time**: 2-3 hours

---

## Implementation Order

1. **Phase 8.1** (Pattern Validation) - Highest priority, foundation for other features
2. **Phase 8.2** (Type System Integration) - Builds on pattern validation
3. **Phase 8.4** (Enhanced Type Validation) - Requires type system integration
4. **Phase 8.3** (Field Order Validation) - Can be done independently
5. **Phase 8.5** (Documentation) - After implementation complete

## Success Metrics

- ✅ All patterns in _types.yaml are enforced
- ✅ Field order validated for 6 major file types
- ✅ Complex types (one_of, ranges) fully validated
- ✅ Context validation (effect vs trigger blocks) working
- ✅ 50+ new tests with 100% pass rate
- ✅ Zero regressions in existing tests
- ✅ Comprehensive documentation for all new features
- ✅ Performance impact < 10ms per file

## Testing Strategy

### Unit Tests (50+ new tests)
- Pattern validation: 10 tests
- Type resolution: 8 tests
- Type validation: 12 tests
- Field order validation: 8 tests
- Complex type validation: 15 tests
- Integration tests: 10 tests

### Integration Tests (20+ new tests)
- Pattern validation with events.yaml: 5 tests
- Type validation with all schemas: 6 tests
- Field order with major schemas: 4 tests
- Complex type validation: 5 tests

### Performance Tests
- Validate pattern checking adds < 5ms overhead
- Type resolution is cached and efficient
- Field order checking is O(n) in fields

## Diagnostic Codes

New diagnostic codes to add to diagnostics.yaml:

```yaml
# Pattern Validation
SCHEMA-001:
  severity: error
  category: validation
  message: "Invalid localization key format: '{value}'. Expected lowercase starting with letter."

SCHEMA-002:
  severity: error
  category: validation
  message: "Invalid scope reference format: '{value}'. Expected scope:, root, prev, this, or identifier."

SCHEMA-003:
  severity: error
  category: validation
  message: "Invalid number format: '{value}'. Expected integer or decimal number."

SCHEMA-004:
  severity: error
  category: validation
  message: "Value '{value}' does not match required pattern '{pattern}'."

# Field Order
SCHEMA-010:
  severity: information
  category: style
  message: "Field '{field}' should appear before '{other_field}' for consistency."

SCHEMA-011:
  severity: hint
  category: style
  message: "Recommended field order: {expected_order}"

# Complex Types
SCHEMA-020:
  severity: error
  category: validation
  message: "Range block must have exactly 2 values (min and max), found {count}."

SCHEMA-021:
  severity: error
  category: validation
  message: "Range minimum ({min}) must be less than maximum ({max})."

SCHEMA-022:
  severity: error
  category: validation
  message: "Expected number or script value reference, got '{value}'."

SCHEMA-023:
  severity: warning
  category: validation
  message: "Description block must contain one of: triggered_desc, first_valid, random_valid."
```

## Dependencies

- Existing schema_loader.py and schema_validator.py
- _types.yaml with pattern definitions
- diagnostics.yaml for new diagnostic codes
- All existing schemas (events.yaml, etc.)

## Migration Notes

- All changes are backward compatible
- New validation is additive (doesn't break existing schemas)
- Schemas can opt-in to features (field_order, pattern validation)
- Type system is optional but recommended for all new schemas

## Risk Assessment

**Low Risk**:
- Pattern validation - straightforward regex matching
- Field order validation - optional feature, doesn't break anything
- Documentation - no code changes

**Medium Risk**:
- Type system integration - requires careful testing to avoid breaking existing validation
- Complex type validation - needs thorough testing of edge cases

**Mitigation**:
- Implement feature flags for new validation types
- Add comprehensive tests before enabling
- Roll out gradually (one schema at a time)
- Maintain backward compatibility throughout

## Timeline Estimate

**Total Time: 21-29 hours (~3-4 days)**

- Phase 8.1: 4-6 hours
- Phase 8.2: 6-8 hours  
- Phase 8.3: 4-5 hours
- Phase 8.4: 5-7 hours
- Phase 8.5: 2-3 hours

**Recommended Schedule**:
- Day 1: Phase 8.1 + start Phase 8.2
- Day 2: Complete Phase 8.2 + Phase 8.4
- Day 3: Phase 8.3 + Phase 8.5
- Day 4: Testing, documentation, cleanup

## Next Steps

1. Review and approve this plan
2. Begin Phase 8.1 implementation
3. Create tracking issues for each phase
4. Set up test infrastructure for new validation types
5. Update project documentation with timeline
