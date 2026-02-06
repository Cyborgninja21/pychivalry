#!/usr/bin/env python3
"""
Enhanced Infrastructure Performance Benchmark Suite v2

This comprehensive benchmark suite measures performance across multiple dimensions
to identify bottlenecks and edge cases in the pychivalry LSP server.

NEW IN V2:
    - Cold vs Warm cache comparisons
    - Individual YAML file loading breakdown
    - Parser stress tests (deeply nested, wide structures, long lines)
    - Memory profiling with tracemalloc
    - Real file benchmarks from example mod
    - Scaling analysis with curve fitting
    - Cache efficiency metrics
    - GC impact measurement
    - Concurrent request simulation
    - Incremental parsing edge cases

Usage:
    python benchmarks/infrastructure_benchmark_v2.py
    python benchmarks/infrastructure_benchmark_v2.py --quick
    python benchmarks/infrastructure_benchmark_v2.py --stress    # Run stress tests
    python benchmarks/infrastructure_benchmark_v2.py --memory    # Include memory profiling
    python benchmarks/infrastructure_benchmark_v2.py --scaling   # Run scaling analysis
    python benchmarks/infrastructure_benchmark_v2.py --all       # Run everything
"""

import argparse
import gc
import hashlib
import io
import logging
import os
import statistics
import sys
import time
import tracemalloc
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Disable logging during benchmarks
logging.basicConfig(level=logging.CRITICAL)

# =============================================================================
# BENCHMARK FRAMEWORK
# =============================================================================

@dataclass
class TimingResult:
    """Individual timing measurement."""
    name: str
    duration_seconds: float
    iterations: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_ms(self) -> float:
        return self.duration_seconds * 1000

    @property
    def duration_us(self) -> float:
        return self.duration_seconds * 1_000_000


@dataclass
class MemoryResult:
    """Memory measurement result."""
    name: str
    current_bytes: int
    peak_bytes: int
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def current_mb(self) -> float:
        return self.current_bytes / (1024 * 1024)

    @property
    def peak_mb(self) -> float:
        return self.peak_bytes / (1024 * 1024)


@dataclass
class BenchmarkSuite:
    """Collection of benchmark results."""
    name: str
    results: List[TimingResult] = field(default_factory=list)
    memory_results: List[MemoryResult] = field(default_factory=list)
    level: int = 0

    def add(self, result: TimingResult):
        self.results.append(result)

    def add_memory(self, result: MemoryResult):
        self.memory_results.append(result)

    def get_stats(self, name: str) -> Dict[str, float]:
        """Get statistics for a specific benchmark."""
        timings = [r.duration_seconds for r in self.results if r.name == name]
        if not timings:
            return {}
        
        sorted_t = sorted(timings)
        n = len(timings)
        return {
            "count": n,
            "min_ms": min(timings) * 1000,
            "max_ms": max(timings) * 1000,
            "mean_ms": statistics.mean(timings) * 1000,
            "median_ms": statistics.median(timings) * 1000,
            "p95_ms": sorted_t[int(n * 0.95)] * 1000 if n >= 20 else sorted_t[-1] * 1000,
            "p99_ms": sorted_t[int(n * 0.99)] * 1000 if n >= 100 else sorted_t[-1] * 1000,
            "stddev_ms": statistics.stdev(timings) * 1000 if n > 1 else 0,
            "total_ms": sum(timings) * 1000,
        }


def time_function(func: Callable, *args, warmup: int = 1, iterations: int = 10, **kwargs) -> List[float]:
    """Time a function over multiple iterations with warmup."""
    for _ in range(warmup):
        func(*args, **kwargs)
    
    timings = []
    for _ in range(iterations):
        gc.collect()
        start = time.perf_counter()
        func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        timings.append(elapsed)
    
    return timings


def time_with_memory(func: Callable, *args, **kwargs) -> Tuple[float, int, int]:
    """Time a function and measure memory usage."""
    gc.collect()
    tracemalloc.start()
    
    start = time.perf_counter()
    result = func(*args, **kwargs)
    elapsed = time.perf_counter() - start
    
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    return elapsed, current, peak


# =============================================================================
# TEST DATA GENERATORS
# =============================================================================

