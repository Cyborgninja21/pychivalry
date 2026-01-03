# Test Writing Best Practices

**Purpose:** Guidelines and patterns for writing high-quality tests in pychivalry using pytest.

**Use this when:** Adding new tests, improving test coverage, or refactoring existing tests.

---

## Test Philosophy

### Test Pyramid
```
         /\
        /  \    Few: End-to-End Tests
       /____\
      /      \  Some: Integration Tests
     /________\
    /          \ Many: Unit Tests
   /____________\
```

**Focus:** Most tests should be fast unit tests; fewer integration tests; minimal E2E tests.

## Test Organization

### Directory Structure
```
tests/
├── conftest.py                 # Shared fixtures
├── test_parser.py              # Parser unit tests
├── test_scopes.py              # Scope validation tests
├── test_diagnostics.py         # Diagnostics tests
├── test_completions.py         # Completion tests
├── integration/                # Integration tests
│   ├── test_full_workflow.py
│   └── test_server_lifecycle.py
├── fixtures/                   # Test data files
│   ├── sample_events.txt
│   └── large_file.txt
└── performance/                # Performance tests
    └── test_benchmarks.py
```

### Naming Conventions

```python
# Test files: test_*.py
# Test functions: test_*
# Test classes: Test*

def test_parser_handles_empty_input():
    """Test that parser handles empty input gracefully."""
    pass

def test_scope_validation_detects_invalid_transition():
    """Test scope validator catches invalid transitions."""
    pass

class TestCompletionProvider:
    """Tests for completion provider."""
    
    def test_provides_keyword_completions(self):
        pass
    
    def test_filters_by_context(self):
        pass
```

## Unit Test Patterns

### Basic Unit Test Structure

```python
def test_feature():
    """Clear description of what is being tested."""
    # Arrange: Set up test data
    input_data = "test input"
    expected_output = "expected result"
    
    # Act: Execute the code under test
    actual_output = function_under_test(input_data)
    
    # Assert: Verify the results
    assert actual_output == expected_output
```

### Testing with Fixtures

```python
@pytest.fixture
def parser():
    """Provide a configured CK3Parser instance."""
    return CK3Parser()

@pytest.fixture
def sample_script():
    """Provide sample CK3 script for testing."""
    return """
    namespace = test_mod
    
    test_event = {
        type = character_event
        title = test_event.title
    }
    """

def test_parse_event(parser, sample_script):
    """Test parsing of a complete event."""
    ast = parser.parse_text(sample_script)
    
    assert ast is not None
    assert len(ast.events) == 1
    assert ast.events[0].name == "test_event"
```

### Parametrized Tests

Use for testing multiple similar cases:

```python
@pytest.mark.parametrize("input_code,expected_scope", [
    ("root", "character"),
    ("root.liege", "character"),
    ("root.capital_province", "province"),
    ("root.primary_title", "title"),
])
def test_scope_resolution(input_code, expected_scope):
    """Test scope resolution for various expressions."""
    tracker = ScopeTracker(initial_scope="character")
    result = tracker.resolve_scope(input_code)
    
    assert result == expected_scope


@pytest.mark.parametrize("trait_name,is_valid", [
    ("brave", True),
    ("craven", True),
    ("not_a_real_trait", False),
    ("", False),
])
def test_trait_validation(trait_name, is_valid):
    """Test trait name validation."""
    validator = TraitValidator()
    result = validator.is_valid_trait(trait_name)
    
    assert result == is_valid
```

### Testing Exceptions

```python
def test_parser_raises_on_invalid_syntax():
    """Test that parser raises SyntaxError for invalid syntax."""
    parser = CK3Parser()
    invalid_code = "namespace = { { {"
    
    with pytest.raises(SyntaxError) as exc_info:
        parser.parse_text(invalid_code)
    
    assert "unexpected token" in str(exc_info.value).lower()

def test_validator_handles_none_gracefully():
    """Test that validator handles None input without crashing."""
    validator = ScopeValidator()
    
    # Should not raise, should return empty list
    result = validator.validate(None)
    
    assert result == []
```

## Integration Test Patterns

### Testing LSP Handlers

```python
@pytest.mark.asyncio
async def test_completion_handler():
    """Integration test for completion handler."""
    # Create test server
    server = CK3LanguageServer()
    
    # Simulate document opening
    uri = "file:///test.txt"
    text = "namespace = test\n"
    
    await server.did_open(uri, text)
    
    # Request completions
    params = CompletionParams(
        text_document=TextDocumentIdentifier(uri=uri),
        position=Position(line=0, character=10)
    )
    
    result = await completion_handler(server, params)
    
    assert result is not None
    assert len(result.items) > 0
    assert any(item.label == "namespace" for item in result.items)
```

### Testing Full Workflows

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_edit_and_validate_workflow():
    """Test complete edit and validation workflow."""
    server = CK3LanguageServer()
    uri = "file:///test.txt"
    
    # 1. Open document
    await server.did_open(uri, "namespace = test")
    
    # 2. Edit document
    await server.did_change(uri, "namespace = test\nadd_trait = brave")
    
    # 3. Get diagnostics
    diagnostics = server.get_diagnostics(uri)
    
    # 4. Get completions
    completions = await server.completion(uri, line=1, char=10)
    
    # 5. Get hover
    hover = await server.hover(uri, line=1, char=5)
    
    # Verify all features work
    assert len(diagnostics) == 0
    assert len(completions.items) > 0
    assert hover is not None
