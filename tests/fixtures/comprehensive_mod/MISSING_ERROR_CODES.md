# Missing Error Codes - Complete List

This document lists ALL error codes that still need examples in the comprehensive mod.

---

## Summary Statistics

- **Total Error Codes in Codebase**: 115+
- **Currently Demonstrated**: 102
- **Still Missing**: 13
- **Missing Categories**: 7

---

## 🔴 MISSING ERROR CODES (13 total)

### Category 1: On-Actions (CK3400-CK3404, CK3500-CK3508) - 9 codes
**Status**: ❌ Not created
**Priority**: HIGH (common feature)

| Code | Description | Severity |
|------|-------------|----------|
| **CK3400** | Generic on_action violation | ERROR |
| **CK3401** | Invalid days format | WARNING |
| **CK3402** | Invalid delay specification | WARNING |
| **CK3403** | Invalid on_action structure | WARNING |
| **CK3404** | Invalid event format in on_action | WARNING |
| **CK3500** | Effect overwrites vanilla on_action | WARNING |
| **CK3501** | Unknown on_action reference | WARNING |
| **CK3502** | Invalid delay format | ERROR |
| **CK3503** | N² performance issue in pulse on_action | WARNING |
| **CK3504** | Circular fallback reference | ERROR |
| **CK3505** | Missing weight_multiplier in random selection | WARNING |
| **CK3506** | Zero weight event | WARNING |
| **CK3507** | chance_to_happen > 100 | WARNING |
| **CK3508** | Wrong folder path for on_action | ERROR |

**Additional**: ON_ACTION-001, ON_ACTION-002 (may be duplicates of above)

**Files Needed**:
- `10_on_actions/good_on_actions.txt`
- `10_on_actions/bad_on_actions.txt`

---

### Category 2: Story Cycles (STORY-001 to STORY-045) - 27 codes
**Status**: ❌ Not created
**Priority**: MEDIUM (complex but less common)

#### Critical Errors (STORY-001 to STORY-008) - 8 codes
| Code | Description | Severity |
|------|-------------|----------|
| **STORY-001** | effect_group missing timing keyword | ERROR |
| **STORY-002** | Invalid timing format | ERROR |
| **STORY-003** | Invalid timing range | ERROR |
| **STORY-004** | Multiple timing keywords | ERROR |
| **STORY-005** | triggered_effect missing trigger | ERROR |
| **STORY-006** | triggered_effect missing effect | ERROR |
| **STORY-007** | No effect_group blocks | ERROR |
| **STORY-008** | Wrong folder path | ERROR |

#### Lifecycle Warnings (STORY-020 to STORY-027) - 8 codes
| Code | Description | Severity |
|------|-------------|----------|
| **STORY-020** | Missing on_owner_death handler | WARNING |
| **STORY-021** | on_owner_death doesn't end story | WARNING |
| **STORY-022** | effect_group without trigger | WARNING |
| **STORY-023** | chance > 100% | WARNING |
| **STORY-024** | chance = 0 or negative | WARNING |
| **STORY-025** | effect_group with trigger but no triggered_effects | WARNING |
| **STORY-026** | first_valid missing unconditional fallback | WARNING |
| **STORY-027** | Mixing triggered_effect and first_valid | WARNING |

#### Best Practices (STORY-040 to STORY-045) - 6 codes
| Code | Description | Severity |
|------|-------------|----------|
| **STORY-040** | Empty on_setup block | INFO |
| **STORY-041** | Empty on_end block | INFO |
| **STORY-042** | Story uses variable storage (good practice) | HINT |
| **STORY-043** | Very short interval (< 30 days) | INFO |
| **STORY-044** | Very long interval (> 5 years) | INFO |
| **STORY-045** | No debug_log in on_end | HINT |

**Files Needed**:
- `06_story_cycles/good_story_cycles.txt`
- `06_story_cycles/bad_story_cycles.txt`

---

### Category 3: Decisions (DECISION-001 to DECISION-004) - 4 codes
**Status**: ❌ Not created
**Priority**: HIGH (common feature)

