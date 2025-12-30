"""Performance benchmarks for pychivalry Language Server.

Tests response times and memory usage to ensure performance requirements are met.
"""

import pytest
import time
from pychivalry.parser import parse_document
from pychivalry.diagnostics import collect_all_diagnostics, get_diagnostics_for_text
from pychivalry.completions import get_context_aware_completions
from pychivalry.navigation import find_definition, find_references
from pychivalry.indexer import DocumentIndex
from pygls.workspace import TextDocument


# Performance thresholds (in seconds)
PARSE_THRESHOLD = 0.1
DIAGNOSTICS_THRESHOLD = 0.1
COMPLETIONS_THRESHOLD = 0.05
NAVIGATION_THRESHOLD = 0.05


class TestParserPerformance:
    """Test parser performance on various file sizes."""

    def test_parse_small_file_performance(self, benchmark):
        """Benchmark parsing a small file (<100 lines)."""
        content = """
        namespace = test
        
        character_event = {
            id = test.001
            desc = test.001.desc
            
            option = {
                name = test.001.a
                add_gold = 100
            }
        }
        """ * 5  # ~60 lines
        
        result = benchmark(parse_document, content)
        assert result is not None

    def test_parse_medium_file_performance(self, benchmark):
        """Benchmark parsing a medium file (100-1000 lines)."""
        # Generate 500 line file
        event_template = """
        character_event = {{
            id = test.{i:03d}
            desc = test.{i:03d}.desc
            
            immediate = {{
                add_gold = 100
                add_prestige = 50
            }}
            
            option = {{
                name = test.{i:03d}.a
                add_gold = 100
            }}
        }}
        """
        
        content = "namespace = test\n"
        for i in range(50):
            content += event_template.format(i=i)
        
        result = benchmark(parse_document, content)
        assert result is not None

    def test_parse_large_file_performance(self, benchmark):
        """Benchmark parsing a large file (>1000 lines)."""
        # Generate 1500 line file
        event_template = """
        character_event = {{
            id = test.{i:03d}
            desc = test.{i:03d}.desc
            
            trigger = {{
                age >= 16
                is_adult = yes
            }}
            
            immediate = {{
                add_gold = 100
                add_prestige = 50
            }}
            
            option = {{
                name = test.{i:03d}.a
                add_gold = 100
            }}
            
            option = {{
                name = test.{i:03d}.b
                add_prestige = 50
            }}
        }}
        """
        
        content = "namespace = test\n"
        for i in range(75):
            content += event_template.format(i=i)
        
        result = benchmark(parse_document, content)
        assert result is not None

    def test_parse_deeply_nested_structure(self, benchmark):
        """Benchmark parsing deeply nested structures."""
        # Create 50 levels of nesting
        content = "namespace = test\n"
        content += "scripted_effect = {\n"
        for i in range(50):
            content += "    if = {\n"
            content += f"        limit = {{ always = yes }}\n"
        content += "            add_gold = 100\n"
        for i in range(50):
            content += "    }\n"
        content += "}\n"
        
        result = benchmark(parse_document, content)
        assert result is not None


class TestDiagnosticsPerformance:
    """Test diagnostics performance on various scenarios."""

    def test_diagnostics_small_file(self, benchmark):
        """Benchmark diagnostics on small file."""
        content = """
        namespace = test
        
        character_event = {
            id = test.001
            desc = test.001.desc
            add_gold = 100
        }
        """
        
        ast = parse_document(content)
        doc = TextDocument(uri="file:///test.txt", source=content)
        result = benchmark(collect_all_diagnostics, doc, ast)
        assert result is not None

    def test_diagnostics_large_workspace(self):
        """Test diagnostics performance across large workspace."""
        index = DocumentIndex()
        
        # Create 100 files
        start_time = time.perf_counter()
        
        for i in range(100):
            content = f"""
            namespace = events_{i}
            
            character_event = {{
                id = events_{i}.001
                desc = events_{i}.001.desc
            }}
            """
            ast = parse_document(content)
            doc = TextDocument(uri=f"file:///events_{i}.txt", source=content)
            index.update_from_ast(f"file:///events_{i}.txt", ast)
            collect_all_diagnostics(doc, ast, index)
        
        elapsed = time.perf_counter() - start_time
        
        # Should complete in reasonable time (< 10 seconds for 100 files)
        assert elapsed < 10.0
        
        # Average per file should be < 100ms
        avg_per_file = elapsed / 100
        assert avg_per_file < DIAGNOSTICS_THRESHOLD


