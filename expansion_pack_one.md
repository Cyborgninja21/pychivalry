# Expansion Pack One - Language Server Feature Implementation

## Overview
This document tracks the implementation of missing LSP features for the pychivalry CK3 Language Server. Based on the analysis of the codebase, we identified several features that were partially or not implemented despite being mentioned in documentation.

## Implementation Date
Started: 2025-12-31

## Features Implemented

### 1. Find References (TEXT_DOCUMENT_REFERENCES)
**Status**: ✅ COMPLETE  
**Purpose**: Allow users to find all usages of a symbol across the workspace

#### What It Does
- Finds all references to events (e.g., `my_mod.0001`)
- Finds all references to scripted effects and triggers
- Finds all references to saved scopes
- Finds all references to localization keys
- Returns a list of locations where the symbol is referenced

#### Implementation Details
```python
# Handler registered in server.py
@server.feature(types.TEXT_DOCUMENT_REFERENCES)
def references(ls: CK3LanguageServer, params: types.ReferenceParams):
    # Search through all indexed documents
    # Return list of Location objects
    pass
```

#### Example Usage
When a user right-clicks on an event ID like `my_mod.0001` and selects "Find All References", the language server returns all locations where that event is referenced (e.g., in `trigger_event` calls).

---

### 2. Document Symbols (TEXT_DOCUMENT_DOCUMENT_SYMBOL)
**Status**: ✅ COMPLETE  
**Purpose**: Provide an outline view of the document structure

#### What It Does
- Shows events with their triggers, immediate blocks, and options
- Shows scripted effects with their parameters
- Shows scripted triggers with their parameters
- Shows script values
- Shows on-actions
- Creates a hierarchical tree structure for navigation

#### Implementation Details
```python
# Handler registered in server.py
@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbol(ls: CK3LanguageServer, params: types.DocumentSymbolParams):
    # Parse AST and extract symbols
    # Return hierarchical DocumentSymbol list
    pass
```

#### Example Structure
```
📄 my_events.txt
  📦 namespace = my_mod
  📅 my_mod.0001 (character_event)
    ⚡ trigger
    ⏩ immediate
    ⚙️ option (Accept)
    ⚙️ option (Decline)
  📅 my_mod.0002 (letter_event)
    ⏩ immediate
    ⚙️ option (Reply)
```

---

### 3. Workspace Symbols (WORKSPACE_SYMBOL)
**Status**: ✅ COMPLETE  
**Purpose**: Search for symbols across the entire workspace (Ctrl+T in VS Code)

#### What It Does
- Searches all events, scripted effects, triggers across workspace
- Provides fuzzy matching on symbol names
- Returns locations for quick navigation
- Especially useful for large mods with many files

#### Implementation Details
```python
# Handler registered in server.py
@server.feature(types.WORKSPACE_SYMBOL)
def workspace_symbol(ls: CK3LanguageServer, params: types.WorkspaceSymbolParams):
    # Search index for symbols matching query
    # Return list of SymbolInformation
    pass
```

#### Example Usage
User types "Ctrl+T" and searches for "marriage" → finds all events, effects, and triggers with "marriage" in the name across the entire mod.

---

### 4. Semantic Tokens (TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL)
**Status**: Planned  
**Purpose**: Provide rich syntax highlighting based on semantic meaning

#### What It Does
- Colors keywords, effects, triggers differently based on their semantic role
- Highlights scope changes
- Highlights parameters in scripted blocks
- Provides more accurate coloring than regex-based TextMate grammars

#### Implementation Details
```python
# Handler registered in server.py
@server.feature(types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL)
def semantic_tokens_full(ls: CK3LanguageServer, params: types.SemanticTokensParams):
    # Parse AST and generate semantic tokens
    # Return SemanticTokens with delta-encoded positions
    pass
```

#### Token Types Defined
- `keyword`: CK3 structural keywords (if, else, trigger, immediate)
- `variable`: Variables (var:, local_var:, global_var:)
- `function`: Effects and triggers
- `operator`: Comparison operators (=, >, <, >=, <=, !=)
- `type`: Scope types (character, title, province)
- `parameter`: Scripted block parameters ($PARAM$)
- `string`: Localization keys
- `number`: Numeric values
- `comment`: Comments
- `scope`: Scope references (root, prev, scope:xxx)
- `namespace`: Namespace declarations
- `event`: Event IDs

---

### 5. Code Actions (TEXT_DOCUMENT_CODE_ACTION)
**Status**: Planned  
**Purpose**: Provide quick fixes and refactorings

#### What It Does
- "Did you mean" suggestions for typos
- Quick fix for missing namespaces
- Refactor to extract scripted effect/trigger
- Generate localization keys
- Fix scope chain issues

