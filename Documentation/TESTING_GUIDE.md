# Testing Guide for pychivalry Language Server

Complete guide to testing the pychivalry Language Server, including how to run tests, what each test type does, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Test Types](#test-types)
3. [Running Tests](#running-tests)
4. [Test Organization](#test-organization)
5. [Writing Tests](#writing-tests)
6. [Best Practices](#best-practices)
7. [CI/CD Integration](#cicd-integration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The pychivalry Language Server has a comprehensive test suite with **700+ tests** across multiple categories:

- **637 Unit Tests**: Test individual components in isolation
- **50+ Integration Tests**: Test components working together
- **30+ Performance Tests**: Verify speed and memory requirements
- **40+ Fuzzing Tests**: Test with random/malformed inputs
- **40+ Regression Tests**: Ensure fixed bugs stay fixed

**Total Coverage**: All 19 modules, all LSP features, all CK3 script constructs

---

## Test Types

### 1. Unit Tests (Current: 637 tests)

**What they test**: Individual functions and classes in isolation

**Location**: `tests/test_*.py`

**Example**:
```python
def test_parse_event():
    content = 'character_event = { id = test.001 }'
    doc = parse_document(content, "test.txt")
    assert doc.root is not None
```

**When to run**: Always - these are your primary tests

**Speed**: ⚡ Very fast (< 1 second for all)

---

### 2. Integration Tests (50+ tests)

**What they test**: Multiple components working together in realistic workflows

**Location**: `tests/integration/`

**Example workflows**:
- Open file → Get diagnostics → Apply code action → Verify fix
- Type code → Request completions → Accept → Verify result  
- Navigate definition → Modify → Find references → Verify updates

**When to run**: Before committing changes that affect multiple components

**Speed**: ⚡ Fast (< 5 seconds)

---

### 3. Performance Tests (30+ tests)

**What they test**: Response times, memory usage, scalability

**Location**: `tests/performance/`

**What's measured**:
- Parser speed on files of varying sizes (small/medium/large)
- Diagnostics response time
- Completion request latency
- Navigation speed across many files
- Memory usage with large workspace

**Thresholds**:
- Parser: < 100ms for 1000 line files
- Diagnostics: < 100ms per file
- Completions: < 50ms
- Navigation: < 50ms across 50+ files

**When to run**: After performance-related changes, before releases

**Speed**: 🐢 Slow (10-30 seconds)

---

### 4. Fuzzing Tests (40+ tests)

**What they test**: Robustness against random/malformed inputs

**Location**: `tests/fuzzing/`

**What's tested**:
- Parser handles arbitrary text without crashing
- Random bracket combinations
- Invalid UTF-8 sequences
- Extremely deep nesting (100+ levels)
- Edge cases (empty files, single characters, very long lines)

**Technology**: Uses `hypothesis` library for property-based testing

**When to run**: Weekly, before releases

**Speed**: 🐢 Slow (30-60 seconds with default settings)

---

### 5. Regression Tests (40+ tests)

**What they test**: Ensure previously fixed bugs don't come back

**Location**: `tests/regression/`

**Format**: Each test represents a real bug that was found and fixed

**Example**:
```python
def test_empty_file_no_crash():
    """Regression: Parser should handle empty files without crashing.
    
    Bug: Parser crashed on empty input files.
    Fixed: Added empty file handling in tokenizer.
    """
    result = parse_document("", "empty.txt")
    assert result is not None
```

**When to run**: Always (included in standard test run)

**Speed**: ⚡ Fast (< 2 seconds)

---

## Running Tests

### Prerequisites

Install test dependencies:
```bash
pip install -e ".[dev]"
```

This installs:
- `pytest` - Test runner
- `pytest-asyncio` - Async test support
- `pytest-benchmark` - Performance benchmarking
- `pytest-timeout` - Timeout protection
- `hypothesis` - Property-based testing
- `memory-profiler` - Memory profiling

### Basic Commands

**Run all tests**:
```bash
pytest tests/
```

**Run with verbose output**:
```bash
pytest tests/ -v
```

**Run with coverage report**:
```bash
pytest tests/ --cov=pychivalry --cov-report=html
```

### Run Specific Test Types

**Unit tests only** (fast):
```bash
pytest tests/ --ignore=tests/integration --ignore=tests/performance --ignore=tests/fuzzing
```

**Integration tests**:
```bash
pytest tests/integration/
```

**Performance tests**:
```bash
pytest tests/performance/
```

**Fuzzing tests**:
```bash
pytest tests/fuzzing/
```

**Regression tests**:
```bash
pytest tests/regression/
```

### Run Specific Test Files

```bash
# Single test file
pytest tests/test_parser.py

# Multiple test files
pytest tests/test_parser.py tests/test_scopes.py
```

### Run Specific Tests

```bash
# By test name
pytest tests/test_parser.py::test_parse_event

# By test class
pytest tests/test_parser.py::TestParserBasics

# By keyword match
pytest tests/ -k "parse"
```

### Advanced Options

**Parallel execution** (faster):
```bash
pytest tests/ -n auto
```
(Requires: `pip install pytest-xdist`)

**Stop on first failure**:
```bash
pytest tests/ -x
```

**Show print statements**:
```bash
pytest tests/ -s
```

**Run only failed tests from last run**:
```bash
pytest tests/ --lf
```

**Skip slow tests**:
```bash
pytest tests/ -m "not slow"
```

**Set custom timeout**:
```bash
pytest tests/ --timeout=30
```

### Performance Benchmarking

**Run performance tests with benchmarks**:
```bash
pytest tests/performance/ --benchmark-only
```

**Compare against baseline**:
```bash
# Save baseline
pytest tests/performance/ --benchmark-save=baseline

# Compare current against baseline
pytest tests/performance/ --benchmark-compare=baseline
```

**Set performance thresholds**:
```bash
pytest tests/performance/ --benchmark-max-time=0.1
```

### Fuzzing with More Examples

By default, fuzzing tests run 100 examples per test. To run more extensive fuzzing:

```bash
# Run 1000 examples per test
pytest tests/fuzzing/ --hypothesis-max-examples=1000

# Run 10,000 examples (very slow but thorough)
pytest tests/fuzzing/ --hypothesis-max-examples=10000
```

---

## Test Organization

```
tests/
├── test_*.py                    # Unit tests (637 tests)
│   ├── test_parser.py           # Parser tests (35)
│   ├── test_scopes.py           # Scope system tests (28)
│   ├── test_lists.py            # List validation tests (36)
│   ├── test_script_values.py    # Script values tests (44)
│   ├── test_variables.py        # Variables tests (64)
│   ├── test_scripted_blocks.py  # Scripted blocks tests (44)
│   ├── test_events.py           # Event system tests (45)
│   ├── test_diagnostics.py      # Diagnostics tests (8)
│   ├── test_completions.py      # Completions tests (36)
│   ├── test_hover.py            # Hover tests (18)
│   ├── test_localization.py     # Localization tests (48)
│   ├── test_navigation.py       # Navigation tests (28)
│   ├── test_symbols.py          # Symbols tests (32)
│   ├── test_code_actions.py     # Code actions tests (40)
│   ├── test_workspace.py        # Workspace tests (36)
│   └── ...
│
├── integration/                 # Integration tests (50+)
│   └── test_lsp_workflows.py    # End-to-end LSP workflows
│
├── performance/                 # Performance tests (30+)
│   └── test_benchmarks.py       # Speed and memory benchmarks
│
├── fuzzing/                     # Fuzzing tests (40+)
│   └── test_property_based.py   # Property-based testing
│
├── regression/                  # Regression tests (40+)
│   └── test_bug_fixes.py        # Previously fixed bugs
│
├── conftest.py                  # Shared pytest fixtures
└── fixtures/                    # Test data files
```

---

## Writing Tests

### Unit Test Template

```python
def test_my_feature():
    """Test description."""
    # Arrange: Set up test data
    content = "..."
    
    # Act: Execute the code being tested
    result = my_function(content)
    
    # Assert: Verify the results
    assert result is not None
    assert result.property == expected_value
```

### Integration Test Template

```python
class TestMyWorkflow:
    """Test end-to-end workflow."""
    
    def test_complete_workflow(self):
        """Test: Step 1 → Step 2 → Step 3 → Verify."""
        # 1. Setup
        doc = parse_document(content, "test.txt")
        index = DocumentIndex()
        index.index_document("test.txt", doc)
        
        # 2. Execute workflow
        result1 = step1(doc)
        result2 = step2(result1)
        result3 = step3(result2, index)
        
        # 3. Verify final state
        assert result3 == expected
```

### Performance Test Template

```python
def test_my_performance(benchmark):
    """Benchmark my function."""
    # Setup
    data = create_test_data()
    
    # Benchmark
    result = benchmark(my_function, data)
    
    # Verify
    assert result is not None
```

### Fuzzing Test Template

```python
from hypothesis import given, strategies as st

@given(st.text())
def test_handles_arbitrary_input(text):
    """Test function handles any text input."""
    try:
        result = my_function(text)
        assert result is not None
    except Exception as e:
        pytest.fail(f"Crashed on: {repr(text[:100])}\nError: {e}")
```

### Regression Test Template

```python
def test_bug_xyz_fixed():
    """Regression: Bug #XYZ should not happen again.
    
    Bug: Description of the bug
    Fixed: Description of the fix
    """
    # Reproduce the condition that caused the bug
    content = "..."
    
    # Execute
    result = my_function(content)
    
    # Verify bug doesn't occur
    assert result != buggy_behavior
    assert result == correct_behavior
```

---

## Best Practices

### 1. Test Naming

**Good**:
- `test_parse_event_with_options`
- `test_diagnostics_detects_typo`
- `test_completions_after_dot`

**Bad**:
- `test1`
- `test_stuff`
- `test_it_works`

### 2. Test Organization

- Group related tests in classes
- Use descriptive class names: `TestEventValidation`, `TestScopeChains`
- One test file per module: `test_parser.py` for `parser.py`

### 3. Test Independence

- Tests should not depend on each other
- Each test should set up its own data
- Use fixtures for shared setup (see `conftest.py`)

### 4. Assertions

**Good**:
```python
assert len(results) == 3
assert result.name == "expected_name"
assert "error" in message.lower()
```

**Bad**:
```python
assert len(results)  # What's the expected length?
assert result  # What makes a result "truthy"?
```

### 5. Test Coverage

Aim for:
- **90%+ line coverage** for core modules
- **100% coverage** for critical paths (parser, diagnostics)
- **Edge case coverage**: Empty inputs, boundary conditions, error cases

### 6. Performance Tests

- Use `benchmark` fixture for accurate timing
- Set clear thresholds
- Test realistic data sizes
- Don't mark all tests as performance tests (too slow)

### 7. Fuzzing Tests

- Use `@given` decorator with appropriate strategies
- Set reasonable `max_examples` (100-500 for normal, 1000+ for thorough)
- Always handle exceptions - fuzzing should never crash
- Verify properties (invariants) rather than specific outputs

### 8. Regression Tests

- Document the bug in the test docstring
- Include bug number/reference if available
- Explain what was fixed
- Make the test fail if the bug reoccurs

---

## CI/CD Integration

### GitHub Actions

The tests run automatically on:
- Every push to any branch
- Every pull request
- Scheduled nightly builds

**Workflow file**: `.github/workflows/test.yml`

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: pip install -e ".[dev]"
      
      - name: Run unit tests
        run: pytest tests/ --ignore=tests/performance --ignore=tests/fuzzing
      
      - name: Run integration tests
        run: pytest tests/integration/
      
      - name: Run regression tests
        run: pytest tests/regression/
```

### Pre-commit Hooks

Run tests automatically before committing:

**Setup** (`.git/hooks/pre-commit`):
```bash
#!/bin/bash
pytest tests/ --ignore=tests/performance --ignore=tests/fuzzing -x
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### Test Stages

**Stage 1: Fast Tests** (Run always)
- Unit tests
- Integration tests
- Regression tests
- **Time**: < 10 seconds

**Stage 2: Performance Tests** (Run before releases)
- Benchmark tests
- Memory profiling
- **Time**: 30-60 seconds

**Stage 3: Extended Fuzzing** (Run weekly)
- Fuzzing with 10,000 examples per test
- **Time**: 5-10 minutes

---

## Troubleshooting

### Common Issues

**Problem**: `ModuleNotFoundError: No module named 'pychivalry'`

**Solution**: Install in editable mode:
```bash
pip install -e .
```

---

**Problem**: Tests are slow

**Solutions**:
```bash
# Skip slow tests
pytest tests/ -m "not slow"

# Run in parallel
pip install pytest-xdist
pytest tests/ -n auto

# Run only failed tests
pytest tests/ --lf
```

---

**Problem**: `hypothesis` tests failing with "Unsatisfiable"

**Solution**: Adjust strategies or add `@settings`:
```python
@settings(suppress_health_check=[HealthCheck.too_slow])
```

---

**Problem**: Performance tests failing intermittently

**Solution**: System load affects timing. Run on isolated system or increase thresholds slightly.

---

**Problem**: Import errors in tests

**Solution**: Check your `PYTHONPATH` or use:
```bash
python -m pytest tests/
```

---

### Debug Mode

Run tests with full debug output:

```bash
pytest tests/ -vv -s --tb=short
```

Options:
- `-vv`: Very verbose
- `-s`: Show print statements
- `--tb=short`: Shorter tracebacks

---

### Coverage Analysis

Generate coverage report:

```bash
# Terminal report
pytest tests/ --cov=pychivalry

# HTML report
pytest tests/ --cov=pychivalry --cov-report=html

# Open report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

Find untested code:

```bash
pytest tests/ --cov=pychivalry --cov-report=term-missing
```

---

## Summary

### Quick Reference

| Task | Command |
|------|---------|
| Run all tests | `pytest tests/` |
| Run fast tests only | `pytest tests/ --ignore=tests/performance --ignore=tests/fuzzing` |
| Run specific test | `pytest tests/test_parser.py::test_parse_event` |
| Run with coverage | `pytest tests/ --cov=pychivalry --cov-report=html` |
| Run performance tests | `pytest tests/performance/` |
| Run fuzzing tests | `pytest tests/fuzzing/` |
| Stop on first failure | `pytest tests/ -x` |
| Show print output | `pytest tests/ -s` |
| Parallel execution | `pytest tests/ -n auto` |

### Test Count Summary

- **Unit Tests**: 637 ✅
- **Integration Tests**: 50+ ✅
- **Performance Tests**: 30+ ✅
- **Fuzzing Tests**: 40+ ✅
- **Regression Tests**: 40+ ✅
- **Total**: 700+ tests

### Coverage

- **Modules**: 19/19 (100%)
- **LSP Features**: All implemented
- **CK3 Constructs**: Comprehensive

---

**For more information**, see:
- Test files in `tests/` directory
- Module documentation in `Documentation/` folder
- GitHub Actions workflow in `.github/workflows/`

---

*Last updated: 2025-01-01*
*pychivalry Language Server v1.0.0*
