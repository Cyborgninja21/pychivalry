#!/usr/bin/env python3
"""
Comprehensive Infrastructure Performance Benchmark Suite

This script measures performance from high-level LSP operations down to 
individual component functions. It identifies the actual bottlenecks in
the pychivalry system.

BENCHMARK HIERARCHY:
    Level 0 (Highest) - Full Request Cycle
        └── Document open → parse → index → validate → respond
    
    Level 1 - Core Operations  
        ├── Full document parse
        ├── Incremental parse (small edit)
        ├── Document indexing
        └── Full diagnostics collection
    
    Level 2 - Sub-operations
        ├── Tokenization only
        ├── AST building only
        ├── Individual validation phases
        ├── Schema lookup
        └── Completion filtering
    
    Level 3 - Micro-operations
        ├── Scope type inference
        ├── Position range checks
        └── Cache lookups

Usage:
    python benchmarks/infrastructure_benchmark.py
    python benchmarks/infrastructure_benchmark.py --quick    # Fewer iterations
    python benchmarks/infrastructure_benchmark.py --detailed # Extra breakdown
    python benchmarks/infrastructure_benchmark.py --profile  # With cProfile output
"""

import argparse
import cProfile
import gc
import hashlib
import io
import logging
import pstats
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Disable logging during benchmarks for cleaner output
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

    @property
    def per_iteration_ms(self) -> float:
        return self.duration_ms / self.iterations


@dataclass
class BenchmarkSuite:
    """Collection of benchmark results."""
    name: str
    results: List[TimingResult] = field(default_factory=list)
    level: int = 0  # Hierarchy level (0=highest)

    def add(self, result: TimingResult):
        self.results.append(result)

    def get_stats(self, name: str) -> Dict[str, float]:
        """Get statistics for a specific benchmark."""
        timings = [r.duration_seconds for r in self.results if r.name == name]
        if not timings:
            return {}
        
        sorted_t = sorted(timings)
        return {
            "count": len(timings),
            "min_ms": min(timings) * 1000,
            "max_ms": max(timings) * 1000,
            "mean_ms": statistics.mean(timings) * 1000,
            "median_ms": statistics.median(timings) * 1000,
            "p95_ms": sorted_t[int(len(sorted_t) * 0.95)] * 1000 if len(sorted_t) >= 20 else sorted_t[-1] * 1000,
            "stddev_ms": statistics.stdev(timings) * 1000 if len(timings) > 1 else 0,
        }


def time_function(func: Callable, *args, warmup: int = 1, iterations: int = 10, **kwargs) -> List[float]:
    """Time a function over multiple iterations with warmup."""
    # Warmup runs (not measured)
    for _ in range(warmup):
        func(*args, **kwargs)
    
    # Timed runs
    timings = []
    for _ in range(iterations):
        gc.collect()  # Minimize GC interference
        start = time.perf_counter()
        func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        timings.append(elapsed)
    
    return timings


# =============================================================================
# TEST DATA
# =============================================================================

# Sample small document (~20 lines)
SMALL_DOCUMENT = """
namespace = test_events

test_events.0001 = {
    type = character_event
    title = test_events.0001.t
    desc = test_events.0001.desc
    
    trigger = {
        is_adult = yes
        is_ruler = yes
    }
    
    immediate = {
        save_scope_as = actor
    }
    
    option = {
        name = test_events.0001.a
        add_gold = 100
    }
}
"""

