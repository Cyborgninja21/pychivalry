# Comprehensive CK3 Validation Examples

This directory contains comprehensive examples demonstrating all PyChivalry validation rules, both **good** (passing) and **bad** (failing) examples.

## Purpose

- **Testing**: Verify all validation rules work correctly
- **Documentation**: Show correct patterns and common mistakes
- **Education**: Help contributors understand CK3 modding best practices

## Directory Structure

### 01_syntax/
**Error Codes**: CK3001-CK3002
- `good_syntax.txt` - Valid syntax examples
- `bad_syntax.txt` - Bracket matching errors

### 02_semantic/
**Error Codes**: CK3101-CK3103, CK3201-CK3203
- `good_semantic.txt` - Valid triggers, effects, and scopes
- `bad_triggers.txt` - Unknown triggers (CK3101), effects in triggers (CK3102)
- `bad_effects.txt` - Unknown effects (CK3103)
- `bad_scopes.txt` - Invalid scope chains (CK3201-CK3203)

### 03_scopes/
**Error Codes**: CK3550-CK3562 (Scope Timing - "The Golden Rule")
- `good_scopes.txt` - Proper scope usage
- `bad_scope_timing.txt` - Scopes created in immediate used in trigger/desc

**THE GOLDEN RULE**: Scopes created in `immediate` are NOT available in `trigger` or `desc` blocks because event evaluation order is:
1. `trigger` (evaluated FIRST)
2. `desc` (evaluated SECOND)
3. `immediate` (runs THIRD - scopes created here)

### 04_style/
**Error Codes**: CK33xx (15 style rules)
- `good_style.txt` - Properly formatted code
- `bad_style.txt` - All style violations (indentation, tabs, spacing, etc.)

### 05_events/
**Error Codes**: CK3760-CK3769, CK3450-CK3461, CK3440-CK3446, CK342x, CK343x
- `good_events.txt` - Perfect event structure
- `bad_event_structure.txt` - Event structure issues (CK3760-CK3769)
- `bad_options.txt` - Option validation errors (CK3450-CK3461)
- `bad_descriptions.txt` - Description block errors (CK3440-CK3446)
- `bad_portraits.txt` - Portrait and animation errors (CK342x, CK343x)

### 06_story_cycles/
**Error Codes**: STORY-001 to STORY-045
- `good_story_cycles.txt` - Proper story cycle structure
- `bad_story_cycles.txt` - All story cycle violations

### 07_decisions/
**Error Codes**: DECISION-001 to DECISION-004
- `good_decisions.txt` - Valid decision structure
- `bad_decisions.txt` - Decision validation errors

### 08_interactions/
**Error Codes**: INTERACTION-001 to INTERACTION-004, INTERACT-003, INTERACT-004, HOOK-001
- `good_interactions.txt` - Valid character interactions
- `bad_interactions.txt` - Interaction validation errors (including unreachable on_decline, missing is_shown, unknown hooks)

### 09_schemes/
**Error Codes**: SCHEME-001 to SCHEME-003
- `good_schemes.txt` - Valid scheme structure
- `bad_schemes.txt` - Scheme validation errors

### 10_on_actions/
**Error Codes**: ON_ACTION-001, ON_ACTION-002
- `good_on_actions.txt` - Valid on_action structure
- `bad_on_actions.txt` - On-action validation errors

### 11_assets/
**Error Codes**: GFX001, SND001, SND002
- `good_asset_refs.txt` - Valid asset references
- `bad_asset_refs.txt` - Missing asset references
- `graphics/` - Sample graphics files
- `sounds/` - Sample sound files

### 12_localization/
**Error Codes**: CK3600-CK3605, LOC-001 to LOC-007
- `english/good_loc.yml` - Valid localization
- `english/bad_syntax.yml` - Localization syntax errors
- `english/missing_keys.yml` - Missing localization keys (CK3600)
- `english/unused_keys.yml` - Unused localization keys (CK3604)
- `english/scope_type_mismatches.yml` - Scope type errors (CK3605)

### 15_activities/
**Error Codes**: ACT-001 to ACT-005
- `good_activities.txt` - Valid activity structure
- `bad_activities.txt` - Activity validation errors

### 16_traits/
**Error Codes**: CK3800
- `good_traits.txt` - Valid trait references
- `bad_traits.txt` - Unknown and misspelled trait names

### 17_script_values/
**Error Codes**: VALUE-001 to VALUE-006
- `good_script_values.txt` - Valid script value definitions
- `bad_script_values.txt` - Script value validation errors

