# Test Implementation Notes

## Current Status Summary

| Test Type | Tests | Status | Passing |
|-----------|-------|--------|---------|
| **Unit Tests** | 1126 | ✅ Fully Working | 1126/1126 |
| **Integration Tests** | 7 | ❌ Broken | 1/7 |
| **Performance Tests** | 12 | ❌ Broken | 0/12 |
| **Regression Tests** | 18 | ⚠️ Partial | 11/18 (3 skipped, 4 failing) |

**Last tested: 2025-12-31** - Total: 22 failed, 1126 passed, 3 skipped

**Unit tests are fully functional and comprehensive.** The newer test categories (integration, performance, regression) have API misalignments that prevent them from running correctly.

---

## Critical API Misalignments

The test files were written against an assumed API that doesn't match the actual implementation. Here are the key discrepancies:

### 1. Parser Returns List, Not Document Object

**Test assumes:**
```python
doc = parse_document(content, "test.txt")
doc.root.children[0]  # Access AST as property
```

**Actual API:**
```python
ast = parse_document(content)  # Returns List[CK3Node], NOT a document object
ast[0]  # Direct list access
```

### 2. `collect_all_diagnostics()` Requires AST Parameter

**Test assumes:**
```python
diagnostics = collect_all_diagnostics(doc)  # Single argument
```

**Actual API:**
```python
diagnostics = collect_all_diagnostics(doc, ast, index)  # Requires TextDocument + AST + optional index
# Or use convenience function:
diagnostics = get_diagnostics_for_text(text, uri, index)  # Takes raw text
```

### 3. `get_context_aware_completions()` Signature

**Test assumes:**
```python
completions = get_context_aware_completions(doc, ast, position, index)
```

**Actual API:**
```python
completions = get_context_aware_completions(
    document_uri="file:///test.txt",
    position=types.Position(line=X, character=Y),
    ast=ast[0] if ast else None,  # Single node, not list
    line_text="actual line content",
    document_index=index
)
```

### 4. Position Type

**Test assumes:**
```python
position = (5, 16)  # Tuple
```

**Actual API:**
```python
position = types.Position(line=5, character=16)  # LSP Position object
```

### 5. `find_definition()` / `find_references()` Signatures

**Test assumes:**
```python
find_definition(event_doc, Position(...), index)  # LSP Position object
```

**Actual API:**
```python
find_definition(document, position, index)  # position is Tuple[int, int]
# Note: The wrapper unpacks: line, character = position
```

### 6. `DocumentIndex` Methods

**Test assumes:**
```python
index.index_document("events.txt", doc)  # index_document method
```

**Actual API:**
```python
index.update_from_ast("events.txt", ast)  # update_from_ast method
```

### 7. Missing Dependencies

**pytest-benchmark not installed:**
```
fixture 'benchmark' not found
```

**hypothesis not installed:**
```
ModuleNotFoundError: No module named 'hypothesis'
```

---

## Required Fixes by Test File

### `tests/integration/test_lsp_workflows.py`

1. Change `parse_document(content, "test.txt")` → `parse_document(content)`
2. Import `TextDocument` from `pygls.workspace` instead of `TextDocumentItem`
3. Use `get_diagnostics_for_text(content)` for convenience
4. Fix `get_context_aware_completions()` calls with correct signature
5. Fix `find_definition()` calls: pass tuple position, not Position object
6. Replace `index.index_document()` → `index.update_from_ast()`
7. Access AST as list, not `doc.root`

### `tests/performance/test_benchmarks.py`

1. Install `pytest-benchmark`: `pip install pytest-benchmark`
2. Change `parse_document(content, filename)` → `parse_document(content)`
3. Fix `get_context_aware_completions()` signature
4. Replace `index.index_document()` → `index.update_from_ast()`

### `tests/fuzzing/test_property_based.py`

1. Install `hypothesis`: `pip install hypothesis`
2. Change `parse_document(content, filename)` → `parse_document(content)` 
3. Parser returns `List[CK3Node]`, not object with `.root`
4. Fix `get_context_aware_completions()` signature

### `tests/regression/test_bug_fixes.py`

1. Parser returns list: `result = parse_document("")` returns `[]`, not object with `.root`
2. Fix `collect_all_diagnostics()` - pass AST parameter
3. Fix `find_definition()` position format
4. Some tests need `validate_event_structure` which isn't implemented (correctly skipped)

---

## Quick Fix Script

To install missing dependencies:
```bash
pip install pytest-benchmark hypothesis memory-profiler
```

---

## Recommended Approach

**Option A: Fix Test Files (Recommended)**

Update all test files to use the correct API signatures. This is the right approach because:
- Tests should match actual API
- No production code changes required
- Maintains API consistency

**Option B: Add Wrapper Functions**

Create a test utilities module with convenience wrappers. Less ideal because:
- Adds maintenance burden
- Hides actual API from tests
- Could mask real API issues

---

## Test Dependencies Status

| Package | Required | Installed | Notes |
|---------|----------|-----------|-------|
| pytest | >=7.0.0 | ✅ Yes | Core test runner |
| pytest-asyncio | >=0.21.0 | ⚠️ Unknown | Config warning suggests issue |
| pytest-benchmark | >=4.0.0 | ❌ No | Performance tests fail |
| pytest-timeout | >=2.1.0 | ⚠️ Unknown | - |
| hypothesis | >=6.0.0 | ❌ No | Fuzzing tests fail to import |
| memory-profiler | >=0.61.0 | ⚠️ Unknown | - |

**Note:** The `asyncio_mode = "auto"` config in `pyproject.toml` generates a warning. This setting may need to be updated for the installed version of pytest-asyncio.

---

## Working Tests Summary

The following test files work correctly (1126 tests total):

- `test_parser.py` - Parser functionality
- `test_scopes.py` - Scope validation
- `test_lists.py` - List iterators
- `test_script_values.py` - Script value handling
- `test_variables.py` - Variable management
- `test_scripted_blocks.py` - Scripted effects/triggers
- `test_events.py` - Event validation
- `test_diagnostics.py` - Error detection
- `test_completions.py` - Code completions
- `test_hover.py` - Hover information
- `test_localization.py` - Localization features
- `test_navigation.py` - Go to definition
- `test_symbols.py` - Document symbols
- `test_code_actions.py` - Quick fixes
- `test_workspace.py` - Workspace features
- `test_folding.py` - Code folding
- `test_formatting.py` - Code formatting
- `test_semantic_tokens.py` - Syntax highlighting
- `test_signature_help.py` - Signature help
- `test_rename.py` - Rename symbol
- `test_inlay_hints.py` - Inlay hints
- `test_document_highlight.py` - Highlight occurrences
- `test_document_links.py` - Document links
- `test_indexer.py` - Document indexing
- `test_code_lens.py` - Code lens
- `test_server*.py` - Server tests

---

## Next Steps

1. **Install missing dependencies**: `pip install pytest-benchmark hypothesis`
2. **Fix API calls** in integration/performance/fuzzing/regression tests
3. **Fix pytest-asyncio config** warning in pyproject.toml
4. **Register custom marks** for `@pytest.mark.slow`
5. **Add tests to CI/CD** once fixed

---

*Last updated: 2024-12-31*