# Sample medium document (~100 lines)
MEDIUM_DOCUMENT = """
namespace = benchmark_events

benchmark_events.0001 = {
    type = character_event
    title = benchmark_events.0001.t
    desc = benchmark_events.0001.desc
    theme = intrigue
    
    left_portrait = root
    right_portrait = {
        character = liege
        animation = personality_rational
    }
    
    trigger = {
        is_adult = yes
        is_ruler = yes
        gold >= 100
        NOT = { has_trait = incapable }
        any_vassal = {
            is_adult = yes
            has_trait = ambitious
        }
    }
    
    immediate = {
        save_scope_as = actor
        liege = {
            save_scope_as = target_liege
        }
    }
    
    option = {
        name = benchmark_events.0001.a
        add_gold = 100
        trigger = {
            gold >= 50
        }
        ai_chance = {
            base = 50
            modifier = {
                add = 25
                has_trait = greedy
            }
        }
    }
    
    option = {
        name = benchmark_events.0001.b
        add_prestige = 50
        trigger_event = {
            id = benchmark_events.0002
            days = 30
        }
    }
    
    after = {
        hidden_effect = {
            add_character_flag = had_benchmark_event
        }
    }
}

benchmark_events.0002 = {
    type = character_event
    title = benchmark_events.0002.t
    desc = {
        first_valid = {
            triggered_desc = {
                trigger = { has_trait = brave }
                desc = benchmark_events.0002.desc_brave
            }
            triggered_desc = {
                trigger = { always = yes }
                desc = benchmark_events.0002.desc_default
            }
        }
    }
    
    left_portrait = root
    
    trigger = {
        is_adult = yes
    }
    
    option = {
        name = benchmark_events.0002.a
        add_gold = 100
    }
}

benchmark_events.0003 = {
    type = character_event
    hidden = yes
    
    trigger = {
        is_adult = yes
    }
    
    immediate = {
        every_vassal = {
            limit = { is_adult = yes }
            add_gold = 10
        }
    }
}
"""

# Generate large document (~500 lines) programmatically
def generate_large_document(num_events: int = 20) -> str:
    """Generate a large document with many events."""
    lines = ["namespace = large_benchmark\n"]
    
    for i in range(num_events):
        lines.append(f"""
large_benchmark.{i:04d} = {{
    type = character_event
    title = large_benchmark.{i:04d}.t
    desc = large_benchmark.{i:04d}.desc
    theme = intrigue
    
    left_portrait = root
    
    trigger = {{
        is_adult = yes
        is_ruler = yes
        gold >= {i * 10}
        NOT = {{ has_trait = incapable }}
    }}
    
    immediate = {{
        save_scope_as = actor_{i}
        add_character_flag = event_{i}_started
    }}
    
    option = {{
        name = large_benchmark.{i:04d}.a
        add_gold = {100 + i}
        ai_chance = {{
            base = 50
            modifier = {{
                add = 25
                has_trait = greedy
            }}
        }}
    }}
    
    option = {{
        name = large_benchmark.{i:04d}.b
        add_prestige = {50 + i}
    }}
}}
""")
    
    return "\n".join(lines)


LARGE_DOCUMENT = generate_large_document(20)


# =============================================================================
# LEVEL 3: MICRO-OPERATION BENCHMARKS
# =============================================================================

def benchmark_scope_type_inference(iterations: int = 100) -> BenchmarkSuite:
    """Benchmark scope type inference performance using real AST nodes."""
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.core.parser import parse_document
    
    suite = BenchmarkSuite("Scope Type Inference", level=3)
    index = DocumentIndex()
    
    # Parse a document to get real nodes
    ast, _ = parse_document(MEDIUM_DOCUMENT)
    
    # Collect all nodes from the AST
    all_nodes = []
    def collect_nodes(node):
        all_nodes.append(node)
        for child in node.children:
            collect_nodes(child)
    
    for node in ast:
        collect_nodes(node)
    
    # Benchmark inference on real nodes
    for node in all_nodes[:20]:  # Test first 20 nodes
        timings = time_function(index._infer_scope_type, node, warmup=1, iterations=iterations)
        node_desc = node.key[:20] if node.key else "unnamed"
        for t in timings:
            suite.add(TimingResult(f"infer_scope:{node_desc}", t, metadata={"key": node.key}))
    
    return suite


def benchmark_position_checks(iterations: int = 100) -> BenchmarkSuite:
    """Benchmark position range checking."""
    from lsprotocol import types
    from pychivalry.core.utils import position_in_range
    
    suite = BenchmarkSuite("Position Range Checks", level=3)
    
    # Create test ranges
    test_range = types.Range(
        start=types.Position(line=10, character=5),
        end=types.Position(line=50, character=20)
    )
    
    # Test positions
    test_cases = [
        (types.Position(line=5, character=0), "before"),
        (types.Position(line=30, character=10), "inside"),
        (types.Position(line=60, character=0), "after"),
        (types.Position(line=10, character=5), "start_exact"),
        (types.Position(line=50, character=20), "end_exact"),
    ]
    
    for pos, label in test_cases:
        timings = time_function(position_in_range, pos, test_range, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"position_in_range:{label}", t))
    
    return suite