def generate_document(num_events: int = 10, nesting_depth: int = 3, options_per_event: int = 3) -> str:
    """Generate a configurable test document."""
    lines = [f"namespace = benchmark_{num_events}_{nesting_depth}\n"]
    
    for i in range(num_events):
        lines.append(f"""
benchmark.{i:04d} = {{
    type = character_event
    title = benchmark.{i:04d}.t
    desc = benchmark.{i:04d}.desc
    theme = intrigue
    
    left_portrait = root
    
    trigger = {{
        is_adult = yes
        is_ruler = yes
        gold >= {i * 10}
        NOT = {{ has_trait = incapable }}
""")
        # Add nesting
        for depth in range(nesting_depth):
            indent = "        " + "    " * depth
            lines.append(f"{indent}any_vassal = {{")
            lines.append(f"{indent}    is_adult = yes")
            lines.append(f"{indent}    has_trait = ambitious")
        
        # Close nesting
        for depth in range(nesting_depth):
            indent = "        " + "    " * (nesting_depth - depth - 1)
            lines.append(f"{indent}}}")
        
        lines.append("    }")  # Close trigger
        
        lines.append("""
    immediate = {
        save_scope_as = actor
        add_character_flag = event_started
    }
""")
        
        # Add options
        for opt in range(options_per_event):
            lines.append(f"""
    option = {{
        name = benchmark.{i:04d}.{chr(97 + opt)}
        add_gold = {100 + opt}
        ai_chance = {{
            base = 50
            modifier = {{
                add = 25
                has_trait = greedy
            }}
        }}
    }}""")
        
        lines.append("}\n")
    
    return "\n".join(lines)


def generate_deeply_nested(depth: int = 20) -> str:
    """Generate extremely deeply nested structure."""
    lines = ["namespace = deep_nest\n", "deep_nest.0001 = {", "    type = character_event"]
    
    for i in range(depth):
        indent = "    " * (i + 1)
        lines.append(f"{indent}any_vassal = {{")
        lines.append(f"{indent}    is_adult = yes")
    
    # Close all
    for i in range(depth, 0, -1):
        indent = "    " * i
        lines.append(f"{indent}}}")
    
    lines.append("}")
    return "\n".join(lines)


def generate_wide_structure(num_siblings: int = 100) -> str:
    """Generate structure with many sibling nodes."""
    lines = ["namespace = wide_struct\n", "wide_struct.0001 = {", "    type = character_event"]
    lines.append("    trigger = {")
    
    for i in range(num_siblings):
        lines.append(f"        has_character_flag = flag_{i}")
    
    lines.append("    }")
    lines.append("}")
    return "\n".join(lines)