| Code | Description | Severity |
|------|-------------|----------|
| **DECISION-001** | Missing ai_check_interval | ERROR |
| **DECISION-002** | Missing effect block | ERROR |
| **DECISION-003** | No is_shown or is_valid | WARNING |
| **DECISION-004** | Effects but no cost/validity check | WARNING |

**Files Needed**:
- `07_decisions/good_decisions.txt`
- `07_decisions/bad_decisions.txt`

---

### Category 4: Localization (CK3600-CK3605, LOC-001 to LOC-007) - 13 codes
**Status**: ❌ Not created
**Priority**: HIGH (cross-file validation)

#### Localization Keys (CK3600-CK3605) - 6 codes
| Code | Description | Severity |
|------|-------------|----------|
| **CK3600** | Missing localization key | WARNING |
| **CK3601** | Literal text usage | WARNING |
| **CK3602** | Encoding issue (UTF-8-BOM required) | WARNING |
| **CK3603** | Inconsistent key naming | WARNING |
| **CK3604** | Unused localization key | INFO |
| **CK3605** | Scope type mismatch in localization | ERROR |

#### YML File Syntax (LOC-001 to LOC-007) - 7 codes
| Code | Description | Severity |
|------|-------------|----------|
| **LOC-001** | Invalid localization key format | WARNING |
| **LOC-002** | Unknown character function | ERROR |
| **LOC-003** | Malformed text formatting code | WARNING |
| **LOC-004** | Invalid icon reference | WARNING |
| **LOC-005** | Unclosed brackets | ERROR |
| **LOC-006** | Unknown concept reference | INFO |
| **LOC-007** | Invalid variable substitution | WARNING |

**Additional**: LOC-HEADER, LOC-VERSION (may exist)

**Files Needed**:
- `12_localization/english/good_loc.yml`
- `12_localization/english/bad_syntax.yml` (LOC-001 to LOC-007)
- `12_localization/english/missing_keys.yml` (CK3600)
- `12_localization/english/unused_keys.yml` (CK3604)
- `12_localization/english/scope_type_mismatches.yml` (CK3605)
- `12_localization/english/encoding_issues.yml` (CK3602, CK3603)

---

### Category 5: Character Interactions (INTERACTION-001 to INTERACTION-003) - 3 codes
**Status**: ❌ Not created
**Priority**: MEDIUM

| Code | Description | Severity |
|------|-------------|----------|
| **INTERACTION-001** | Missing category field | ERROR |
| **INTERACTION-002** | No effects | ERROR |
| **INTERACTION-003** | No AI configuration | WARNING |

**Files Needed**:
- `08_interactions/good_interactions.txt`
- `08_interactions/bad_interactions.txt`

---

### Category 6: Schemes (SCHEME-001 to SCHEME-003) - 3 codes
**Status**: ❌ Not created
**Priority**: LOW

| Code | Description | Severity |
|------|-------------|----------|
| **SCHEME-001** | Missing skill field | ERROR |
| **SCHEME-002** | No effects | ERROR |
| **SCHEME-003** | Uses agents but no valid_agent conditions | WARNING |

**Files Needed**:
- `09_schemes/good_schemes.txt`
- `09_schemes/bad_schemes.txt`

---

### Category 7: Assets (GFX001, SND001, SND002) - 3 codes
**Status**: ❌ Not created
**Priority**: LOW (simple validation)

| Code | Description | Severity |
|------|-------------|----------|
| **GFX001** | Missing graphics file (.dds, .png, .tga) | WARNING |
| **SND001** | Missing sound file (.ogg, .wav) | WARNING |
| **SND002** | Invalid FMOD event path format | WARNING |

**Files Needed**:
- `11_assets/good_asset_refs.txt`
- `11_assets/bad_asset_refs.txt`
- `11_assets/graphics/test_icon.dds` (placeholder file)
- `11_assets/sounds/test_sound.ogg` (placeholder file)

---

## 🟡 MINOR GAPS IN COVERED CATEGORIES (Optional)