def benchmark_content_hashing(iterations: int = 50) -> BenchmarkSuite:
    """Benchmark content hash generation for cache keys."""
    suite = BenchmarkSuite("Content Hashing", level=3)
    
    for doc_name, doc_content in [
        ("small", SMALL_DOCUMENT),
        ("medium", MEDIUM_DOCUMENT),
        ("large", LARGE_DOCUMENT),
    ]:
        def hash_content(content=doc_content):
            return hashlib.md5(content.encode()).hexdigest()
        
        timings = time_function(hash_content, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"md5_hash:{doc_name}", t, metadata={"size": len(doc_content)}))
    
    return suite


# =============================================================================
# LEVEL 2: SUB-OPERATION BENCHMARKS
# =============================================================================

def benchmark_tokenization(iterations: int = 20) -> BenchmarkSuite:
    """Benchmark tokenization phase only."""
    from pychivalry.core.parser import tokenize
    
    suite = BenchmarkSuite("Tokenization", level=2)
    
    for doc_name, doc_content in [
        ("small", SMALL_DOCUMENT),
        ("medium", MEDIUM_DOCUMENT),
        ("large", LARGE_DOCUMENT),
    ]:
        timings = time_function(tokenize, doc_content, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"tokenize:{doc_name}", t, metadata={
                "size": len(doc_content),
                "lines": doc_content.count("\n"),
            }))
    
    return suite


def benchmark_schema_lookup(iterations: int = 50) -> BenchmarkSuite:
    """Benchmark schema loading and lookup."""
    from pychivalry.schema.loader import SchemaLoader
    
    suite = BenchmarkSuite("Schema Operations", level=2)
    loader = SchemaLoader()
    
    # Measure initial load (cold)
    loader.clear_cache()
    start = time.perf_counter()
    loader.load_all()
    cold_load = time.perf_counter() - start
    suite.add(TimingResult("schema_load:cold", cold_load))
    
    # Measure lookup performance (warm)
    test_paths = [
        "common/events/test.txt",
        "common/decisions/test.txt",
        "common/story_cycles/test.txt",
        "common/on_actions/test.txt",
        "common/character_interactions/test.txt",
    ]
    
    for path in test_paths:
        timings = time_function(loader.get_schema_for_file, path, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"schema_lookup:{path.split('/')[1]}", t))
    
    return suite


def benchmark_completion_filtering(iterations: int = 30) -> BenchmarkSuite:
    """Benchmark completion item filtering."""
    from pychivalry.lsp.completions import (
        CompletionContext,
        filter_by_context,
        create_trigger_completions,
        create_effect_completions,
    )
    
    suite = BenchmarkSuite("Completion Filtering", level=2)
    
    # Measure cached item generation
    timings = time_function(create_trigger_completions, warmup=2, iterations=iterations)
    for t in timings:
        suite.add(TimingResult("create_triggers", t))
    
    timings = time_function(create_effect_completions, warmup=2, iterations=iterations)
    for t in timings:
        suite.add(TimingResult("create_effects", t))
    
    # Measure context-based filtering
    contexts = [
        CompletionContext(block_type="trigger"),
        CompletionContext(block_type="effect"),
        CompletionContext(block_type="option"),
        CompletionContext(block_type="unknown"),
        CompletionContext(after_dot=True, scope_type="character"),
    ]
    
    for ctx in contexts:
        ctx_name = ctx.block_type if not ctx.after_dot else "scope_link"
        timings = time_function(filter_by_context, ctx, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"filter_context:{ctx_name}", t))
    
    return suite


def benchmark_individual_validation_phases(iterations: int = 10) -> BenchmarkSuite:
    """Benchmark individual validation phases."""
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.ck3.validation.diagnostics import (
        check_syntax,
        check_semantics,
    )
    
    suite = BenchmarkSuite("Validation Phases", level=2)
    
    # Parse document first
    ast, errors = parse_document(MEDIUM_DOCUMENT)
    index = DocumentIndex()
    
    uri = "file:///test/benchmark.txt"
    
    # Benchmark syntax checking
    timings = time_function(
        check_syntax, ast, errors, MEDIUM_DOCUMENT, uri,
        warmup=2, iterations=iterations
    )
    for t in timings:
        suite.add(TimingResult("phase:syntax", t))
    
    # Benchmark semantic checking
    timings = time_function(
        check_semantics, ast, MEDIUM_DOCUMENT, uri, index,
        warmup=2, iterations=iterations
    )
    for t in timings:
        suite.add(TimingResult("phase:semantics", t))
    
    return suite


