# [CONTENT_TYPE] Schema Onboarding Plan

**Status:** Planning | In Progress | Complete  
**Priority:** Low | Medium | High  
**Estimated Effort:** ~X-Y hours  
**Source:** Analysis of `_[content_type].info` and X base game files

---

## 1. Current State

From `feature_matrix.md`:

| Aspect | Current Status |
|--------|----------------|
| Location | `common/[folder]/` |
| Required Fields | ❌ Not validated |
| Effect/Trigger Context | ⚠️ Generic only |
| Scope Chains | ✅ Working |
| Cross-File Refs | ❌ Not indexed |
| Schema Status | 🔄 Planned |

---

## 2. Content Type Overview

Brief description of what this content type does and how it's used in CK3.

### Subdirectories (if applicable)

| Subdirectory | Files | Purpose | Schema Priority |
|--------------|-------|---------|-----------------|
| `[main]/` | X | Main definitions | **HIGH** |
| `[secondary]/` | X | Secondary definitions | Medium |
| `[tertiary]/` | X | Support files | Low |

**Focus:** Start with `[main]/` as it contains the core content modders create.

---

## 3. Complete Field Reference

Based on `_[content_type].info` (official documentation) and analysis of base game files.

### 3.1 Core Required Fields

| Field | Type | Scope | Required | Description |
|-------|------|-------|----------|-------------|
| `field_1` | trigger | `root = X` | ✅ **YES** | Description |
| `field_2` | effect | `root = X` | ✅ **YES** | Description |

### 3.2 Optional Trigger Blocks

| Field | Type | Scope | Description |
|-------|------|-------|-------------|
| `trigger_1` | trigger | `root = X` | Description |
| `trigger_2` | trigger | `root = X` | Description |

### 3.3 Optional Effect Blocks

| Field | Type | Scope | Description |
|-------|------|-------|-------------|
| `effect_1` | effect | `root = X` | Description |
| `effect_2` | effect | `root = X` | Description |

### 3.4 Simple Parameters

| Field | Type | Default | Values/Range | Description |
|-------|------|---------|--------------|-------------|
| `param_1` | bool | `yes` | yes/no | Description |
| `param_2` | enum | `value` | `a`, `b`, `c` | Description |
| `param_3` | int | 0 | 0-100 | Description |

### 3.5 Enum Fields

| Field | Valid Values |
|-------|--------------|
| `enum_field` | `value_1`, `value_2`, `value_3` |

### 3.6 Numeric Parameters

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `numeric_1` | script_value | - | Description |
| `numeric_2` | int | - | Description |

### 3.7 Duration Parameters

| Field | Format | Description |
|-------|--------|-------------|
| `duration_1` | `{ days/months/years = X }` | Description |

### 3.8 AI Configuration

| Field | Type | Description |
|-------|------|-------------|
| `ai_will_do` | script_value | AI likelihood |

### 3.9 Cost Structure (if applicable)

```pdx
cost = {
    gold = { <script_value> }
    piety = { <script_value> }
    prestige = { <script_value> }
}
```

### 3.10 Nested Structures

```pdx
nested_block = {
    <key> = {
        field_1 = value
        field_2 = { <triggers> }
    }
}
```

---

## 4. Nested Schema: [NESTED_TYPE] (if applicable)

Description of nested structure requirements.

### 4.1 Required Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `nested_field_1` | type | ✅ **YES** | - | Description |

### 4.2 Optional Fields

| Field | Scope | Description |
|-------|-------|-------------|
| `nested_optional_1` | `root = X` | Description |

---

## 5. Subdirectory Schemas (Secondary Priority)

### 5.1 [Subdirectory Name]

```pdx
<key> = {
    field_1 = { <triggers> }
    field_2 = { <effects> }
}
```

---

## 6. Required Work Items

### 6.1 Create Schema File

**File:** `pychivalry/data/schemas/[content_type].yaml`

**Estimated Fields:** ~X top-level, ~Y nested fields

### 6.2 Add Diagnostic Codes

| Code | Severity | Description |
|------|----------|-------------|
| [PREFIX]001 | Error | Missing required `field_1` |
| [PREFIX]002 | Error | Missing required `field_2` |
| [PREFIX]003 | Warning | Optional best practice |

### 6.3 Implementation Phases

**Phase 1 - Core Structure (X hours)**
- Required fields
- Basic enums

**Phase 2 - Complete Fields (X hours)**
- All optional blocks
- AI configuration

**Phase 3 - Nested Structures (X hours)**
- Complex nested validation

---

## 7. Validation Priority Matrix

| Priority | Field/Block | Reason |
|----------|-------------|--------|
| P0 | Required fields | Content won't function without |
| P1 | Common enums | Frequent error source |
| P2 | Optional blocks | Nice to have |
| P3 | Graphics/cosmetic | Low priority |

---

## 8. Cross-Reference Index

| Reference Type | Location | Indexing Needed |
|----------------|----------|-----------------|
| `reference_1` | `folder/` | Yes/No |
| `reference_2` | `folder/` | Yes/No |

---

## 9. Success Criteria

- [ ] Content type appears in Table 1 of feature_matrix.md
- [ ] Required fields validated
- [ ] Diagnostic codes documented
- [ ] Test fixture passes validation
- [ ] No regression in existing validation

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk description | Impact level | Mitigation strategy |

---

## 11. Next Steps After Completion

1. Related schema 1
2. Related schema 2
3. Cross-file indexing