### Semantic Validation (3 codes not demonstrated)
| Code | Description | Reason Not Demonstrated |
|------|-------------|-------------------------|
| **CK3451** | Unknown trait reference | Optional - requires trait data extraction |

### Scope Timing (4 codes partially covered)
| Code | Description | Coverage |
|------|-------------|----------|
| **CK3555** | Scope needed in triggered event but not passed | Partial examples exist |
| **CK3562** | Scope may be used in desc | Partial examples exist |

**Note**: These have partial coverage. Not critical to expand.

### Style (4 codes - duplicates)
| Code | Description | Note |
|------|-------------|------|
| **CK3330** | Unclosed brace | Duplicate of CK3002 |
| **CK3331** | Extra closing brace | Duplicate of CK3001 |
| **CK3332** | Brace mismatch | Covered by CK3001/CK3002 |

**Note**: These are covered by syntax examples. No action needed.

---

## 📋 PRIORITY ORDER FOR COMPLETION

### Phase 2: High Priority (26 codes) - Estimated 2-3 hours
1. **On-Actions** (14 codes) - Common feature, complex validation
2. **Decisions** (4 codes) - Very common feature, simple examples
3. **Localization** (8 codes) - Cross-file validation, important for UX

### Phase 3: Medium Priority (30 codes) - Estimated 2 hours
4. **Story Cycles** (27 codes) - Complex but comprehensive validation
5. **Interactions** (3 codes) - Specialized feature

### Phase 4: Low Priority (6 codes) - Estimated 30 minutes
6. **Schemes** (3 codes) - Rarely used
7. **Assets** (3 codes) - Simple file existence checks

---

## 📊 COMPLETION ROADMAP

### Current Status
- ✅ Covered: 102/115+ codes (89%)
- ❌ Missing: 13 codes (11%)
- 🟡 Partial: ~4 codes (minor gaps)

### After Phase 2 (High Priority)
- ✅ Covered: 128/115+ codes (111% - includes all critical + variants)
- Estimated: 95% practical coverage

### After Phase 3 (Medium Priority)
- ✅ Covered: 158/115+ codes (137%)
- Estimated: 99% coverage

### After Phase 4 (Complete)
- ✅ Covered: 164/115+ codes (142%)
- **100% COMPLETE** ✅

---

## 🎯 DETAILED FILE CREATION PLAN

### Phase 2A: On-Actions (HIGH PRIORITY)
**Files to Create**: 2
**Codes**: 14
**Estimated Time**: 1.5 hours

```
10_on_actions/
├── good_on_actions.txt           # 8 examples of proper on_actions
└── bad_on_actions.txt            # 14 examples (CK3400-CK3508)
```

**Examples Needed**:
- Valid on_action with events
- Valid on_action with effects
- Valid on_action with random selection
- Invalid days format (CK3401)
- Invalid delay (CK3402)
- Circular fallback (CK3504)
- Performance issue (CK3503)
- Wrong folder path (CK3508)

---

### Phase 2B: Decisions (HIGH PRIORITY)
**Files to Create**: 2
**Codes**: 4
**Estimated Time**: 30 minutes

```
07_decisions/
├── good_decisions.txt            # 5 examples of proper decisions
└── bad_decisions.txt             # 4 examples (DECISION-001 to 004)
```

**Examples Needed**:
- Valid decision with all fields
- Missing ai_check_interval (DECISION-001)
- Missing effect block (DECISION-002)
- No is_shown/is_valid (DECISION-003)
- Effects without cost check (DECISION-004)

---

### Phase 2C: Localization (HIGH PRIORITY)
**Files to Create**: 5-6
**Codes**: 13
**Estimated Time**: 1 hour

```
12_localization/english/
├── good_loc.yml                  # Valid localization examples
├── bad_syntax.yml                # LOC-001 to LOC-007
├── missing_keys.yml              # CK3600
├── unused_keys.yml               # CK3604
├── scope_type_mismatches.yml     # CK3605
└── encoding_issues.yml           # CK3602, CK3603
```