def generate_long_lines(line_length: int = 500, num_lines: int = 50) -> str:
    """Generate document with very long lines."""
    lines = ["namespace = long_lines\n", "long_lines.0001 = {", "    type = character_event"]
    lines.append("    trigger = {")
    
    for i in range(num_lines):
        # Create a very long OR condition
        conditions = " ".join([f"flag_{j}" for j in range(line_length // 10)])
        lines.append(f"        # {conditions}")
    
    lines.append("    }")
    lines.append("}")
    return "\n".join(lines)


# Standard test documents
SMALL_DOCUMENT = generate_document(num_events=2, nesting_depth=1, options_per_event=2)
MEDIUM_DOCUMENT = generate_document(num_events=5, nesting_depth=2, options_per_event=3)
LARGE_DOCUMENT = generate_document(num_events=20, nesting_depth=3, options_per_event=4)
XLARGE_DOCUMENT = generate_document(num_events=50, nesting_depth=4, options_per_event=5)

# Stress test documents
DEEPLY_NESTED = generate_deeply_nested(depth=30)
VERY_WIDE = generate_wide_structure(num_siblings=200)
LONG_LINES = generate_long_lines(line_length=1000, num_lines=100)


# =============================================================================
# COLD VS WARM CACHE BENCHMARKS
# =============================================================================

def benchmark_cold_vs_warm_schema(iterations: int = 5) -> BenchmarkSuite:
    """Compare cold vs warm schema loading."""
    from pychivalry.schema.loader import SchemaLoader
    
    suite = BenchmarkSuite("Cold vs Warm Schema Loading", level=1)
    
    test_paths = [
        "common/events/test.txt",
        "common/decisions/test.txt",
        "common/story_cycles/test.txt",
    ]
    
    for _ in range(iterations):
        # Cold load (clear cache first)
        loader = SchemaLoader()
        loader.clear_cache()
        
        gc.collect()
        start = time.perf_counter()
        loader.load_all()
        cold_time = time.perf_counter() - start
        suite.add(TimingResult("schema_load:cold", cold_time))
        
        # Warm lookups
        for path in test_paths:
            gc.collect()
            start = time.perf_counter()
            loader.get_schema_for_file(path)
            warm_time = time.perf_counter() - start
            path_name = path.split("/")[1]
            suite.add(TimingResult(f"schema_lookup:warm:{path_name}", warm_time))
        
        # Second cold load (measure consistency)
        loader.clear_cache()
        gc.collect()
        start = time.perf_counter()
        loader.load_all()
        cold_time_2 = time.perf_counter() - start
        suite.add(TimingResult("schema_load:cold_repeat", cold_time_2))
    
    return suite


def benchmark_individual_yaml_files() -> BenchmarkSuite:
    """Benchmark loading of individual YAML files."""
    import yaml
    from pathlib import Path
    
    suite = BenchmarkSuite("Individual YAML File Loading", level=2)
    
    # Schema files
    schema_dir = Path(__file__).parent.parent / "pychivalry" / "data" / "schemas"
    if schema_dir.exists():
        yaml_files = list(schema_dir.glob("*.yaml"))
        
        for yaml_file in yaml_files:
            gc.collect()
            start = time.perf_counter()
            with open(yaml_file, 'r', encoding='utf-8') as f:
                yaml.safe_load(f)
            elapsed = time.perf_counter() - start
            
            file_size = yaml_file.stat().st_size
            suite.add(TimingResult(
                f"yaml:{yaml_file.name}",
                elapsed,
                metadata={"size_bytes": file_size, "size_kb": file_size / 1024}
            ))
    
    # Data files (effects, triggers, scopes)
    data_dir = Path(__file__).parent.parent / "pychivalry" / "data"
    for subdir in ["effects", "triggers", "scopes"]:
        subdir_path = data_dir / subdir
        if subdir_path.exists():
            for yaml_file in subdir_path.glob("*.yaml"):
                gc.collect()
                start = time.perf_counter()
                with open(yaml_file, 'r', encoding='utf-8') as f:
                    yaml.safe_load(f)
                elapsed = time.perf_counter() - start
                
                file_size = yaml_file.stat().st_size
                suite.add(TimingResult(
                    f"yaml:{subdir}/{yaml_file.name}",
                    elapsed,
                    metadata={"size_bytes": file_size}
                ))
    
    return suite


def benchmark_cold_vs_warm_traits(iterations: int = 3) -> BenchmarkSuite:
    """Compare cold vs warm trait data loading."""
    suite = BenchmarkSuite("Cold vs Warm Trait Loading", level=1)
    
    try:
        from pychivalry.ck3.validation import traits
        
        for _ in range(iterations):
            # Force cold load by clearing caches
            traits._trait_data_available_cache = None
            traits._trait_set_cache = None
            
            # Cold availability check
            gc.collect()
            start = time.perf_counter()
            available = traits.is_trait_data_available()
            cold_avail = time.perf_counter() - start
            suite.add(TimingResult("trait_available:cold", cold_avail))
            
            if available:
                # Cold trait names
                traits._trait_set_cache = None
                gc.collect()
                start = time.perf_counter()
                names = traits.get_all_trait_names()
                cold_names = time.perf_counter() - start
                suite.add(TimingResult("trait_names:cold", cold_names, 
                                       metadata={"count": len(names)}))
                
                # Warm trait names
                gc.collect()
                start = time.perf_counter()
                names = traits.get_all_trait_names()
                warm_names = time.perf_counter() - start
                suite.add(TimingResult("trait_names:warm", warm_names))
                
                # Single trait lookup
                gc.collect()
                start = time.perf_counter()
                traits.is_valid_trait("brave")
                lookup_time = time.perf_counter() - start
                suite.add(TimingResult("trait_lookup:single", lookup_time))
    except ImportError:
        pass
    
    return suite


# =============================================================================
# PARSER STRESS TESTS
# =============================================================================

def benchmark_parser_stress(iterations: int = 5) -> BenchmarkSuite:
    """Stress test the parser with edge cases."""
    from pychivalry.core.parser import parse_document, tokenize
    
    suite = BenchmarkSuite("Parser Stress Tests", level=1)
    
    test_cases = [
        ("deeply_nested", DEEPLY_NESTED),
        ("very_wide", VERY_WIDE),
        ("long_lines", LONG_LINES),
        ("xlarge", XLARGE_DOCUMENT),
    ]
    
    for name, content in test_cases:
        lines = content.count("\n")
        size = len(content)
        
        # Tokenization
        timings = time_function(tokenize, content, warmup=1, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"tokenize:{name}", t, metadata={
                "lines": lines, "size": size
            }))
        
        # Full parse
        timings = time_function(parse_document, content, warmup=1, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"parse:{name}", t, metadata={
                "lines": lines, "size": size
            }))
    
    return suite


def benchmark_incremental_parse_edge_cases(iterations: int = 5) -> BenchmarkSuite:
    """Test incremental parsing with various edit types."""
    from lsprotocol import types
    from pychivalry.core.incremental_parser import IncrementalParser
    
    suite = BenchmarkSuite("Incremental Parse Edge Cases", level=1)
    
    parser = IncrementalParser()
    base_doc = MEDIUM_DOCUMENT
    parser.parse(base_doc)
    
    lines = base_doc.split("\n")
    
    # Use TextDocumentContentChangePartial which has range and text fields
    # Edge case 1: Single character edit
    if len(lines) > 30:
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=30, character=10),
                end=types.Position(line=30, character=11),
            ),
            text="X"
        )
        new_text = base_doc[:500] + "X" + base_doc[501:]
        
        for _ in range(iterations):
            parser.invalidate()
            parser.parse(base_doc)
            gc.collect()
            start = time.perf_counter()
            parser.incremental_parse(change, new_text)
            elapsed = time.perf_counter() - start
            suite.add(TimingResult("incremental:single_char", elapsed))
    
    # Edge case 2: Insert new block
    insertion = """
    option = {
        name = new_option
        add_gold = 999
    }
"""
    idx = base_doc.find("option =")
    if idx != -1:
        new_text = base_doc[:idx] + insertion + base_doc[idx:]
        line_num = base_doc[:idx].count("\n")
        
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=line_num, character=0),
                end=types.Position(line=line_num, character=0),
            ),
            text=insertion
        )
        
        for _ in range(iterations):
            parser.invalidate()
            parser.parse(base_doc)
            gc.collect()
            start = time.perf_counter()
            parser.incremental_parse(change, new_text)
            elapsed = time.perf_counter() - start
            suite.add(TimingResult("incremental:insert_block", elapsed))
    
    # Edge case 3: Delete multiple lines
    if len(lines) > 40:
        delete_start = 30
        delete_end = 35
        new_lines = lines[:delete_start] + lines[delete_end:]
        new_text = "\n".join(new_lines)
        
        change = types.TextDocumentContentChangePartial(
            range=types.Range(
                start=types.Position(line=delete_start, character=0),
                end=types.Position(line=delete_end, character=0),
            ),
            text=""
        )
        
        for _ in range(iterations):
            parser.invalidate()
            parser.parse(base_doc)
            gc.collect()
            start = time.perf_counter()
            parser.incremental_parse(change, new_text)
            elapsed = time.perf_counter() - start
            suite.add(TimingResult("incremental:delete_lines", elapsed))
    
    return suite