### 18_modifiers/
**Error Codes**: MOD-001 to MOD-004
- `good_modifiers.txt` - Valid modifier definitions
- `bad_modifiers.txt` - Modifier validation errors

### 19_variables/
**Error Codes**: CK3701-CK3705
- `good_variables.txt` - Valid variable usage patterns
- `bad_variables.txt` - Variable validation errors

### 20_scripted_blocks/
**Error Codes**: CK3950-CK3956
- `good_scripted_blocks.txt` - Valid scripted effect/trigger definitions
- `bad_scripted_blocks.txt` - Undefined and recursive scripted blocks

### 21_court_positions/
**Error Codes**: COURT-001 to COURT-002
- `good_court_positions.txt` - Valid court position definitions
- `bad_court_positions.txt` - Court position validation errors

### 22_casus_belli/
**Error Codes**: CB-001 to CB-002
- `good_casus_belli.txt` - Valid casus belli definitions
- `bad_casus_belli.txt` - Casus belli validation errors

### 23_switch/
**Error Codes**: SWITCH-001 to SWITCH-003
- `good_switch.txt` - Valid switch block usage
- `bad_switch.txt` - Switch validation errors

### 24_iterators/
**Error Codes**: ITER-001 to ITER-004
- `good_iterators.txt` - Valid iterator usage (any_, every_, random_, ordered_)
- `bad_iterators.txt` - Iterator validation errors

## Complete Error Code Index

### Syntax & Parsing
- **CK3001**: Unmatched closing bracket → `01_syntax/bad_syntax.txt`
- **CK3002**: Unclosed bracket → `01_syntax/bad_syntax.txt`

### Semantic Validation
- **CK3101**: Unknown trigger → `02_semantic/bad_triggers.txt`
- **CK3102**: Effect used in trigger block → `02_semantic/bad_triggers.txt`
- **CK3103**: Unknown effect → `02_semantic/bad_effects.txt`
- **CK3201**: Invalid scope chain → `02_semantic/bad_scopes.txt`
- **CK3202**: Undefined saved scope → `02_semantic/bad_scopes.txt`
- **CK3203**: Invalid list iteration base → `02_semantic/bad_scopes.txt`

### Scope Timing (Golden Rule) ⚠️ MOST IMPORTANT
- **CK3550**: Scope in trigger from immediate (ERROR) → `03_scopes/bad_scope_timing.txt`
- **CK3551**: Scope in desc from immediate (WARNING) → `03_scopes/bad_scope_timing.txt`
- **CK3552**: Scope in triggered_desc trigger from immediate (ERROR) → `03_scopes/bad_scope_timing.txt`
- **CK3553**: Variable checked before set → `03_scopes/bad_scope_timing.txt`
- **CK3554**: Temporary scope across events → `03_scopes/bad_scope_timing.txt`
- **CK3555**: Scope needed in triggered event but not passed → `03_scopes/bad_scope_timing.txt`
- **CK3560**: Scope created in immediate but used in desc localization → `03_scopes/bad_scope_timing.txt`
- **CK3561**: Scope created in immediate but used in title localization → `03_scopes/bad_scope_timing.txt`
- **CK3562**: Scope may be used in desc but defined in immediate → `03_scopes/bad_scope_timing.txt`

### Style & Formatting
- **CK3301**: Inconsistent indentation → `04_style/bad_style.txt`
- **CK3302**: Multiple statements on one line → `04_style/bad_style.txt`
- **CK3303**: Spaces instead of tabs → `04_style/bad_style.txt`
- **CK3304**: Trailing whitespace → `04_style/bad_style.txt`
- **CK3305**: Block content not indented → `04_style/bad_style.txt`
- **CK3306**: Inconsistent operator spacing → `04_style/bad_style.txt`
- **CK3307**: Closing brace misalignment → `04_style/bad_style.txt`
- **CK3308**: Missing blank line → `04_style/bad_style.txt`
- **CK3314**: Empty block detected → `04_style/bad_style.txt`
- **CK3316**: Line exceeds length → `04_style/bad_style.txt`
- **CK3317**: Deeply nested blocks → `04_style/bad_style.txt`
- **CK3325**: Namespace not at top → `04_style/bad_style.txt`
- **CK3340**: Suspicious scope reference → `04_style/bad_style.txt`
- **CK3341**: Truncated scope reference → `04_style/bad_style.txt`
- **CK3345**: Merged identifier → `04_style/bad_style.txt`