# =============================================================================
# LEVEL 1: CORE OPERATION BENCHMARKS
# =============================================================================

def benchmark_full_parse(iterations: int = 20) -> BenchmarkSuite:
    """Benchmark full document parsing."""
    from pychivalry.core.parser import parse_document
    
    suite = BenchmarkSuite("Full Document Parse", level=1)
    
    for doc_name, doc_content in [
        ("small", SMALL_DOCUMENT),
        ("medium", MEDIUM_DOCUMENT),
        ("large", LARGE_DOCUMENT),
    ]:
        timings = time_function(parse_document, doc_content, warmup=2, iterations=iterations)
        for t in timings:
            lines = doc_content.count("\n")
            suite.add(TimingResult(f"parse:{doc_name}", t, metadata={
                "size_bytes": len(doc_content),
                "lines": lines,
            }))
    
    return suite


def benchmark_incremental_parse(iterations: int = 20) -> BenchmarkSuite:
    """Benchmark incremental parsing with small edits."""
    from lsprotocol import types
    from pychivalry.core.incremental_parser import IncrementalParser
    
    suite = BenchmarkSuite("Incremental Parse", level=1)
    
    # Initialize parser with medium document
    parser = IncrementalParser()
    parser.parse(MEDIUM_DOCUMENT)
    
    # Create a small edit (change "add_gold = 100" to "add_gold = 200")
    # Find position of "100" in the document
    idx = MEDIUM_DOCUMENT.find("add_gold = 100")
    if idx != -1:
        # Calculate line and character
        lines_before = MEDIUM_DOCUMENT[:idx].count("\n")
        last_newline = MEDIUM_DOCUMENT.rfind("\n", 0, idx)
        char_pos = idx - last_newline - 1 + len("add_gold = ")
        
        change = types.TextDocumentContentChangeEvent(
            range=types.Range(
                start=types.Position(line=lines_before, character=char_pos),
                end=types.Position(line=lines_before, character=char_pos + 3),
            ),
            text="200"
        )
        
        new_text = MEDIUM_DOCUMENT.replace("add_gold = 100", "add_gold = 200", 1)
        
        def do_incremental():
            parser.invalidate()
            parser.parse(MEDIUM_DOCUMENT)
            return parser.incremental_parse(change, new_text)
        
        timings = time_function(do_incremental, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult("incremental:small_edit", t))
    
    return suite


def benchmark_document_indexing(iterations: int = 15) -> BenchmarkSuite:
    """Benchmark document indexing."""
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    
    suite = BenchmarkSuite("Document Indexing", level=1)
    
    for doc_name, doc_content in [
        ("small", SMALL_DOCUMENT),
        ("medium", MEDIUM_DOCUMENT),
        ("large", LARGE_DOCUMENT),
    ]:
        ast, _ = parse_document(doc_content)
        uri = f"file:///test/{doc_name}.txt"
        
        def index_document():
            index = DocumentIndex()
            index.update_from_ast(uri, ast)
            return index
        
        timings = time_function(index_document, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"index:{doc_name}", t))
    
    return suite


def benchmark_full_diagnostics(iterations: int = 10) -> BenchmarkSuite:
    """Benchmark full diagnostics collection."""
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.ck3.validation.diagnostics import collect_all_diagnostics
    
    suite = BenchmarkSuite("Full Diagnostics", level=1)
    
    index = DocumentIndex()
    
    for doc_name, doc_content in [
        ("small", SMALL_DOCUMENT),
        ("medium", MEDIUM_DOCUMENT),
        ("large", LARGE_DOCUMENT),
    ]:
        ast, errors = parse_document(doc_content)
        uri = f"file:///test/{doc_name}.txt"
        
        timings = time_function(
            collect_all_diagnostics, ast, errors, doc_content, uri, index,
            warmup=2, iterations=iterations
        )
        for t in timings:
            suite.add(TimingResult(f"diagnostics:{doc_name}", t))
    
    return suite