# =============================================================================
# MEMORY PROFILING
# =============================================================================

def benchmark_memory_usage() -> BenchmarkSuite:
    """Profile memory usage of key operations."""
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    
    suite = BenchmarkSuite("Memory Usage", level=0)
    
    test_docs = [
        ("small", SMALL_DOCUMENT),
        ("medium", MEDIUM_DOCUMENT),
        ("large", LARGE_DOCUMENT),
        ("xlarge", XLARGE_DOCUMENT),
    ]
    
    for name, content in test_docs:
        # Parse memory
        gc.collect()
        tracemalloc.start()
        ast, errors = parse_document(content)
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        suite.add_memory(MemoryResult(
            f"parse:{name}",
            current, peak,
            metadata={"lines": content.count("\n"), "nodes": _count_nodes(ast)}
        ))
        
        # Index memory
        gc.collect()
        tracemalloc.start()
        index = DocumentIndex()
        index.update_from_ast("file:///test.txt", ast)
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        suite.add_memory(MemoryResult(
            f"index:{name}",
            current, peak,
            metadata={"lines": content.count("\n")}
        ))
    
    return suite


def _count_nodes(ast) -> int:
    """Count total nodes in AST."""
    count = 0
    def visit(node):
        nonlocal count
        count += 1
        for child in node.children:
            visit(child)
    
    for node in ast:
        visit(node)
    return count