### Portraits & Animations
- **CK3420**: Invalid portrait position → `05_events/bad_portraits.txt`
- **CK3421**: Portrait missing character field → `05_events/bad_portraits.txt`
- **CK3422**: Invalid animation → `05_events/bad_portraits.txt`
- **CK3430**: Invalid theme → `05_events/bad_portraits.txt`

### Descriptions
- **CK3440**: triggered_desc missing trigger → `05_events/bad_descriptions.txt`
- **CK3441**: triggered_desc missing desc → `05_events/bad_descriptions.txt`
- **CK3442**: first_valid has no fallback → `05_events/bad_descriptions.txt`
- **CK3443**: Empty desc block → `05_events/bad_descriptions.txt`
- **CK3444**: Literal string in desc (informational) → `05_events/bad_descriptions.txt`
- **CK3445**: Invalid desc structure → `05_events/bad_descriptions.txt`
- **CK3446**: Excessive desc nesting (>3 levels) → `05_events/bad_descriptions.txt`

### Options
- **CK3450**: Option missing name → `05_events/bad_options.txt`
- **CK3451**: Unknown trait referenced → `05_events/bad_options.txt`
- **CK3452**: Invalid skill reference in option → `05_events/bad_options.txt`
- **CK3453**: Invalid add_internal_flag value → `05_events/bad_options.txt`
- **CK3454**: Redundant fallback option → `05_events/bad_options.txt`
- **CK3455**: Multiple exclusive options → `05_events/bad_options.txt`
- **CK3456**: show_as_unavailable without trigger → `05_events/bad_options.txt`
- **CK3457**: highlight_portrait references undefined scope → `05_events/bad_options.txt`
- **CK3458**: Literal option name (informational) → `05_events/bad_options.txt`
- **CK3459**: All options have triggers (no fallback) → `05_events/bad_options.txt`
- **CK3460**: Option with multiple names → `05_events/bad_options.txt`
- **CK3461**: Empty option block → `05_events/bad_options.txt`

### Event Structure
- **CK3760**: Event missing type declaration → `05_events/bad_event_structure.txt`
- **CK3761**: Invalid event type → `05_events/bad_event_structure.txt`
- **CK3762**: Hidden event with options → `05_events/bad_event_structure.txt`
- **CK3763**: Event with no option blocks → `05_events/bad_event_structure.txt`
- **CK3764**: Non-hidden event missing desc → `05_events/bad_event_structure.txt`
- **CK3766**: Multiple after blocks → `05_events/bad_event_structure.txt`
- **CK3767**: Empty event block → `05_events/bad_event_structure.txt`
- **CK3768**: Multiple immediate blocks → `05_events/bad_event_structure.txt`
- **CK3769**: Character event has no portraits → `05_events/bad_event_structure.txt`

### AI Chance
- **CK3610**: Negative base ai_chance → `05_events/bad_options.txt`
- **CK3611**: High base ai_chance (>100) → `05_events/bad_options.txt`
- **CK3612**: Zero base ai_chance → `05_events/bad_options.txt`
- **CK3614**: Modifier without trigger → `05_events/bad_options.txt`

### Context Violations
- **CK3870**: Effect in trigger block → `02_semantic/bad_triggers.txt`
- **CK3871**: Effect in limit block → `02_semantic/bad_triggers.txt`
- **CK3872**: Redundant always=yes trigger → `02_semantic/bad_triggers.txt`
- **CK3873**: Impossible always=no trigger → `02_semantic/bad_triggers.txt`
- **CK3875**: random_ without limit → `02_semantic/bad_triggers.txt`

### List Iterators
- **CK3976**: Effect in any_ iterator (trigger-only) → `02_semantic/bad_triggers.txt`
- **CK3977**: every_ without limit (affects ALL entries) → `02_semantic/bad_triggers.txt`

### Common Gotchas
- **CK5137**: is_alive without exists check (can crash) → `02_semantic/bad_triggers.txt`
- **CK5142**: Character comparison with = instead of this → `02_semantic/bad_triggers.txt`