# =============================================================================
# LEVEL 0: FULL REQUEST CYCLE BENCHMARKS
# =============================================================================

def benchmark_full_document_open_cycle(iterations: int = 10) -> BenchmarkSuite:
    """Benchmark complete document open cycle: parse → index → validate."""
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.ck3.validation.diagnostics import collect_all_diagnostics
    
    suite = BenchmarkSuite("Full Document Open Cycle", level=0)
    
    for doc_name, doc_content in [
        ("small", SMALL_DOCUMENT),
        ("medium", MEDIUM_DOCUMENT),
        ("large", LARGE_DOCUMENT),
    ]:
        uri = f"file:///test/{doc_name}.txt"
        
        def full_cycle():
            # 1. Parse
            ast, errors = parse_document(doc_content)
            # 2. Index
            index = DocumentIndex()
            index.update_from_ast(uri, ast)
            # 3. Validate
            diagnostics = collect_all_diagnostics(ast, errors, doc_content, uri, index)
            return ast, index, diagnostics
        
        timings = time_function(full_cycle, warmup=2, iterations=iterations)
        for t in timings:
            suite.add(TimingResult(f"open_cycle:{doc_name}", t, metadata={
                "size_bytes": len(doc_content),
                "lines": doc_content.count("\n"),
            }))
    
    return suite


def benchmark_completion_request_cycle(iterations: int = 20) -> BenchmarkSuite:
    """Benchmark complete completion request cycle."""
    from lsprotocol import types
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.lsp.completions import get_context_aware_completions
    
    suite = BenchmarkSuite("Completion Request Cycle", level=0)
    
    # Setup
    ast, _ = parse_document(MEDIUM_DOCUMENT)
    uri = "file:///test/benchmark.txt"
    index = DocumentIndex()
    index.update_from_ast(uri, ast)
    
    # Test at different positions
    test_positions = [
        (25, 8, "in_trigger"),    # Inside trigger block
        (30, 8, "in_immediate"),  # Inside immediate block  
        (40, 8, "in_option"),     # Inside option block
        (5, 0, "top_level"),      # Top level
    ]
    
    lines = MEDIUM_DOCUMENT.split("\n")
    
    for line_num, char_num, context_name in test_positions:
        if line_num < len(lines):
            position = types.Position(line=line_num, character=char_num)
            line_text = lines[line_num] if line_num < len(lines) else ""
            
            def get_completions():
                # Pass None for ast since completions handles it
                # (In real server, get_node_at_position would be used)
                return get_context_aware_completions(uri, position, None, line_text, index)
            
            timings = time_function(get_completions, warmup=2, iterations=iterations)
            for t in timings:
                suite.add(TimingResult(f"completion:{context_name}", t))
    
    return suite


def benchmark_hover_request_cycle(iterations: int = 30) -> BenchmarkSuite:
    """Benchmark complete hover request cycle."""
    from lsprotocol import types
    from pygls.workspace import TextDocument
    from pychivalry.core.parser import parse_document
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.lsp.hover import create_hover_response
    
    suite = BenchmarkSuite("Hover Request Cycle", level=0)
    
    # Setup
    ast, _ = parse_document(MEDIUM_DOCUMENT)
    uri = "file:///test/benchmark.txt"
    index = DocumentIndex()
    index.update_from_ast(uri, ast)
    
    # Create TextDocument
    doc = TextDocument(uri=uri, source=MEDIUM_DOCUMENT)
    
    # Test hover on different symbol types
    # Find positions of known symbols
    test_symbols = [
        ("is_adult", "trigger"),
        ("add_gold", "effect"),
        ("save_scope_as", "keyword"),
        ("liege", "scope"),
    ]
    
    lines = MEDIUM_DOCUMENT.split("\n")
    
    for symbol, symbol_type in test_symbols:
        # Find the symbol in the document
        for line_num, line in enumerate(lines):
            idx = line.find(symbol)
            if idx != -1:
                position = types.Position(line=line_num, character=idx)
                
                def get_hover():
                    return create_hover_response(doc, position, ast, index)
                
                timings = time_function(get_hover, warmup=2, iterations=iterations)
                for t in timings:
                    suite.add(TimingResult(f"hover:{symbol_type}", t))
                break
    
    return suite