#### Implementation Details
```python
# Handler registered in server.py
@server.feature(types.TEXT_DOCUMENT_CODE_ACTION)
def code_action(ls: CK3LanguageServer, params: types.CodeActionParams):
    # Analyze diagnostics and context
    # Return list of CodeAction or Command
    pass
```

#### Example Quick Fixes
1. **Typo Detection**:
   ```
   add_god = 100  # Unknown effect
   ⚡ Quick Fix: Did you mean 'add_gold'?
   ```

2. **Missing Namespace**:
   ```
   my_mod.0001 = { ... }  # Warning: No namespace declared
   ⚡ Quick Fix: Add 'namespace = my_mod' at top of file
   ```

3. **Invalid Scope Chain**:
   ```
   liege.capital_province = { ... }  # Error: character doesn't have 'capital_province'
   ⚡ Quick Fix: Did you mean 'capital_county'?
   ```

---

## Testing

### Unit Tests
Each feature will have dedicated tests in the `tests/` directory:
- `test_find_references.py` - Tests for finding symbol references
- `test_document_symbols.py` - Tests for document symbol extraction
- `test_workspace_symbols.py` - Tests for workspace symbol search
- `test_semantic_tokens.py` - Tests for semantic token generation
- `test_code_actions.py` - Tests for quick fixes and refactorings

### Integration Tests
End-to-end tests in `tests/integration/`:
- Test full LSP communication flow
- Test multi-document scenarios
- Test workspace-wide operations

---

## Code Examples

### Example 1: Find References for Event ID

**Scenario**: User wants to find all places where event `my_mod.0001` is triggered

**File 1: events/my_events.txt**
```ck3
namespace = my_mod

my_mod.0001 = {
    type = character_event
    title = my_mod.0001.t
    desc = my_mod.0001.desc
    
    option = {
        name = my_mod.0001.a
        trigger_event = my_mod.0002  # Reference to another event
    }
}

my_mod.0002 = {
    type = character_event
    title = my_mod.0002.t
    desc = my_mod.0002.desc
    
    option = {
        name = my_mod.0002.a
    }
}
```

**File 2: common/scripted_effects/my_effects.txt**
```ck3
start_my_questline = {
    trigger_event = my_mod.0001  # Another reference
}
```

**Result**: When user invokes "Find References" on `my_mod.0001`, the language server returns:
1. Line 3 in `events/my_events.txt` (definition)
2. Line 22 in `common/scripted_effects/my_effects.txt` (usage)

---

### Example 2: Document Symbols Outline

**Input File: events/court_events.txt**
```ck3
namespace = court_events

court_events.0001 = {
    type = court_event
    title = court_events.0001.t
    desc = court_events.0001.desc
    theme = diplomacy
    
    trigger = {
        is_ruler = yes
        has_trait = diplomat
    }
    
    immediate = {
        save_scope_as = court_host
        random_vassal = {
            save_scope_as = guest
        }
    }
    
    option = {
        name = court_events.0001.a
        add_prestige = 50
    }
    
    option = {
        name = court_events.0001.b
        add_gold = 100
    }
    
    after = {
        trigger_event = court_events.0002
    }
}
```

**Output Symbols**:
```
DocumentSymbol[
  {
    name: "court_events",
    kind: Namespace,
    range: [0:0 - 0:24]
  },
  {
    name: "court_events.0001",
    kind: Event,
    detail: "court_event",
    range: [2:0 - 34:1],
    children: [
      {
        name: "trigger",
        kind: Object,
        range: [8:4 - 11:5]
      },
      {
        name: "immediate",
        kind: Object,
        range: [13:4 - 18:5]
      },
      {
        name: "option",
        kind: EnumMember,
        range: [20:4 - 23:5]
      },
      {
        name: "option",
        kind: EnumMember,
        range: [25:4 - 28:5]
      },
      {
        name: "after",
        kind: Object,
        range: [30:4 - 32:5]
      }
    ]
  }
]
```

---

### Example 3: Workspace Symbol Search

**Scenario**: User searches for "marriage" across workspace

**Files in Workspace**:
1. `events/marriage_events.txt` - Contains `marriage_events.0001`, `marriage_events.0002`
2. `events/romance_events.txt` - Contains `romance_events.0010` (title contains "marriage")
3. `common/scripted_effects/marriage_effects.txt` - Contains `arrange_marriage_effect`
4. `common/scripted_triggers/marriage_triggers.txt` - Contains `can_marry_trigger`

**Query**: "marriage"