### Story Cycles
- **STORY-001**: effect_group missing timing keyword → `06_story_cycles/bad_story_cycles.txt`
- **STORY-002**: Invalid timing format → `06_story_cycles/bad_story_cycles.txt`
- **STORY-003**: Invalid timing range → `06_story_cycles/bad_story_cycles.txt`
- **STORY-004**: Multiple timing keywords → `06_story_cycles/bad_story_cycles.txt`
- **STORY-005**: triggered_effect missing trigger → `06_story_cycles/bad_story_cycles.txt`
- **STORY-006**: triggered_effect missing effect → `06_story_cycles/bad_story_cycles.txt`
- **STORY-007**: No effect_group blocks → `06_story_cycles/bad_story_cycles.txt`
- **STORY-008**: Wrong folder path → `06_story_cycles/bad_story_cycles.txt`
- **STORY-020**: Missing on_owner_death handler → `06_story_cycles/bad_story_cycles.txt`
- **STORY-021**: on_owner_death doesn't end story → `06_story_cycles/bad_story_cycles.txt`
- **STORY-022**: effect_group without trigger → `06_story_cycles/bad_story_cycles.txt`
- **STORY-023**: chance value >100% → `06_story_cycles/bad_story_cycles.txt`
- **STORY-024**: chance value ≤0 → `06_story_cycles/bad_story_cycles.txt`
- **STORY-025**: effect_group has trigger but no triggered_effects → `06_story_cycles/bad_story_cycles.txt`
- **STORY-026**: first_valid has no fallback → `06_story_cycles/bad_story_cycles.txt`
- **STORY-027**: Mixing triggered_effect and first_valid → `06_story_cycles/bad_story_cycles.txt`
- **STORY-040**: Empty on_setup → `06_story_cycles/bad_story_cycles.txt`
- **STORY-041**: Empty on_end → `06_story_cycles/bad_story_cycles.txt`
- **STORY-043**: Very short interval → `06_story_cycles/bad_story_cycles.txt`
- **STORY-044**: Very long interval → `06_story_cycles/bad_story_cycles.txt`
- **STORY-045**: Consider debug logging → `06_story_cycles/bad_story_cycles.txt`

### Decisions
- **DECISION-001**: Missing ai_check_interval → `07_decisions/bad_decisions.txt`
- **DECISION-002**: Missing effect block → `07_decisions/bad_decisions.txt`
- **DECISION-003**: No is_shown or is_valid → `07_decisions/bad_decisions.txt`
- **DECISION-004**: Effects but no cost/validity check → `07_decisions/bad_decisions.txt`

### Character Interactions
- **INTERACTION-001**: Missing category field → `08_interactions/bad_interactions.txt`
- **INTERACTION-002**: No effects → `08_interactions/bad_interactions.txt`
- **INTERACTION-003**: No AI configuration → `08_interactions/bad_interactions.txt`
- **INTERACT-003**: Unreachable on_decline → `08_interactions/bad_interactions.txt`
- **INTERACT-004**: Missing is_shown → `08_interactions/bad_interactions.txt`
- **HOOK-001**: Unknown interaction hook → `08_interactions/bad_interactions.txt`

### Schemes
- **SCHEME-001**: Missing skill field → `09_schemes/bad_schemes.txt`
- **SCHEME-002**: No effects → `09_schemes/bad_schemes.txt`
- **SCHEME-003**: Uses agents but no valid_agent conditions → `09_schemes/bad_schemes.txt`

### On-Actions
- **ON_ACTION-001**: No effects or events → `10_on_actions/bad_on_actions.txt`
- **ON_ACTION-002**: Empty events list → `10_on_actions/bad_on_actions.txt`

### Assets
- **GFX001**: Missing graphics file reference → `11_assets/bad_asset_refs.txt`
- **SND001**: Missing sound file reference → `11_assets/bad_asset_refs.txt`
- **SND002**: Invalid music event path format → `11_assets/bad_asset_refs.txt`

### Localization
- **CK3600**: Missing localization key → `12_localization/english/missing_keys.yml`
- **CK3601**: Literal text usage (informational) → `12_localization/english/bad_syntax.yml`
- **CK3602**: Encoding issue (UTF-8-BOM required) → `12_localization/english/bad_syntax.yml`
- **CK3603**: Inconsistent key naming → `12_localization/english/bad_syntax.yml`
- **CK3604**: Unused localization key → `12_localization/english/unused_keys.yml`
- **CK3605**: Scope type mismatch in localization → `12_localization/english/scope_type_mismatches.yml`
- **LOC-001**: Invalid localization key format → `12_localization/english/bad_syntax.yml`
- **LOC-002**: Unknown character function → `12_localization/english/bad_syntax.yml`
- **LOC-003**: Malformed text formatting code → `12_localization/english/bad_syntax.yml`
- **LOC-004**: Invalid icon reference → `12_localization/english/bad_syntax.yml`
- **LOC-005**: Unclosed brackets → `12_localization/english/bad_syntax.yml`
- **LOC-006**: Unknown concept reference → `12_localization/english/bad_syntax.yml`
- **LOC-007**: Invalid variable substitution → `12_localization/english/bad_syntax.yml`