# =============================================================================
# COMBINED TIME BREAKDOWN
# =============================================================================

def benchmark_detailed_breakdown(iterations: int = 5) -> Dict[str, float]:
    """
    Measure time breakdown of a complete document open cycle.
    Returns percentages of time spent in each phase.
    """
    from pychivalry.core.parser import parse_document, tokenize
    from pychivalry.core.indexer import DocumentIndex
    from pychivalry.ck3.validation.diagnostics import collect_all_diagnostics
    
    doc_content = MEDIUM_DOCUMENT
    uri = "file:///test/breakdown.txt"
    
    total_times = {
        "tokenize": [],
        "parse_full": [],
        "index": [],
        "validate": [],
    }
    
    for _ in range(iterations):
        gc.collect()
        
        # Measure tokenization
        start = time.perf_counter()
        tokens = tokenize(doc_content)
        total_times["tokenize"].append(time.perf_counter() - start)
        
        # Measure full parse
        start = time.perf_counter()
        ast, errors = parse_document(doc_content)
        total_times["parse_full"].append(time.perf_counter() - start)
        
        # Measure indexing
        start = time.perf_counter()
        index = DocumentIndex()
        index.update_from_ast(uri, ast)
        total_times["index"].append(time.perf_counter() - start)
        
        # Measure validation
        start = time.perf_counter()
        diagnostics = collect_all_diagnostics(ast, errors, doc_content, uri, index)
        total_times["validate"].append(time.perf_counter() - start)
    
    # Calculate averages and percentages
    averages = {k: statistics.mean(v) for k, v in total_times.items()}
    total = sum(averages.values())
    
    return {
        "times_ms": {k: v * 1000 for k, v in averages.items()},
        "percentages": {k: (v / total) * 100 for k, v in averages.items()},
        "total_ms": total * 1000,
    }


# =============================================================================
# REPORTING
# =============================================================================

def print_suite_results(suite: BenchmarkSuite):
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
        
        print(f"\n  {name}:")
        print(f"    Samples: {stats['count']}")
        print(f"    Mean:    {stats['mean_ms']:8.3f} ms")
        print(f"    Median:  {stats['median_ms']:8.3f} ms")
        print(f"    Min:     {stats['min_ms']:8.3f} ms")
        print(f"    Max:     {stats['max_ms']:8.3f} ms")
        if stats['count'] >= 20:
            print(f"    P95:     {stats['p95_ms']:8.3f} ms")


def print_breakdown(breakdown: Dict[str, Any]):
    """Print time breakdown analysis."""
    print(f"\n{'=' * 70}")
    print("TIME BREAKDOWN ANALYSIS (Medium Document)")
    print("=" * 70)
    
    print(f"\n  Total cycle time: {breakdown['total_ms']:.2f} ms\n")
    
    print("  Phase breakdown:")
    for phase, pct in sorted(breakdown["percentages"].items(), key=lambda x: -x[1]):
        time_ms = breakdown["times_ms"][phase]
        bar_len = int(pct / 2)
        bar = "#" * bar_len  # Use ASCII character instead of Unicode
        print(f"    {phase:12s}: {time_ms:6.2f} ms ({pct:5.1f}%) {bar}")


def print_summary(all_suites: List[BenchmarkSuite]):
    """Print executive summary."""
    print(f"\n{'=' * 70}")
    print("EXECUTIVE SUMMARY")
    print("=" * 70)
    
    # Find the slowest operations at each level
    print("\n  Slowest operations by level:\n")
    
    for level in range(4):
        level_suites = [s for s in all_suites if s.level == level]
        if not level_suites:
            continue
        
        # Collect all results at this level
        all_results = []
        for suite in level_suites:
            for name in set(r.name for r in suite.results):
                stats = suite.get_stats(name)
                if stats:
                    all_results.append((name, stats["mean_ms"], suite.name))
        
        if all_results:
            # Sort by time descending
            all_results.sort(key=lambda x: -x[1])
            
            level_name = {
                0: "Full Request Cycles",
                1: "Core Operations",
                2: "Sub-operations",
                3: "Micro-operations",
            }.get(level, f"Level {level}")
            
            print(f"  Level {level} ({level_name}):")
            for name, time_ms, suite_name in all_results[:3]:
                print(f"    - {name}: {time_ms:.3f} ms")
            print()