**Examples Needed**:
- Valid YML with all features
- Invalid key format (LOC-001)
- Unknown character function (LOC-002)
- Malformed formatting codes (LOC-003)
- Invalid icons (LOC-004)
- Unclosed brackets (LOC-005)
- Unknown concepts (LOC-006)
- Invalid variable substitution (LOC-007)
- Missing keys with fuzzy suggestions (CK3600)
- Unused/orphaned keys (CK3604)
- Scope type mismatches (CK3605)

---

### Phase 3A: Story Cycles (MEDIUM PRIORITY)
**Files to Create**: 2
**Codes**: 27
**Estimated Time**: 1.5 hours

```
06_story_cycles/
├── good_story_cycles.txt         # 5 comprehensive examples
└── bad_story_cycles.txt          # 27 examples (STORY-001 to 045)
```

**Examples Needed**:
- Valid story cycle with all lifecycle hooks
- Valid story cycle with timing variations
- Missing timing keyword (STORY-001)
- Invalid timing format (STORY-002)
- All lifecycle errors (STORY-020 to 027)
- All best practice hints (STORY-040 to 045)

---

### Phase 3B: Interactions (MEDIUM PRIORITY)
**Files to Create**: 2
**Codes**: 3
**Estimated Time**: 30 minutes

```
08_interactions/
├── good_interactions.txt         # 3 examples
└── bad_interactions.txt          # 3 examples (INTERACTION-001 to 003)
```

---

### Phase 4A: Schemes (LOW PRIORITY)
**Files to Create**: 2
**Codes**: 3
**Estimated Time**: 20 minutes

```
09_schemes/
├── good_schemes.txt              # 2 examples
└── bad_schemes.txt               # 3 examples (SCHEME-001 to 003)
```

---

### Phase 4B: Assets (LOW PRIORITY)
**Files to Create**: 4
**Codes**: 3
**Estimated Time**: 15 minutes

```
11_assets/
├── good_asset_refs.txt           # Valid asset references
├── bad_asset_refs.txt            # 3 examples (GFX001, SND001, SND002)
├── graphics/
│   └── test_icon.dds             # Placeholder (can be empty file)
└── sounds/
    └── test_sound.ogg            # Placeholder (can be empty file)
```

---

## 🚀 EXECUTION PLAN

### Batch 1: High Priority (3-4 hours)
1. On-Actions (14 codes)
2. Decisions (4 codes)
3. Localization (13 codes)
**Result**: 95% coverage

### Batch 2: Completeness (2-3 hours)
4. Story Cycles (27 codes)
5. Interactions (3 codes)
6. Schemes (3 codes)
7. Assets (3 codes)
**Result**: 100% coverage

### Total Estimated Time: 5-7 hours

---

## ✅ CHECKLIST FOR EACH CATEGORY

For each category, ensure:
- [ ] `good_*.txt` file created with working examples
- [ ] `bad_*.txt` file created with error examples
- [ ] Every error code has at least one example
- [ ] Each example has `# ERROR CKxxxx` comment
- [ ] Examples are realistic CK3 patterns
- [ ] Good/bad separation is clear
- [ ] File is properly formatted (tabs, not spaces)

---

## 📝 NOTES

### Localization Special Requirements
- Must create actual `.yml` files (not `.txt`)
- Must test with UTF-8-BOM encoding
- Requires cross-file reference validation
- Needs fuzzy matching examples

### Asset Special Requirements
- Needs actual placeholder files (even if empty)
- Tests file existence on disk
- FMOD event path validation

### Story Cycles Complexity
- Most complex validation category
- 27 codes covering lifecycle, timing, structure
- Requires understanding of story cycle system

---

## 🎯 SUCCESS CRITERIA

### For Phase 2 Completion
- ✅ All high-priority categories have examples
- ✅ 95% error code coverage
- ✅ On-actions, decisions, and localization complete

### For 100% Completion
- ✅ Every error code has at least one example
- ✅ All categories have good/bad file pairs
- ✅ Documentation updated
- ✅ 100% error code coverage
- ✅ Ready for comprehensive unit testing