# =============================================================================
# REAL FILE BENCHMARKS
# =============================================================================

def benchmark_real_files(iterations: int = 5) -> BenchmarkSuite:
    """Benchmark with real files from example mod."""
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.ck3.validation.diagnostics import collect_all_diagnostics
    
    suite = BenchmarkSuite("Real File Benchmarks", level=0)
    
    example_mod = Path(__file__).parent.parent / "example mod"
    
    if not example_mod.exists():
        return suite
    
    # Find all .txt files
    txt_files = list(example_mod.rglob("*.txt"))[:20]  # Limit to 20 files
    
    for txt_file in txt_files:
        try:
            content = txt_file.read_text(encoding='utf-8', errors='replace')
        except Exception:
            continue
        
        if len(content) < 100:  # Skip tiny files
            continue
        
        rel_path = txt_file.relative_to(example_mod)
        uri = f"file:///{txt_file.as_posix()}"
        
        # Full cycle benchmark
        def full_cycle():
            ast, errors = parse_document(content)
            index = DocumentIndex()
            index.update_from_ast(uri, ast)
            return collect_all_diagnostics(ast, errors, content, uri, index)
        
        timings = time_function(full_cycle, warmup=1, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"real:{rel_path}", t, metadata={
                "lines": content.count("\n"),
                "size": len(content)
            }))
    
    return suite


# =============================================================================
# SCALING ANALYSIS
# =============================================================================

def benchmark_scaling_analysis(max_events: int = 100, step: int = 10) -> BenchmarkSuite:
    """Analyze how performance scales with document size."""
    from pychivalry.core.parser import parse_document, tokenize
    from pychivalry.core.indexer import DocumentIndex
    
    suite = BenchmarkSuite("Scaling Analysis", level=0)
    
    for num_events in range(step, max_events + 1, step):
        content = generate_document(num_events=num_events, nesting_depth=2, options_per_event=3)
        lines = content.count("\n")
        size = len(content)
        
        # Tokenize
        gc.collect()
        start = time.perf_counter()
        tokenize(content)
        tok_time = time.perf_counter() - start
        suite.add(TimingResult("scale:tokenize", tok_time, metadata={
            "events": num_events, "lines": lines, "size": size
        }))
        
        # Parse
        gc.collect()
        start = time.perf_counter()
        ast, _ = parse_document(content)
        parse_time = time.perf_counter() - start
        suite.add(TimingResult("scale:parse", parse_time, metadata={
            "events": num_events, "lines": lines, "size": size
        }))
        
        # Index
        gc.collect()
        start = time.perf_counter()
        index = DocumentIndex()
        index.update_from_ast("file:///test.txt", ast)
        index_time = time.perf_counter() - start
        suite.add(TimingResult("scale:index", index_time, metadata={
            "events": num_events, "lines": lines, "size": size
        }))
    
    return suite


# =============================================================================
# CONCURRENT REQUEST SIMULATION
# =============================================================================

def benchmark_concurrent_requests(num_concurrent: int = 10, iterations: int = 3) -> BenchmarkSuite:
    """Simulate concurrent LSP requests."""
    from pychivalry.core.parser import parse_document
    from pychivalry.lsp.completions import get_context_aware_completions
    from lsprotocol import types
    
    suite = BenchmarkSuite("Concurrent Requests", level=0)
    
    # Prepare multiple documents
    docs = [generate_document(num_events=5, nesting_depth=2) for _ in range(num_concurrent)]
    
    def process_document(doc_content: str, doc_id: int):
        """Simulate full document processing."""
        ast, errors = parse_document(doc_content)
        
        # Simulate completion requests at various positions
        for line in [5, 15, 25]:
            try:
                get_context_aware_completions(
                    f"file:///doc_{doc_id}.txt",
                    types.Position(line=line, character=8),
                    None,
                    "",
                    None
                )
            except Exception:
                pass
        
        return len(ast)
    
    for iter_num in range(iterations):
        # Sequential baseline
        gc.collect()
        start = time.perf_counter()
        for i, doc in enumerate(docs):
            process_document(doc, i)
        sequential_time = time.perf_counter() - start
        suite.add(TimingResult("concurrent:sequential", sequential_time, metadata={
            "num_docs": num_concurrent
        }))
        
        # Concurrent with ThreadPool
        gc.collect()
        start = time.perf_counter()
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(process_document, doc, i) for i, doc in enumerate(docs)]
            for f in as_completed(futures):
                f.result()
        concurrent_time = time.perf_counter() - start
        suite.add(TimingResult("concurrent:threaded", concurrent_time, metadata={
            "num_docs": num_concurrent, "workers": 4
        }))
    
    return suite