# =============================================================================
# MAIN
# =============================================================================

def run_all_benchmarks(quick: bool = False, detailed: bool = False, profile: bool = False):
    """Run all benchmarks."""
    print("=" * 70)
    print("PyChivalry Infrastructure Performance Benchmark")
    print("=" * 70)
    print(f"Mode: {'Quick' if quick else 'Detailed' if detailed else 'Standard'}")
    
    # Adjust iterations based on mode
    if quick:
        iters = {"micro": 30, "sub": 10, "core": 5, "full": 3}
    elif detailed:
        iters = {"micro": 200, "sub": 50, "core": 30, "full": 20}
    else:
        iters = {"micro": 100, "sub": 20, "core": 15, "full": 10}
    
    all_suites: List[BenchmarkSuite] = []
    
    # Optional profiling wrapper
    profiler = None
    if profile:
        profiler = cProfile.Profile()
        profiler.enable()
    
    try:
        # Level 0: Full request cycles
        print("\n[1/8] Running full request cycle benchmarks...")
        all_suites.append(benchmark_full_document_open_cycle(iters["full"]))
        
        print("[2/8] Running completion request cycle benchmarks...")
        all_suites.append(benchmark_completion_request_cycle(iters["core"]))
        
        print("[3/8] Running hover request cycle benchmarks...")
        all_suites.append(benchmark_hover_request_cycle(iters["core"]))
        
        # Level 1: Core operations
        print("[4/8] Running full parse benchmarks...")
        all_suites.append(benchmark_full_parse(iters["core"]))
        
        print("[5/8] Running document indexing benchmarks...")
        all_suites.append(benchmark_document_indexing(iters["core"]))
        
        print("[6/8] Running full diagnostics benchmarks...")
        all_suites.append(benchmark_full_diagnostics(iters["core"]))
        
        # Level 2: Sub-operations
        print("[7/8] Running sub-operation benchmarks...")
        all_suites.append(benchmark_tokenization(iters["sub"]))
        all_suites.append(benchmark_schema_lookup(iters["sub"]))
        all_suites.append(benchmark_completion_filtering(iters["sub"]))
        
        if detailed:
            all_suites.append(benchmark_individual_validation_phases(iters["sub"]))
            all_suites.append(benchmark_incremental_parse(iters["sub"]))
        
        # Level 3: Micro-operations
        print("[8/8] Running micro-operation benchmarks...")
        all_suites.append(benchmark_scope_type_inference(iters["micro"]))
        all_suites.append(benchmark_position_checks(iters["micro"]))
        all_suites.append(benchmark_content_hashing(iters["micro"]))
        
    finally:
        if profiler:
            profiler.disable()
    
    # Print results
    for suite in sorted(all_suites, key=lambda s: s.level):
        print_suite_results(suite)
    
    # Time breakdown
    print("\n[Calculating time breakdown...]")
    breakdown = benchmark_detailed_breakdown(5 if quick else 10)
    print_breakdown(breakdown)
    
    # Summary
    print_summary(all_suites)
    
    # Profiler output
    if profiler:
        print(f"\n{'=' * 70}")
        print("PROFILER OUTPUT (Top 30 by cumulative time)")
        print("=" * 70)
        
        stream = io.StringIO()
        stats = pstats.Stats(profiler, stream=stream)
        stats.strip_dirs()
        stats.sort_stats("cumulative")
        stats.print_stats(30)
        print(stream.getvalue())


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Benchmark pychivalry infrastructure")
    parser.add_argument("--quick", action="store_true", help="Run quick benchmarks with fewer iterations")
    parser.add_argument("--detailed", action="store_true", help="Run detailed benchmarks with more iterations")
    parser.add_argument("--profile", action="store_true", help="Enable cProfile output")
    args = parser.parse_args()
    
    run_all_benchmarks(quick=args.quick, detailed=args.detailed, profile=args.profile)


if __name__ == "__main__":
    main()