```

## Async Test Patterns

### Basic Async Test

```python
@pytest.mark.asyncio
async def test_async_function():
    """Test asynchronous function."""
    result = await async_function()
    assert result is not None
```

### Testing Concurrent Operations

```python
@pytest.mark.asyncio
async def test_concurrent_validations():
    """Test that multiple validations can run concurrently."""
    validator = AsyncValidator()
    
    # Start multiple validations
    tasks = [
        validator.validate(doc1),
        validator.validate(doc2),
        validator.validate(doc3),
    ]
    
    # Wait for all to complete
    results = await asyncio.gather(*tasks)
    
    assert len(results) == 3
    assert all(r is not None for r in results)
```

## Test Data Management

### Using Fixtures Directory

```python
import pytest
from pathlib import Path

@pytest.fixture
def fixtures_dir():
    """Path to fixtures directory."""
    return Path(__file__).parent / "fixtures"

def test_with_fixture_file(fixtures_dir):
    """Test using a fixture file."""
    test_file = fixtures_dir / "sample_events.txt"
    content = test_file.read_text()
    
    result = process_file(content)
    assert result is not None
```

### Temporary Files

```python
def test_with_temp_file(tmp_path):
    """Test using temporary file."""
    # tmp_path is a pytest fixture providing a temporary directory
    test_file = tmp_path / "test.txt"
    test_file.write_text("namespace = test")
    
    result = parse_file(str(test_file))
    
    assert result is not None
```

## Mocking and Patching

### Mocking External Dependencies

```python
from unittest.mock import Mock, patch

def test_with_mock():
    """Test with mocked dependency."""
    # Create mock
    mock_indexer = Mock()
    mock_indexer.find_symbol.return_value = Symbol("test")
    
    # Use mock
    validator = ScopeValidator(indexer=mock_indexer)
    result = validator.validate_symbol("test")
    
    # Verify mock was called
    mock_indexer.find_symbol.assert_called_once_with("test")

@patch('pychivalry.external_api.call')
def test_with_patch(mock_call):
    """Test with patched function."""
    mock_call.return_value = {"status": "ok"}
    
    result = function_that_calls_api()
    
    assert result["status"] == "ok"
    mock_call.assert_called()
```

## Performance Testing

### Benchmarking with pytest-benchmark

```python
def test_parser_performance(benchmark):
    """Benchmark parser performance."""
    parser = CK3Parser()
    code = generate_large_script(1000)  # 1000 events
    
    result = benchmark(parser.parse_text, code)
    
    assert result is not None

@pytest.mark.benchmark
def test_completion_speed(benchmark):
    """Ensure completions are fast enough."""
    provider = CompletionProvider()
    document = create_test_document()
    
    result = benchmark(provider.provide, document, Position(0, 10))
    
    # Should complete in < 100ms (benchmark will measure)
    assert len(result.items) > 0
```

### Testing Resource Usage

```python
import psutil
import os

def test_memory_usage():
    """Test that memory usage stays reasonable."""
    process = psutil.Process(os.getpid())
    
    initial_memory = process.memory_info().rss / 1024 / 1024  # MB
    
    # Perform memory-intensive operation
    parser = CK3Parser()
    for _ in range(100):
        parser.parse_text(large_script)
    
    final_memory = process.memory_info().rss / 1024 / 1024  # MB
    memory_increase = final_memory - initial_memory
    
    # Memory increase should be less than 100 MB
    assert memory_increase < 100
```

## Test Coverage

### Running with Coverage

```bash
# Run tests with coverage
pytest --cov=pychivalry --cov-report=html tests/

# View report
open htmlcov/index.html
```

### Coverage Goals

- **Parser:** 90%+ coverage
- **Validators:** 85%+ coverage  
- **LSP Handlers:** 80%+ coverage
- **Utilities:** 75%+ coverage

### Identifying Gaps

```python
# Use coverage to find untested code
pytest --cov=pychivalry --cov-report=term-missing tests/

# Focus on untested lines
```

## Test Markers

### Custom Markers

```python
# In pytest.ini or pyproject.toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests as integration tests",
    "performance: marks performance tests",
]

# Use in tests
@pytest.mark.slow
def test_large_file_parsing():
    """Test parsing of very large file."""
    pass

@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_server():
    """Integration test for full server."""
    pass
```

### Running Specific Tests

```bash
# Run only integration tests
pytest -m integration

# Skip slow tests
pytest -m "not slow"

# Run tests matching pattern
pytest -k "completion" tests/
```

## Best Practices Summary

### ✅ Do

- Write descriptive test names and docstrings
- Test one thing per test function
- Use fixtures for common setup
- Use parametrize for similar test cases
- Test edge cases and error conditions
- Keep tests fast (mock expensive operations)
- Organize tests logically
- Aim for high coverage on critical paths
- Write tests before fixing bugs

### ❌ Don't

- Write tests that depend on other tests
- Use sleep() in tests (use async properly)
- Test implementation details (test behavior)
- Ignore flaky tests (fix them)
- Skip writing tests for "simple" code
- Let tests become unmaintainable
- Forget to test error paths

## Quick Reference

```bash
# Run all tests
pytest tests/ -v

# Run specific file
pytest tests/test_parser.py -v

# Run specific test
pytest tests/test_parser.py::test_parse_event -v

# Run with coverage
pytest tests/ --cov=pychivalry

# Run fast tests only
pytest tests/ -m "not slow"

# Show output (print statements)
pytest tests/ -s

# Stop on first failure
pytest tests/ -x

# Run last failed tests
pytest tests/ --lf
```