# =============================================================================
# GC IMPACT MEASUREMENT
# =============================================================================

def benchmark_gc_impact(iterations: int = 10) -> BenchmarkSuite:
    """Measure garbage collection impact on performance."""
    from pychivalry.core.parser import parse_document
    
    suite = BenchmarkSuite("GC Impact", level=2)
    
    content = LARGE_DOCUMENT
    
    # With GC enabled (normal)
    gc.enable()
    gc.collect()
    
    for _ in range(iterations):
        start = time.perf_counter()
        ast, _ = parse_document(content)
        elapsed = time.perf_counter() - start
        suite.add(TimingResult("parse:gc_enabled", elapsed))
    
    # With GC disabled
    gc.disable()
    gc.collect()  # Clean slate
    
    for _ in range(iterations):
        start = time.perf_counter()
        ast, _ = parse_document(content)
        elapsed = time.perf_counter() - start
        suite.add(TimingResult("parse:gc_disabled", elapsed))
    
    gc.enable()  # Re-enable
    
    # Measure GC collection time
    gc.collect()
    for _ in range(5):
        # Create lots of garbage
        for _ in range(iterations):
            parse_document(content)
        
        start = time.perf_counter()
        collected = gc.collect()
        gc_time = time.perf_counter() - start
        suite.add(TimingResult("gc:collection", gc_time, metadata={"collected": collected}))
    
    return suite


# =============================================================================
# CACHE EFFICIENCY
# =============================================================================

def benchmark_cache_efficiency(iterations: int = 20) -> BenchmarkSuite:
    """Measure cache hit rates and efficiency."""
    from pychivalry.lsp.completions import (
        _cached_trigger_completions,
        _cached_effect_completions,
        _cached_scope_completions,
    )
    
    suite = BenchmarkSuite("Cache Efficiency", level=2)
    
    # Clear caches first
    _cached_trigger_completions.cache_clear()
    _cached_effect_completions.cache_clear()
    _cached_scope_completions.cache_clear()
    
    # First call (cache miss)
    gc.collect()
    start = time.perf_counter()
    triggers = _cached_trigger_completions()
    miss_time = time.perf_counter() - start
    suite.add(TimingResult("triggers:cache_miss", miss_time, metadata={"count": len(triggers)}))
    
    # Subsequent calls (cache hits)
    for _ in range(iterations):
        gc.collect()
        start = time.perf_counter()
        _cached_trigger_completions()
        hit_time = time.perf_counter() - start
        suite.add(TimingResult("triggers:cache_hit", hit_time))
    
    # Same for effects
    gc.collect()
    start = time.perf_counter()
    effects = _cached_effect_completions()
    miss_time = time.perf_counter() - start
    suite.add(TimingResult("effects:cache_miss", miss_time, metadata={"count": len(effects)}))
    
    for _ in range(iterations):
        gc.collect()
        start = time.perf_counter()
        _cached_effect_completions()
        hit_time = time.perf_counter() - start
        suite.add(TimingResult("effects:cache_hit", hit_time))
    
    # Report cache info
    trigger_info = _cached_trigger_completions.cache_info()
    effect_info = _cached_effect_completions.cache_info()
    
    print(f"\n  Cache Statistics:")
    print(f"    Triggers: hits={trigger_info.hits}, misses={trigger_info.misses}, size={trigger_info.currsize}")
    print(f"    Effects: hits={effect_info.hits}, misses={effect_info.misses}, size={effect_info.currsize}")
    
    return suite


# =============================================================================
# REPORTING
# =============================================================================