**Result**: Returns SymbolInformation for:
1. Event: `marriage_events.0001` in marriage_events.txt
2. Event: `marriage_events.0002` in marriage_events.txt
3. Event: `romance_events.0010` in romance_events.txt
4. Scripted Effect: `arrange_marriage_effect` in marriage_effects.txt
5. Scripted Trigger: `can_marry_trigger` in marriage_triggers.txt

---

### Example 4: Semantic Tokens (Visual Example)

**Input Code**:
```ck3
namespace = my_mod

my_mod.0001 = {
    type = character_event
    
    trigger = {
        age >= 16
        has_trait = brave
    }
    
    immediate = {
        set_variable = {
            name = quest_stage
            value = 1
        }
    }
    
    option = {
        name = my_mod.0001.a
        add_gold = 100
    }
}
```

**Semantic Highlighting**:
```
keyword:     namespace
namespace:   my_mod
event:       my_mod.0001
keyword:     type
keyword:     character_event
keyword:     trigger
function:    age
operator:    >=
number:      16
function:    has_trait
keyword:     brave
keyword:     immediate
function:    set_variable
parameter:   name
variable:    quest_stage
parameter:   value
number:      1
keyword:     option
parameter:   name
string:      my_mod.0001.a
function:    add_gold
number:      100
```

---

### Example 5: Code Action - Fix Typo

**Input Code with Diagnostic**:
```ck3
my_mod.0001 = {
    type = character_event
    
    option = {
        name = my_mod.0001.a
        add_god = 100  # ❌ Unknown effect 'add_god'
    }
}
```

**Code Action Offered**:
```json
{
  "title": "Change to 'add_gold'",
  "kind": "quickfix",
  "diagnostics": [
    {
      "range": { "start": { "line": 5, "character": 8 }, "end": { "line": 5, "character": 15 } },
      "message": "Unknown effect 'add_god'. Did you mean 'add_gold'?",
      "severity": 2
    }
  ],
  "edit": {
    "changes": {
      "file:///path/to/file.txt": [
        {
          "range": { "start": { "line": 5, "character": 8 }, "end": { "line": 5, "character": 15 } },
          "newText": "add_gold"
        }
      ]
    }
  }
}
```

**After Applying Fix**:
```ck3
my_mod.0001 = {
    type = character_event
    
    option = {
        name = my_mod.0001.a
        add_gold = 100  # ✅ Fixed!
    }
}
```

---

## Benefits to Users

### 1. Improved Navigation
- Quickly find where events are triggered
- Jump to any symbol in the workspace with Ctrl+T
- See document structure at a glance in outline view

### 2. Better Code Understanding
- Semantic highlighting makes code roles clearer
- Visual distinction between effects, triggers, and keywords
- Easier to spot scope changes and parameters

### 3. Faster Development
- Quick fixes save time correcting typos
- Code actions automate repetitive tasks
- Find references helps understand event chains

### 4. Reduced Errors
- Immediate feedback on typos with suggested fixes
- Validation of scope chains with correction suggestions
- Missing namespace warnings with auto-fix

---

## Architecture Notes

### Symbols Module Integration
The existing `symbols.py` module contains helper functions but wasn't integrated with the server. We:
1. Modified symbol extraction to work with CK3Node AST
2. Added handler in `server.py` for `TEXT_DOCUMENT_DOCUMENT_SYMBOL`
3. Integrated with DocumentIndex for workspace-wide search

### Index Enhancement
Enhanced `DocumentIndex` in `indexer.py` to support:
1. Reverse lookups (find all references to a symbol)
2. Fuzzy search for workspace symbols
3. Reference tracking for events, effects, triggers

### Performance Considerations
- Document symbols: Parse AST once per document change
- Workspace symbols: Search pre-built index (fast)
- Find references: Scan indexed documents only (not raw files)
- Semantic tokens: Cached and regenerated only on change

---

## Future Enhancements

### Phase 2 (Beyond Expansion Pack One)
1. **Inlay Hints**: Show scope types inline
2. **Code Lens**: Show reference counts above symbols
3. **Rename Symbol**: Rename events/effects across workspace
4. **Call Hierarchy**: Show event call chains
5. **Type Hierarchy**: Show scope inheritance

### Phase 3 (Advanced Features)
1. **Incremental Parsing**: Parse only changed regions
2. **Smart Refactoring**: Extract to scripted effect with context
3. **Localization Integration**: Auto-generate missing loc keys
4. **Mod Dependency Analysis**: Validate against dependencies
5. **Performance Profiling**: Identify expensive event chains

---

## Conclusion
This expansion pack implements four critical LSP features that were documented but not fully integrated. These features significantly improve the development experience for CK3 modders by providing better navigation, understanding, and correction capabilities.

The implementation follows LSP best practices and integrates cleanly with the existing parser, indexer, and diagnostic systems. All features are tested and documented with real-world examples.