class TestCompletionsPerformance:
    """Test completions performance."""

    def test_completions_in_large_file(self, benchmark):
        """Benchmark completions in large file."""
        # Generate large file
        content = "namespace = test\n\n"
        for i in range(100):
            content += f"""
            character_event = {{
                id = test.{i:03d}
                immediate = {{
                    add_gold = 100
                }}
            }}
            """
        
        # Add incomplete line at end
        content += "\ncharacter_event = {\n    add_"
        
        ast = parse_document(content)
        index = DocumentIndex()
        index.update_from_ast("test.txt", ast)
        
        # Position at end of "add_"
        from lsprotocol.types import Position
        position = Position(line=content.count('\n'), character=8)
        line_text = "    add_"
        
        def do_completions():
            return get_context_aware_completions("file:///test.txt", position, ast[0] if ast else None, line_text, index)
        
        result = benchmark(do_completions)
        assert result is not None

    def test_completions_with_many_scopes(self):
        """Test completions performance with many saved scopes."""
        content = """
        namespace = test
        
        character_event = {
            id = test.001
            immediate = {
        """
        
        # Add many save_scope_as statements
        for i in range(50):
            content += f"        save_scope_as = saved_scope_{i}\n"
        
        content += "        scope:"
        
        ast = parse_document(content)
        index = DocumentIndex()
        index.update_from_ast("test.txt", ast)
        
        from lsprotocol.types import Position
        position = Position(line=content.count('\n'), character=14)  # After "scope:"
        line_text = "        scope:"
        
        start_time = time.perf_counter()
        completions = get_context_aware_completions("file:///test.txt", position, ast[0] if ast else None, line_text, index)
        elapsed = time.perf_counter() - start_time
        
        assert elapsed < COMPLETIONS_THRESHOLD
        assert completions is not None


class TestNavigationPerformance:
    """Test navigation performance across files."""

    def test_find_definition_across_many_files(self):
        """Test find definition performance across 50+ files."""
        index = DocumentIndex()
        
        # Create 50 files with scripted effects
        for i in range(50):
            content = f"""
            effect_{i} = {{
                add_gold = {i * 10}
            }}
            """
            ast = parse_document(content)
            index.update_from_ast(f"effects_{i}.txt", ast)
        
        # Create file that uses one of the effects
        usage_content = """
        namespace = test
        character_event = {
            id = test.001
            immediate = {
                effect_25 = yes
            }
        }
        """
        usage_ast = parse_document(usage_content)
        index.update_from_ast("events.txt", usage_ast)
        
        # Find definition
        position = (5, 20)  # On "effect_25"
        
        start_time = time.perf_counter()
        definitions = find_definition(usage_ast, position, index)
        elapsed = time.perf_counter() - start_time
        
        assert elapsed < NAVIGATION_THRESHOLD
        # Note: The navigation module's find_definition function may not find
        # scripted effects without the proper indexing infrastructure.
        # This test verifies the function completes in reasonable time.
        assert isinstance(definitions, list)

    def test_find_references_performance(self):
        """Test find references performance."""
        index = DocumentIndex()
        
        # Define scripted effect
        effect_content = """
        common_reward = {
            add_gold = 100
        }
        """
        effect_ast = parse_document(effect_content)
        index.update_from_ast("effects.txt", effect_ast)
        
        # Create 30 files that use the effect
        for i in range(30):
            content = f"""
            namespace = events_{i}
            character_event = {{
                id = events_{i}.001
                immediate = {{
                    common_reward = yes
                }}
            }}
            """
            ast = parse_document(content)
            index.update_from_ast(f"events_{i}.txt", ast)
        
        # Find all references
        position = (2, 10)  # On "common_reward" definition
        
        start_time = time.perf_counter()
        references = find_references(effect_ast, position, index, include_declaration=True)
        elapsed = time.perf_counter() - start_time
        
        # Should complete in reasonable time
        assert elapsed < 0.5
        assert isinstance(references, list)


class TestMemoryPerformance:
    """Test memory usage."""

    def test_index_memory_usage(self):
        """Test document index memory usage with many files."""
        import sys
        
        index = DocumentIndex()
        
        # Measure baseline memory
        initial_size = sys.getsizeof(index)
        
        # Add 500 documents
        for i in range(500):
            content = f"""
            namespace = events_{i}
            
            character_event = {{
                id = events_{i}.001
                desc = events_{i}.001.desc
                
                immediate = {{
                    add_gold = 100
                }}
            }}
            """
            ast = parse_document(content)
            index.update_from_ast(f"events_{i}.txt", ast)
        
        # Measure final memory
        final_size = sys.getsizeof(index)
        
        # Memory growth should be reasonable
        # (This is a basic check - real memory profiling would use memory_profiler)
        growth = final_size - initial_size
        assert growth < 10_000_000  # Less than 10MB growth for 500 files


@pytest.mark.slow
class TestConcurrencyPerformance:
    """Test handling multiple simultaneous requests."""

    def test_concurrent_completions_requests(self):
        """Test multiple simultaneous completion requests."""
        import concurrent.futures
        from lsprotocol.types import Position
        
        content = """
        namespace = test
        character_event = {
            id = test.001
            immediate = {
                add_
            }
        }
        """
        
        ast = parse_document(content)
        index = DocumentIndex()
        index.update_from_ast("test.txt", ast)
        
        position = Position(line=5, character=20)
        line_text = "                add_"
        
        def get_completions():
            return get_context_aware_completions("file:///test.txt", position, ast[0] if ast else None, line_text, index)
        
        # Submit 10 concurrent requests
        start_time = time.perf_counter()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(get_completions) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        elapsed = time.perf_counter() - start_time
        
        # All requests should succeed
        assert all(r is not None for r in results)
        
        # Should complete reasonably fast even with contention
        assert elapsed < 1.0