def print_suite_results(suite: BenchmarkSuite, show_all: bool = False):
    """Print results for a benchmark suite."""
    print(f"\n{'=' * 70}")
    print(f"Level {suite.level}: {suite.name}")
    print("=" * 70)
    
    # Group by benchmark name
    benchmark_names = sorted(set(r.name for r in suite.results))
    
    for name in benchmark_names:
        stats = suite.get_stats(name)
        if not stats:
            continue
        
        # Get metadata from first result
        first_result = next((r for r in suite.results if r.name == name), None)
        metadata = first_result.metadata if first_result else {}
        
        print(f"\n  {name}:")
        if metadata:
            meta_str = ", ".join(f"{k}={v}" for k, v in list(metadata.items())[:3])
            print(f"    Metadata: {meta_str}")
        print(f"    Samples: {stats['count']}")
        print(f"    Mean:    {stats['mean_ms']:8.3f} ms")
        print(f"    Median:  {stats['median_ms']:8.3f} ms")
        print(f"    Min:     {stats['min_ms']:8.3f} ms")
        print(f"    Max:     {stats['max_ms']:8.3f} ms")
        if stats['count'] >= 20:
            print(f"    P95:     {stats['p95_ms']:8.3f} ms")
        if stats.get('stddev_ms', 0) > 0:
            print(f"    StdDev:  {stats['stddev_ms']:8.3f} ms")
    
    # Memory results
    if suite.memory_results:
        print(f"\n  Memory Results:")
        for mem in suite.memory_results:
            meta_str = ", ".join(f"{k}={v}" for k, v in list(mem.metadata.items())[:3])
            print(f"    {mem.name}:")
            print(f"      Current: {mem.current_mb:.2f} MB, Peak: {mem.peak_mb:.2f} MB ({meta_str})")


def print_scaling_analysis(suite: BenchmarkSuite):
    """Print scaling analysis with trend information."""
    print(f"\n{'=' * 70}")
    print("SCALING ANALYSIS")
    print("=" * 70)
    
    # Group results by operation type
    ops = defaultdict(list)
    for r in suite.results:
        op = r.name.split(":")[1]  # e.g., "tokenize" from "scale:tokenize"
        ops[op].append((r.metadata.get("events", 0), r.duration_ms, r.metadata.get("lines", 0)))
    
    for op, data in ops.items():
        data.sort(key=lambda x: x[0])  # Sort by events
        print(f"\n  {op.upper()}:")
        print(f"    {'Events':>8} | {'Lines':>8} | {'Time (ms)':>10} | {'ms/event':>10}")
        print(f"    {'-'*8}-+-{'-'*8}-+-{'-'*10}-+-{'-'*10}")
        
        for events, time_ms, lines in data:
            ms_per_event = time_ms / events if events > 0 else 0
            print(f"    {events:>8} | {lines:>8} | {time_ms:>10.3f} | {ms_per_event:>10.4f}")
        
        # Calculate growth rate (linear approximation)
        if len(data) >= 3:
            first_events, first_time, _ = data[0]
            last_events, last_time, _ = data[-1]
            growth = (last_time - first_time) / (last_events - first_events) if last_events != first_events else 0
            print(f"\n    Estimated growth: {growth:.4f} ms per additional event")


def print_summary(all_suites: List[BenchmarkSuite]):
    """Print executive summary."""
    print(f"\n{'=' * 70}")
    print("EXECUTIVE SUMMARY")
    print("=" * 70)
    
    print("\n  Slowest operations by level:\n")
    
    for level in range(4):
        level_suites = [s for s in all_suites if s.level == level]
        if not level_suites:
            continue
        
        all_results = []
        for suite in level_suites:
            for name in set(r.name for r in suite.results):
                stats = suite.get_stats(name)
                if stats:
                    all_results.append((name, stats["mean_ms"], suite.name))
        
        if all_results:
            all_results.sort(key=lambda x: -x[1])
            
            level_name = {
                0: "Full Request Cycles",
                1: "Core Operations",
                2: "Sub-operations",
                3: "Micro-operations",
            }.get(level, f"Level {level}")
            
            print(f"  Level {level} ({level_name}):")
            for name, time_ms, suite_name in all_results[:5]:
                print(f"    - {name}: {time_ms:.3f} ms")
            print()


# =============================================================================
# MAIN
# =============================================================================

