# Trait Validation Implementation Plan

**Status:** 📋 Planning  
**Priority:** 🔴 High (foundational for option validation)  
**Effort:** Medium (~8-10 hours)  
**Impact:** High (validates 500+ trait references across mods)

---

## Overview

Implement comprehensive trait validation to detect invalid trait references in CK3 scripts. This addresses **CK3451: Invalid trait reference** and provides the foundation for broader option block validation (Phase 8).

### Current State
- ❌ No trait data files exist (`data/traits/` directory missing)
- ❌ No trait validation logic implemented
- ⚠️ Traits referenced in examples/docs but never validated
- ✅ Trait reference highlighting exists ([document_highlight.py](../pychivalry/document_highlight.py#L135))

### Goal
Enable the LSP to warn users when they reference non-existent traits like:
```pdx
has_trait = awesomeness  # ⚠️ CK3451: Unknown trait 'awesomeness'
add_trait = super_speed  # ⚠️ CK3451: Unknown trait 'super_speed'
```

---

## Phase 1: Data Collection & Organization

### Task 1.1: Create Trait Data Structure

**File:** `pychivalry/data/traits/personality.yaml`

Create YAML structure for personality traits:

```yaml
# Personality traits - affect character behavior and opinion
brave:
  category: personality
  opposites: [craven]
  level: 0
  description: "Character is brave and confident in battle"
  group: boldness

craven:
  category: personality
  opposites: [brave]
  level: 0
  description: "Character is cowardly and avoids combat"
  group: boldness

ambitious:
  category: personality
  opposites: [content]
  level: 0
  description: "Character seeks power and advancement"
  group: ambition

content:
  category: personality
  opposites: [ambitious]
  level: 0
  description: "Character is satisfied with their position"
  group: ambition

# ... Continue for all personality traits
```

**Trait Categories to Implement:**

| Category | File | Count (est.) | Priority |
|----------|------|--------------|----------|
| Personality | `personality.yaml` | ~40 | 🔴 High |
| Education | `education.yaml` | ~20 | 🔴 High |
| Lifestyle | `lifestyle.yaml` | ~30 | 🟡 Medium |
| Physical | `physical.yaml` | ~25 | 🟡 Medium |
| Health | `health.yaml` | ~20 | 🟡 Medium |
| Childhood | `childhood.yaml` | ~15 | 🟢 Low |
| Fame | `fame.yaml` | ~10 | 🟢 Low |
| Dynasty | `dynasty.yaml` | ~8 | 🟢 Low |
| Commander | `commander.yaml` | ~12 | 🟢 Low |
| Special | `special.yaml` | ~30 | 🟡 Medium |

**Total Estimated Traits:** ~210

### Task 1.2: Extract CK3 Trait List

**Data Sources:**
1. **Primary:** CK3 game files (`common/traits/*.txt`)
2. **Secondary:** CK3 Wiki (ck3.paradoxwikis.com/Traits)
3. **Validation:** Vanilla game installation

**Extraction Script:** `tools/extract_traits.py`

```python
"""
Extract trait definitions from CK3 game files.

Reads: <CK3_INSTALL>/game/common/traits/*.txt
Outputs: pychivalry/data/traits/*.yaml (categorized)
"""

import yaml
import re
from pathlib import Path
from typing import Dict, List

def parse_ck3_trait_file(file_path: Path) -> Dict[str, Dict]:
    """Parse a CK3 trait definition file."""
    # Implementation: Parse Paradox script format
    # Extract: name, category, opposites, level, desc_key
    pass

def categorize_traits(traits: Dict) -> Dict[str, List]:
    """Group traits by category for organized YAML files."""
    categories = {
        'personality': [],
        'education': [],
        'lifestyle': [],
        'physical': [],
        'health': [],
        'childhood': [],
        'fame': [],
        'dynasty': [],
        'commander': [],
        'special': []
    }
    # Categorization logic
    return categories

def write_yaml_files(categorized: Dict, output_dir: Path):
    """Write categorized traits to separate YAML files."""
    for category, traits in categorized.items():
        output_file = output_dir / f"{category}.yaml"
        with open(output_file, 'w') as f:
            yaml.dump(traits, f, default_flow_style=False, sort_keys=False)

if __name__ == "__main__":
    # Usage: python extract_traits.py --ck3-path "/path/to/ck3/install"
    pass
```

**Deliverable:**
- [ ] Extraction script created (`tools/extract_traits.py`)
- [ ] Script documentation (usage, requirements)
- [ ] Verification against wiki (cross-reference)

### Task 1.3: Manual Curation

After automated extraction, manually review and enhance trait data:

**Quality Checks:**
- Verify all opposites relationships are bidirectional
- Add missing descriptions for clarity
- Confirm trait groups are accurate
- Add level information (for tiered traits like stress levels)
- Document special behaviors (e.g., `incapable` prevents character control)

**Deliverable:**
- [ ] All 10 YAML files created and reviewed
- [ ] Opposites validated (bidirectional)
- [ ] Descriptions added for documentation

---

## Phase 2: Data Loading Infrastructure

### Task 2.1: Extend Data Loader

**File:** `pychivalry/data/__init__.py`

The trait loading function already exists but the directory is missing. Verify it works:

```python
def load_traits() -> Dict[str, Dict[str, Any]]:
    """Load trait definitions from data/traits/*.yaml files."""
    traits_dir = DATA_DIR / "traits"
    return load_all_files_in_directory(traits_dir)

def get_traits(use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """Get trait definitions with intelligent caching."""
    global _traits_cache
    if not use_cache or _traits_cache is None:
        _traits_cache = load_traits()
    return _traits_cache
```

**Testing:**
```python
def test_load_traits():
    """Test trait data loading."""
    traits = get_traits()
    
    # Verify expected traits exist
    assert 'brave' in traits
    assert 'craven' in traits
    assert 'ambitious' in traits
    
    # Verify structure
    assert traits['brave']['category'] == 'personality'
    assert 'craven' in traits['brave']['opposites']
    
    # Verify caching works
    traits2 = get_traits()
    assert traits is traits2  # Same object (cached)
```

**Deliverables:**
- [ ] Verify `load_traits()` works with new data files
- [ ] Add unit tests for trait loading
- [ ] Test cache functionality

### Task 2.2: Create Trait Query API

**File:** `pychivalry/traits.py` (NEW MODULE)

Create a dedicated module for trait operations:

```python
"""
Trait System for CK3 Scripts

DIAGNOSTIC CODES:
    TRAIT-001: Unknown trait reference
    TRAIT-002: Opposite traits both present
    TRAIT-003: Invalid trait category

MODULE OVERVIEW:
    Provides trait validation and query functions for CK3 scripts.
    All trait definitions are loaded from YAML files in data/traits/.

USAGE EXAMPLES:
    >>> # Check if trait exists
    >>> is_valid_trait('brave')
    True
    
    >>> # Get trait information
    >>> trait_info = get_trait_info('brave')
    >>> trait_info['opposites']
    ['craven']
    
    >>> # Check for opposite conflicts
    >>> are_opposite_traits('brave', 'craven')
    True
"""

from typing import Dict, List, Optional, Tuple
from pychivalry.data import get_traits
import logging

logger = logging.getLogger(__name__)

# Cache for fast lookups
_trait_set_cache: Optional[set] = None


def get_all_trait_names() -> set:
    """Get set of all valid trait names for fast membership testing."""
    global _trait_set_cache
    if _trait_set_cache is None:
        traits = get_traits()
        _trait_set_cache = set(traits.keys())
    return _trait_set_cache


def is_valid_trait(trait_name: str) -> bool:
    """
    Check if a trait name is valid.
    
    Args:
        trait_name: The trait to validate
        
    Returns:
        True if trait exists in CK3, False otherwise
        
    Examples:
        >>> is_valid_trait('brave')
        True
        >>> is_valid_trait('nonexistent')
        False
    """
    trait_names = get_all_trait_names()
    return trait_name in trait_names


def get_trait_info(trait_name: str) -> Optional[Dict]:
    """
    Get full information about a trait.
    
    Args:
        trait_name: The trait to query
        
    Returns:
        Trait data dictionary, or None if not found
        
    Examples:
        >>> info = get_trait_info('brave')
        >>> info['category']
        'personality'
        >>> info['opposites']
        ['craven']
    """
    traits = get_traits()
    return traits.get(trait_name)


def get_trait_category(trait_name: str) -> Optional[str]:
    """Get the category of a trait (personality, education, etc.)."""
    info = get_trait_info(trait_name)
    return info['category'] if info else None


def get_trait_opposites(trait_name: str) -> List[str]:
    """Get list of opposite traits that conflict with this one."""
    info = get_trait_info(trait_name)
    return info.get('opposites', []) if info else []


def are_opposite_traits(trait1: str, trait2: str) -> bool:
    """
    Check if two traits are opposites (mutually exclusive).
    
    Args:
        trait1: First trait name
        trait2: Second trait name
        
    Returns:
        True if traits are opposites, False otherwise
    """
    opposites1 = get_trait_opposites(trait1)
    return trait2 in opposites1


def get_traits_by_category(category: str) -> List[str]:
    """
    Get all traits in a specific category.
    
    Args:
        category: Category name (personality, education, etc.)
        
    Returns:
        List of trait names in that category
    """
    traits = get_traits()
    return [
        name for name, data in traits.items()
        if data.get('category') == category
    ]


def suggest_similar_traits(invalid_trait: str, max_suggestions: int = 3) -> List[str]:
    """
    Suggest similar valid traits for an invalid trait name.
    
    Uses Levenshtein distance to find close matches.
    
    Args:
        invalid_trait: The invalid trait name
        max_suggestions: Maximum number of suggestions to return
        
    Returns:
        List of suggested trait names
        
    Examples:
        >>> suggest_similar_traits('brav')
        ['brave']
        >>> suggest_similar_traits('ambitous')
        ['ambitious']
    """
    from pychivalry.code_actions import calculate_levenshtein_distance
    
    trait_names = get_all_trait_names()
    
    # Calculate distances
    distances = [
        (trait, calculate_levenshtein_distance(invalid_trait, trait))
        for trait in trait_names
    ]
    
    # Sort by distance and return top matches
    distances.sort(key=lambda x: x[1])
    return [trait for trait, _ in distances[:max_suggestions]]


def clear_cache():
    """Clear trait cache (for testing)."""
    global _trait_set_cache
    _trait_set_cache = None
```

**Deliverables:**
- [ ] Create `traits.py` module
- [ ] Implement all query functions
- [ ] Add comprehensive docstrings
- [ ] Write unit tests

---

## Phase 3: Validation Integration

### Task 3.1: Add Trait Reference Detection

**File:** `pychivalry/diagnostics.py`

Add trait validation to the diagnostic pipeline:

```python
def check_trait_references(ast: List[CK3Node], uri: str) -> List[Diagnostic]:
    """
    Validate trait references in has_trait, add_trait, remove_trait.
    
    Detects:
    - CK3451: Unknown trait referenced
    
    Args:
        ast: Parsed AST nodes
        uri: Document URI for diagnostics
        
    Returns:
        List of diagnostics for invalid trait references
    """
    from pychivalry.traits import is_valid_trait, suggest_similar_traits
    
    diagnostics = []
    
    # Trait reference effects/triggers
    trait_keywords = {'has_trait', 'add_trait', 'remove_trait'}
    
    def check_node(node: CK3Node):
        if node.key in trait_keywords and node.value:
            trait_name = node.value.strip()
            
            # Validate trait exists
            if not is_valid_trait(trait_name):
                # Get suggestions
                suggestions = suggest_similar_traits(trait_name)
                
                # Build message with suggestions
                message = f"Unknown trait '{trait_name}'"
                if suggestions:
                    message += f". Did you mean: {', '.join(suggestions)}?"
                
                diagnostics.append(Diagnostic(
                    range=node.range,
                    message=message,
                    severity=DiagnosticSeverity.Warning,
                    code="CK3451",
                    source="pychivalry",
                ))
        
        # Recurse into children
        for child in node.children:
            check_node(child)
    
    for node in ast:
        check_node(node)
    
    return diagnostics
```

**Integration Point:**

Update `collect_all_diagnostics()` to include trait checks:

```python
def collect_all_diagnostics(
    ast: List[CK3Node], uri: str, ls: LanguageServer
) -> List[Diagnostic]:
    """Collect all diagnostics for a document."""
    diagnostics = []
    
    # ... existing checks ...
    
    # Trait validation
    diagnostics.extend(check_trait_references(ast, uri))
    
    return diagnostics
```

**Deliverables:**
- [ ] Implement `check_trait_references()`
- [ ] Integrate into diagnostic pipeline
- [ ] Test with valid and invalid traits

### Task 3.2: Enhanced Code Actions

**File:** `pychivalry/code_actions.py`

Add quick fixes for invalid trait references:

```python
def create_trait_quick_fixes(
    diagnostic: Diagnostic, 
    document: Document
) -> List[CodeAction]:
    """
    Create quick fixes for CK3451 (invalid trait).
    
    Offers:
    1. Replace with suggested similar trait
    2. Add trait to custom traits (if in mod context)
    """
    if diagnostic.code != "CK3451":
        return []
    
    from pychivalry.traits import suggest_similar_traits
    
    actions = []
    
    # Extract trait name from diagnostic message
    match = re.search(r"Unknown trait '([^']+)'", diagnostic.message)
    if not match:
        return []
    
    invalid_trait = match.group(1)
    suggestions = suggest_similar_traits(invalid_trait)
    
    # Create fix for each suggestion
    for suggestion in suggestions:
        text_edit = TextEdit(
            range=diagnostic.range,
            new_text=suggestion
        )
        
        action = CodeAction(
            title=f"Change to '{suggestion}'",
            kind=CodeActionKind.QuickFix,
            diagnostics=[diagnostic],
            edit=WorkspaceEdit(
                changes={document.uri: [text_edit]}
            )
        )
        actions.append(action)
    
    return actions
```

**Deliverables:**
- [ ] Implement trait quick fixes
- [ ] Test suggestion accuracy
- [ ] Add to code action handler

### Task 3.3: Completion Enhancement

**File:** `pychivalry/completions.py`

Provide trait completions after `has_trait =`, `add_trait =`, `remove_trait =`:

```python
def get_trait_completions(
    line_text: str,
    position: Position
) -> Optional[List[CompletionItem]]:
    """
    Provide trait completions after trait keywords.
    
    Triggers on:
    - has_trait = |
    - add_trait = |
    - remove_trait = |
    """
    from pychivalry.traits import get_all_trait_names, get_trait_info
    
    # Check if we're after a trait keyword
    if not re.search(r'\b(has_trait|add_trait|remove_trait)\s*=\s*\S*$', line_text):
        return None
    
    trait_names = get_all_trait_names()
    completions = []
    
    for trait_name in sorted(trait_names):
        info = get_trait_info(trait_name)
        
        # Build detail and documentation
        detail = info.get('category', 'trait')
        opposites = info.get('opposites', [])
        
        docs = info.get('description', f"Trait: {trait_name}")
        if opposites:
            docs += f"\n\n**Opposite:** {', '.join(opposites)}"
        
        completion = CompletionItem(
            label=trait_name,
            kind=CompletionItemKind.Value,
            detail=detail,
            documentation=MarkupContent(
                kind=MarkupKind.Markdown,
                value=docs
            ),
            sort_text=f"trait_{trait_name}",
        )
        completions.append(completion)
    
    return completions
```

**Integration:**

Add to main completion handler:

```python
@server.feature(TEXT_DOCUMENT_COMPLETION)
def completions(params: CompletionParams):
    # ... existing logic ...
    
    # Check for trait completions
    trait_completions = get_trait_completions(line_text, position)
    if trait_completions:
        return CompletionList(is_incomplete=False, items=trait_completions)
    
    # ... rest of completions ...
```

**Deliverables:**
- [ ] Implement trait completions
- [ ] Test completion trigger
- [ ] Verify trait metadata displays

### Task 3.4: Hover Documentation

**File:** `pychivalry/hover.py`

Enhance hover to show trait details:

```python
def get_trait_hover(trait_name: str) -> Optional[str]:
    """
    Get hover documentation for a trait reference.
    
    Shows:
    - Trait description
    - Category
    - Opposite traits
    - Level (if applicable)
    """
    from pychivalry.traits import get_trait_info
    
    info = get_trait_info(trait_name)
    if not info:
        return None
    
    # Build markdown documentation
    docs = f"## Trait: {trait_name}\n\n"
    docs += info.get('description', '') + "\n\n"
    docs += f"**Category:** {info.get('category', 'unknown')}\n\n"
    
    opposites = info.get('opposites', [])
    if opposites:
        docs += f"**Opposite Traits:** {', '.join(opposites)}\n\n"
    
    level = info.get('level')
    if level is not None:
        docs += f"**Level:** {level}\n\n"
    
    group = info.get('group')
    if group:
        docs += f"**Group:** {group}\n\n"
    
    docs += "---\n\n"
    docs += f"*Valid in CK3 version 1.12+*"
    
    return docs
```

Update hover handler to detect trait references:

```python
@server.feature(TEXT_DOCUMENT_HOVER)
def hover(params: HoverParams):
    # ... existing logic ...
    
    # Check if hovering over trait reference
    if node.key in ['has_trait', 'add_trait', 'remove_trait']:
        trait_docs = get_trait_hover(node.value)
        if trait_docs:
            return Hover(
                contents=MarkupContent(
                    kind=MarkupKind.Markdown,
                    value=trait_docs
                ),
                range=node.range
            )
    
    # ... rest of hover logic ...
```

**Deliverables:**
- [ ] Implement trait hover
- [ ] Test hover display
- [ ] Verify markdown formatting

---

## Phase 4: Testing & Documentation

### Task 4.1: Unit Tests

**File:** `tests/test_traits.py` (NEW)

```python
"""
Unit tests for trait validation system.
"""
import pytest
from pychivalry.traits import (
    is_valid_trait,
    get_trait_info,
    get_trait_opposites,
    are_opposite_traits,
    suggest_similar_traits,
    get_traits_by_category
)
from pychivalry.data import get_traits


class TestTraitLoading:
    """Tests for trait data loading."""
    
    def test_traits_loaded(self):
        """Verify traits are loaded from YAML."""
        traits = get_traits()
        assert len(traits) > 0, "No traits loaded"
    
    def test_expected_traits_exist(self):
        """Common traits should be present."""
        assert is_valid_trait('brave')
        assert is_valid_trait('craven')
        assert is_valid_trait('ambitious')
        assert is_valid_trait('content')
        assert is_valid_trait('genius')
        assert is_valid_trait('quick')
        assert is_valid_trait('slow')
        assert is_valid_trait('imbecile')


class TestTraitValidation:
    """Tests for trait validation functions."""
    
    def test_valid_trait(self):
        """Valid traits should return True."""
        assert is_valid_trait('brave') is True
        assert is_valid_trait('genius') is True
    
    def test_invalid_trait(self):
        """Invalid traits should return False."""
        assert is_valid_trait('nonexistent') is False
        assert is_valid_trait('super_smart') is False
    
    def test_case_sensitive(self):
        """Trait validation is case-sensitive."""
        assert is_valid_trait('brave') is True
        assert is_valid_trait('Brave') is False
        assert is_valid_trait('BRAVE') is False


class TestTraitInfo:
    """Tests for trait information queries."""
    
    def test_get_trait_info(self):
        """Should return trait data dict."""
        info = get_trait_info('brave')
        assert info is not None
        assert info['category'] == 'personality'
        assert 'craven' in info['opposites']
    
    def test_get_invalid_trait_info(self):
        """Should return None for invalid trait."""
        info = get_trait_info('nonexistent')
        assert info is None
    
    def test_get_trait_opposites(self):
        """Should return opposite traits."""
        opposites = get_trait_opposites('brave')
        assert 'craven' in opposites
        
        opposites = get_trait_opposites('ambitious')
        assert 'content' in opposites
    
    def test_are_opposite_traits(self):
        """Should detect opposite traits."""
        assert are_opposite_traits('brave', 'craven') is True
        assert are_opposite_traits('craven', 'brave') is True
        assert are_opposite_traits('brave', 'ambitious') is False


class TestTraitSuggestions:
    """Tests for trait suggestion system."""
    
    def test_suggest_similar_traits(self):
        """Should suggest similar traits."""
        suggestions = suggest_similar_traits('brav')
        assert 'brave' in suggestions
        
        suggestions = suggest_similar_traits('ambitous')
        assert 'ambitious' in suggestions
    
    def test_suggest_limit(self):
        """Should respect max suggestions limit."""
        suggestions = suggest_similar_traits('trait', max_suggestions=2)
        assert len(suggestions) <= 2


class TestTraitCategories:
    """Tests for trait categorization."""
    
    def test_get_traits_by_category(self):
        """Should return traits in category."""
        personality = get_traits_by_category('personality')
        assert 'brave' in personality
        assert 'ambitious' in personality
        
        education = get_traits_by_category('education')
        assert len(education) > 0


class TestTraitDiagnostics:
    """Integration tests for trait diagnostics."""
    
    def test_invalid_trait_diagnostic(self):
        """Should emit CK3451 for invalid trait."""
        from pychivalry.parser import parse_document
        from pychivalry.diagnostics import check_trait_references
        
        code = """
        trigger = {
            has_trait = nonexistent_trait
        }
        """
        
        ast = parse_document(code, "test.txt")
        diagnostics = check_trait_references(ast, "test.txt")
        
        assert len(diagnostics) > 0
        assert diagnostics[0].code == "CK3451"
        assert "nonexistent_trait" in diagnostics[0].message
    
    def test_valid_trait_no_diagnostic(self):
        """Should not emit diagnostic for valid trait."""
        from pychivalry.parser import parse_document
        from pychivalry.diagnostics import check_trait_references
        
        code = """
        trigger = {
            has_trait = brave
        }
        """
        
        ast = parse_document(code, "test.txt")
        diagnostics = check_trait_references(ast, "test.txt")
        
        assert len(diagnostics) == 0
```

**Deliverables:**
- [ ] Create comprehensive test suite
- [ ] Test all trait functions
- [ ] Test diagnostic integration
- [ ] Achieve >90% coverage

### Task 4.2: Integration Tests

**File:** `tests/test_trait_integration.py` (NEW)

```python
"""
Integration tests for trait validation in LSP.
"""
import pytest
from lsprotocol import types
from tests.conftest import create_test_client


def test_trait_completion(client):
    """Test trait completions after has_trait ="""
    document_uri = "file:///test.txt"
    content = "trigger = {\n    has_trait = "
    
    client.text_document_did_open(document_uri, content)
    
    completions = client.text_document_completion(
        document_uri,
        types.Position(line=1, character=16)
    )
    
    # Should have trait completions
    labels = [c.label for c in completions.items]
    assert 'brave' in labels
    assert 'ambitious' in labels


def test_trait_hover(client):
    """Test hover on trait reference."""
    document_uri = "file:///test.txt"
    content = "trigger = { has_trait = brave }"
    
    client.text_document_did_open(document_uri, content)
    
    hover = client.text_document_hover(
        document_uri,
        types.Position(line=0, character=25)  # On 'brave'
    )
    
    assert hover is not None
    assert 'brave' in hover.contents.value
    assert 'craven' in hover.contents.value  # Opposite


def test_invalid_trait_diagnostic(client):
    """Test diagnostic for invalid trait."""
    document_uri = "file:///test.txt"
    content = "trigger = { has_trait = invalid_trait }"
    
    client.text_document_did_open(document_uri, content)
    
    # Wait for diagnostics
    diagnostics = client.wait_for_diagnostics(document_uri)
    
    assert len(diagnostics) > 0
    diag = next(d for d in diagnostics if d.code == "CK3451")
    assert 'invalid_trait' in diag.message


def test_trait_quick_fix(client):
    """Test quick fix for invalid trait."""
    document_uri = "file:///test.txt"
    content = "trigger = { has_trait = brav }"  # Typo
    
    client.text_document_did_open(document_uri, content)
    diagnostics = client.wait_for_diagnostics(document_uri)
    
    # Get code actions
    diag = next(d for d in diagnostics if d.code == "CK3451")
    actions = client.text_document_code_action(
        document_uri,
        diag.range,
        [diag]
    )
    
    # Should have quick fix to change to 'brave'
    assert len(actions) > 0
    fix = next(a for a in actions if 'brave' in a.title)
    assert fix.edit is not None
```

**Deliverables:**
- [ ] Integration tests with LSP client
- [ ] Test all LSP features (completion, hover, diagnostics, code actions)
- [ ] Verify end-to-end workflow

### Task 4.3: Documentation

**Update Files:**

1. **README.md** - Add trait validation to features list
2. **Wiki: CK3-Language-Features.md** - Document trait system
3. **Wiki: LSP-Diagnostics-Push.md** - Add CK3451 documentation
4. **Wiki: LSP-Completions.md** - Add trait completion section
5. **CHANGELOG.md** - Add trait validation entry

**Example Wiki Entry:**

```markdown
## Trait Validation

The language server validates all trait references against CK3's trait system.

### Supported Commands
- `has_trait` - Trigger to check for trait
- `add_trait` - Effect to add trait
- `remove_trait` - Effect to remove trait

### Features

**Invalid Trait Detection (CK3451)**
```pdx
trigger = {
    has_trait = super_smart  # ⚠️ Unknown trait 'super_smart'
}
```

**Trait Completions**
Type `has_trait = ` and get completions for all 200+ CK3 traits with:
- Trait category
- Opposite traits
- Description

**Hover Documentation**
Hover over any trait reference to see:
- Full trait description
- Category (personality, education, etc.)
- Opposite traits
- Trait group

**Quick Fixes**
Misspelled trait? Get suggestions:
```pdx
has_trait = brav  # Quick fix: Change to 'brave'
```

### Trait Categories
- **Personality** (40 traits): brave, ambitious, cruel, kind, etc.
- **Education** (20 traits): education_martial_1, education_diplomacy_4, etc.
- **Lifestyle** (30 traits): lifestyle_blademaster, lifestyle_poet, etc.
- **Physical** (25 traits): beauty_good, giant, dwarf, etc.
- **Health** (20 traits): ill, wounded, stressed_1, etc.
- **Childhood** (15 traits): bossy, pensive, rowdy, etc.
- **Fame** (10 traits): fame_1, fame_5, fame_9, etc.
- **Dynasty** (8 traits): house_head, dynasty_head, etc.
- **Commander** (12 traits): confident_fighter, cautious_leader, etc.
- **Special** (30 traits): incapable, immortal, pregnant, etc.
```

**Deliverables:**
- [ ] Update all documentation
- [ ] Add trait validation examples
- [ ] Create wiki pages

---

## Phase 5: Performance & Polish

### Task 5.1: Performance Testing

**Benchmark trait validation:**

```python
# tests/performance/test_trait_performance.py
import pytest
import time
from pychivalry.traits import is_valid_trait, get_all_trait_names

def test_trait_loading_time():
    """Trait loading should be fast (<100ms)."""
    start = time.time()
    traits = get_all_trait_names()
    elapsed = time.time() - start
    
    assert elapsed < 0.1, f"Trait loading took {elapsed}s"

def test_trait_validation_time():
    """Individual validation should be <1ms."""
    start = time.time()
    for _ in range(1000):
        is_valid_trait('brave')
    elapsed = time.time() - start
    
    avg = elapsed / 1000
    assert avg < 0.001, f"Validation took {avg}s per call"

def test_bulk_validation():
    """Validate 1000 traits in <100ms."""
    traits_to_check = ['brave', 'craven', 'ambitious'] * 334
    
    start = time.time()
    results = [is_valid_trait(t) for t in traits_to_check]
    elapsed = time.time() - start
    
    assert elapsed < 0.1, f"Bulk validation took {elapsed}s"
```

**Deliverables:**
- [ ] Performance benchmarks
- [ ] Verify caching effectiveness
- [ ] Profile memory usage

### Task 5.2: Error Handling

**Edge cases to handle:**

1. **Empty trait name**
   ```pdx
   has_trait =   # Empty value
   ```

2. **Trait in quotes**
   ```pdx
   has_trait = "brave"  # Should strip quotes
   ```

3. **Variable reference**
   ```pdx
   has_trait = var:trait_name  # Don't validate variables
   ```

4. **Scope reference**
   ```pdx
   has_trait = scope:enemy_trait  # Don't validate scopes
   ```

5. **Missing data files**
   - Handle gracefully if YAML files are missing
   - Log error but don't crash
   - Return empty trait set

**Deliverables:**
- [ ] Add edge case handling
- [ ] Test error scenarios
- [ ] Ensure graceful degradation

### Task 5.3: Configuration Options

**Add settings for trait validation:**

```json
// VS Code settings
{
  "pychivalry.validation.traits.enabled": true,
  "pychivalry.validation.traits.severity": "warning",
  "pychivalry.validation.traits.customTraitFiles": [
    "common/traits/custom_traits.txt"
  ]
}
```

**Implementation:**

```python
# pychivalry/config.py
def get_trait_validation_config(ls: LanguageServer) -> dict:
    """Get trait validation configuration."""
    config = ls.get_configuration("pychivalry.validation.traits")
    return {
        'enabled': config.get('enabled', True),
        'severity': config.get('severity', 'warning'),
        'custom_files': config.get('customTraitFiles', [])
    }
```

**Deliverables:**
- [ ] Add configuration options
- [ ] Implement custom trait file loading
- [ ] Document settings

---

## Deliverables Summary

### Code Files
- [ ] 10 YAML trait data files (`data/traits/*.yaml`)
- [ ] New module: `pychivalry/traits.py`
- [ ] Tool: `tools/extract_traits.py`
- [ ] Tests: `tests/test_traits.py`
- [ ] Tests: `tests/test_trait_integration.py`
- [ ] Tests: `tests/performance/test_trait_performance.py`

### Documentation
- [ ] This plan document (TRAIT_VALIDATION_PLAN.md)
- [ ] Updated README.md
- [ ] Updated CHANGELOG.md
- [ ] Wiki: CK3-Language-Features.md (trait section)
- [ ] Wiki: LSP-Diagnostics-Push.md (CK3451)
- [ ] Wiki: LSP-Completions.md (trait completions)

### Diagnostic Codes
- [ ] **CK3451**: Invalid trait reference (Warning)

---

## Timeline & Effort Estimates

| Phase | Tasks | Estimated Hours | Dependencies |
|-------|-------|-----------------|--------------|
| 1. Data Collection | Extract & curate trait data | 2-3 hours | CK3 game files access |
| 2. Infrastructure | Data loader, API module | 2 hours | Phase 1 complete |
| 3. Integration | Diagnostics, completions, hover, quick fixes | 2-3 hours | Phase 2 complete |
| 4. Testing | Unit + integration tests | 1-2 hours | Phase 3 complete |
| 5. Polish | Performance, edge cases, config | 1 hour | Phase 4 complete |

**Total Estimated Effort:** 8-11 hours

---

## Success Criteria

### Must Have ✅
- [ ] All 200+ CK3 traits loaded from YAML
- [ ] CK3451 diagnostic emitted for invalid traits
- [ ] Trait completions working after `has_trait =`, etc.
- [ ] Quick fixes suggest correct traits
- [ ] 90%+ test coverage
- [ ] Documentation updated

### Should Have 🎯
- [ ] Hover shows trait details (opposites, category, description)
- [ ] Performance <1ms per validation
- [ ] Edge cases handled gracefully
- [ ] Configuration options available

### Nice to Have 💡
- [ ] Support for custom mod traits
- [ ] Trait group validation (only one trait per group)
- [ ] Opposite trait conflict detection
- [ ] Usage statistics (most common traits)

---

## Future Enhancements

1. **Phase 8 Integration**: Use trait validation for option block validation (CK3451)
2. **Opposite Detection**: Warn when adding opposite traits simultaneously
3. **Trait Group Validation**: Ensure only one trait per personality group
4. **Custom Mod Traits**: Load traits from mod's `common/traits/` files
5. **Trait Level Validation**: Validate stress levels (1-3), fame levels (1-9)
6. **Documentation Links**: Link to CK3 wiki pages for each trait

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Incomplete trait list | High | Cross-reference with wiki, manual curation |
| CK3 updates add new traits | Medium | Document update process, semi-annual reviews |
| Performance issues with 200+ traits | Low | Use set-based lookups (O(1)), cache results |
| Missing CK3 game files for extraction | High | Provide pre-extracted YAML, document manual process |
| Trait categorization errors | Medium | Manual review, add tests for edge cases |

---

## Notes

- Trait data structure designed to be extensible for future validation needs
- Opposite trait validation (CK3452) can build on this infrastructure
- Consider submitting trait YAML to community as reference data
- Keep YAML files human-readable for easy community contributions