### Activities
- **ACT-001**: Activity missing is_shown → `15_activities/bad_activities.txt`
- **ACT-002**: Phase reference not defined → `15_activities/bad_activities.txt`
- **ACT-003**: Unknown province filter → `15_activities/bad_activities.txt`
- **ACT-004**: Trigger in lifecycle hook (effect context) → `15_activities/bad_activities.txt`
- **ACT-005**: Duplicate phase name → `15_activities/bad_activities.txt`

### Traits
- **CK3800**: Unknown trait → `16_traits/bad_traits.txt`

### Script Values
- **VALUE-001**: Unrecognized script value reference → `17_script_values/bad_script_values.txt`
- **VALUE-002**: Range min greater than max → `17_script_values/bad_script_values.txt`
- **VALUE-003**: Unknown formula operation → `17_script_values/bad_script_values.txt`
- **VALUE-004**: Invalid conditional structure → `17_script_values/bad_script_values.txt`
- **VALUE-005**: Formula without explicit value → `17_script_values/bad_script_values.txt`
- **VALUE-006**: Invalid round_to parameter → `17_script_values/bad_script_values.txt`

### Modifiers
- **MOD-001**: Unknown modifier key → `18_modifiers/bad_modifiers.txt`
- **MOD-002**: Non-numeric modifier value → `18_modifiers/bad_modifiers.txt`
- **MOD-003**: Opinion modifier missing opinion field → `18_modifiers/bad_modifiers.txt`
- **MOD-004**: Opinion value outside typical range → `18_modifiers/bad_modifiers.txt`

### Variables
- **CK3701**: Variable used but never declared → `19_variables/bad_variables.txt`
- **CK3702**: Variable declared but never used → `19_variables/bad_variables.txt`
- **CK3703**: Variable scope mismatch (local vs global) → `19_variables/bad_variables.txt`
- **CK3705**: Variable used as both list and value → `19_variables/bad_variables.txt`

### Scripted Blocks
- **CK3950**: Undefined scripted effect → `20_scripted_blocks/bad_scripted_blocks.txt`
- **CK3951**: Undefined scripted trigger → `20_scripted_blocks/bad_scripted_blocks.txt`
- **CK3956**: Recursive scripted block → `20_scripted_blocks/bad_scripted_blocks.txt`

### Court Positions
- **COURT-001**: Missing can_be_appointed trigger → `21_court_positions/bad_court_positions.txt`
- **COURT-002**: Salary without opinion modifier → `21_court_positions/bad_court_positions.txt`

### Casus Belli
- **CB-001**: No outcome effects → `22_casus_belli/bad_casus_belli.txt`
- **CB-002**: Unknown cost type → `22_casus_belli/bad_casus_belli.txt`

### Switch Validation
- **SWITCH-001**: Missing trigger field → `23_switch/bad_switch.txt`
- **SWITCH-002**: No branch values → `23_switch/bad_switch.txt`
- **SWITCH-003**: Unknown trigger reference → `23_switch/bad_switch.txt`

### Iterators
- **ITER-001**: Effect in trigger iterator (any_) → `24_iterators/bad_iterators.txt`
- **ITER-002**: Only triggers in effect iterator (every_) → `24_iterators/bad_iterators.txt`
- **ITER-003**: ordered_ missing order_by → `24_iterators/bad_iterators.txt`
- **ITER-004**: ordered_ missing position/max → `24_iterators/bad_iterators.txt`

## Usage

### For Testing
Each file can be used in unit tests to verify specific validation rules:
```typescript
import { validate } from 'pychivalry';
import { readFileSync } from 'fs';

function testUnmatchedBracket() {
    const content = readFileSync('tests/fixtures/comprehensive_mod/01_syntax/bad_syntax.txt', 'utf8');
    // Test CK3001, CK3002
    const diagnostics = validate(content);
    const hasCK3001 = diagnostics.some(d => d.code === 'CK3001');
    // Assert hasCK3001 is true
}
```

### For Learning
Read the good examples to see best practices, then compare with bad examples to understand what to avoid.

### For Documentation
Reference specific files when explaining validation rules in docs or issues.

## Total Coverage

- **200+ error codes** across 20 validation categories
- **24 sections** covering all validator types
- **62+ files** of example code
- **Good and bad examples for every active validation rule**