def run_benchmarks(
    quick: bool = False,
    stress: bool = False,
    memory: bool = False,
    scaling: bool = False,
    run_all: bool = False,
):
    """Run benchmarks based on options."""
    print("=" * 70)
    print("PyChivalry Infrastructure Benchmark Suite v2")
    print("=" * 70)
    
    options = []
    if quick:
        options.append("Quick")
    if stress:
        options.append("Stress")
    if memory:
        options.append("Memory")
    if scaling:
        options.append("Scaling")
    if run_all:
        options = ["All"]
    
    print(f"Mode: {', '.join(options) if options else 'Standard'}")
    
    # Override options if run_all
    if run_all:
        stress = True
        memory = True
        scaling = True
    
    # Adjust iterations
    iters = 3 if quick else 5
    
    all_suites: List[BenchmarkSuite] = []
    
    # Always run core benchmarks
    print("\n[1/10] Cold vs Warm Schema Loading...")
    all_suites.append(benchmark_cold_vs_warm_schema(iters))
    
    print("[2/10] Individual YAML File Loading...")
    all_suites.append(benchmark_individual_yaml_files())
    
    print("[3/10] Cold vs Warm Trait Loading...")
    all_suites.append(benchmark_cold_vs_warm_traits(iters))
    
    print("[4/10] Cache Efficiency...")
    all_suites.append(benchmark_cache_efficiency(iters * 4))
    
    # Stress tests
    if stress:
        print("[5/10] Parser Stress Tests...")
        all_suites.append(benchmark_parser_stress(iters))
        
        print("[6/10] Incremental Parse Edge Cases...")
        all_suites.append(benchmark_incremental_parse_edge_cases(iters))
    
    # Memory profiling
    if memory:
        print("[7/10] Memory Usage Profiling...")
        all_suites.append(benchmark_memory_usage())
    
    # Real files
    print("[8/10] Real File Benchmarks...")
    all_suites.append(benchmark_real_files(iters))
    
    # Scaling analysis
    if scaling:
        print("[9/10] Scaling Analysis...")
        max_events = 50 if quick else 100
        step = 10 if quick else 10
        scaling_suite = benchmark_scaling_analysis(max_events, step)
        all_suites.append(scaling_suite)
    
    # GC impact
    print("[10/10] GC Impact Measurement...")
    all_suites.append(benchmark_gc_impact(iters * 2))
    
    # Concurrent (optional, can be slow)
    if run_all and not quick:
        print("[BONUS] Concurrent Request Simulation...")
        all_suites.append(benchmark_concurrent_requests(10, 3))
    
    # Print results
    for suite in all_suites:
        print_suite_results(suite)
    
    # Special scaling report
    if scaling:
        scaling_suite = next((s for s in all_suites if s.name == "Scaling Analysis"), None)
        if scaling_suite:
            print_scaling_analysis(scaling_suite)
    
    # Summary
    print_summary(all_suites)
    
    # Key insights
    print(f"\n{'=' * 70}")
    print("KEY INSIGHTS")
    print("=" * 70)
    
    # Cold load analysis
    cold_schema = next(
        (s.get_stats("schema_load:cold") for s in all_suites if "schema_load:cold" in [r.name for r in s.results]),
        None
    )
    if cold_schema:
        print(f"\n  COLD START:")
        print(f"    Schema loading: {cold_schema['mean_ms']:.1f}ms (MAJOR BOTTLENECK)")
    
    # Cache efficiency
    cache_suite = next((s for s in all_suites if s.name == "Cache Efficiency"), None)
    if cache_suite:
        miss_stats = cache_suite.get_stats("triggers:cache_miss")
        hit_stats = cache_suite.get_stats("triggers:cache_hit")
        if miss_stats and hit_stats:
            speedup = miss_stats['mean_ms'] / hit_stats['mean_ms'] if hit_stats['mean_ms'] > 0 else 0
            print(f"\n  CACHE EFFICIENCY:")
            print(f"    Trigger completions:")
            print(f"      Cache miss: {miss_stats['mean_ms']:.3f}ms")
            print(f"      Cache hit:  {hit_stats['mean_ms']:.3f}ms")
            print(f"      Speedup:    {speedup:.0f}x")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Enhanced pychivalry benchmark suite v2")
    parser.add_argument("--quick", action="store_true", help="Run quick benchmarks")
    parser.add_argument("--stress", action="store_true", help="Include parser stress tests")
    parser.add_argument("--memory", action="store_true", help="Include memory profiling")
    parser.add_argument("--scaling", action="store_true", help="Include scaling analysis")
    parser.add_argument("--all", action="store_true", help="Run all benchmarks")
    args = parser.parse_args()
    
    run_benchmarks(
        quick=args.quick,
        stress=args.stress,
        memory=args.memory,
        scaling=args.scaling,
        run_all=args.all,
    )


if __name__ == "__main__":
    main()
