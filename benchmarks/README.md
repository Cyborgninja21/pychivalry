# Benchmarks

Performance benchmarking tools for pychivalry components.

## Available Benchmarks

### Threading Benchmark (`threading_benchmark.py`)

Measures performance of the custom thread management system.

**Usage:**
```bash
# Run all benchmarks
python benchmarks/threading_benchmark.py

# Run quick benchmarks only
python benchmarks/threading_benchmark.py --quick

# Run full benchmarks including stress tests
python benchmarks/threading_benchmark.py --full
```

**Metrics:**
- Task submission throughput
- Task completion latency (P50, P95, P99)
- Cancellation performance (O(1) URI-based vs O(n) scan)
- Priority scheduling effectiveness
- Lock contention and overhead
- Thread pool scalability

### Log Analyzer Benchmark (`log_analyzer_benchmark.py`)

Compares serial vs parallel batch analysis performance.

**Usage:**
```bash
# Run default benchmark
python benchmarks/log_analyzer_benchmark.py

# Run quick benchmark
python benchmarks/log_analyzer_benchmark.py --quick

# Run full benchmark with large batches
python benchmarks/log_analyzer_benchmark.py --full

# Custom iterations
python benchmarks/log_analyzer_benchmark.py --iterations 5
```

**Metrics:**
- Serial processing throughput
- Parallel processing throughput
- Speedup ratio
- Performance recommendations

**Note:** Due to Python's GIL (Global Interpreter Lock), parallel processing for CPU-bound regex 
pattern matching typically does not provide speedup. The parallel implementation is available 
for use cases with I/O-heavy patterns or alternative Python interpreters (e.g., PyPy).

## Configuration

Benchmarks respect environment variables for configuration:

### Threading System
- `CK3_MAX_CPU_WORKERS`: Maximum CPU pool workers (default: min(4, cpu_count))
- `CK3_MAX_IO_WORKERS`: Maximum I/O pool workers (default: 4)
- `CK3_PRIORITY_SCHEDULING`: Enable priority scheduling (default: "1")

### Log Analyzer
- `CK3_LOG_PARALLEL`: Enable parallel processing (default: "1" - enabled)
- `CK3_LOG_CHUNK_SIZE`: Lines per chunk (default: "500")
- `CK3_LOG_PARALLEL_THRESHOLD`: Min lines to trigger parallel (default: "5000")

## Interpreting Results

### Threading Benchmark

Good performance indicators:
- Task submission < 10μs mean
- Task latency < 5ms P50
- URI cancellation < 100μs mean
- Throughput > 10,000 tasks/sec

### Log Analyzer Benchmark

Expected results (CPython):
- Serial: ~40,000-50,000 lines/sec
- Parallel: Similar performance, provides infrastructure for optimization
- Note: Python GIL limits CPU-bound speedup; parallel enabled by default for large batches

## Running Benchmarks in CI/CD

For automated performance regression testing:

```bash
# Quick benchmarks for CI
python benchmarks/threading_benchmark.py --quick
python benchmarks/log_analyzer_benchmark.py --quick
```

## Contributing

When adding new benchmarks:
1. Follow the existing structure (argparse, quick/full modes)
2. Report metrics in a tabular format
3. Include performance recommendations
4. Document expected results and what constitutes good performance
5. Add a section to this README


### Infrastructure Benchmark v2 (`infrastructure_benchmark_v2.py`)

Comprehensive performance benchmark suite for core LSP operations.

**Usage:**
```bash
# Quick run (recommended for regular checks)
python benchmarks/infrastructure_benchmark_v2.py --quick

# Include parser stress tests
python benchmarks/infrastructure_benchmark_v2.py --stress

# Include memory profiling
python benchmarks/infrastructure_benchmark_v2.py --memory

# Include scaling analysis
python benchmarks/infrastructure_benchmark_v2.py --scaling

# Run everything
python benchmarks/infrastructure_benchmark_v2.py --all
```

**Benchmark Categories:**

| Category | Description |
|----------|-------------|
| Cold vs Warm Schema | Measures startup vs runtime performance |
| Individual YAML Loading | Identifies slowest data files |
| Parser Stress Tests | Deeply nested, wide structures, long lines |
| Memory Profiling | Tracks memory usage per operation |
| Real File Benchmarks | Tests against example mod files |
| Scaling Analysis | Documents performance vs document size |
| Cache Efficiency | Measures cache hit rates and speedup |
| GC Impact | Garbage collection overhead |
| Incremental Parsing | Various edit type performance |

## Latest Benchmark Results

### Key Bottlenecks Identified

| Bottleneck | Time | Impact |
|------------|------|--------|
| **Schema YAML Loading (cold)** | ~350-400ms | #1 bottleneck - affects startup |
| activity_types.yaml (30KB) | ~72-76ms | Largest single schema file |
| triggers.yaml (22KB) | ~48-52ms | Effect/trigger definitions |
| effects.yaml (23KB) | ~48-50ms | Effect/trigger definitions |
| Trait names (cold) | ~95-100ms | First trait lookup load |

### Scaling Performance (Linear)

| Operation | ms per event | Growth Rate |
|-----------|--------------|-------------|
| Tokenization | 0.29-0.33 | O(n) |
| Parsing | 0.59-0.66 | O(n) |
| Indexing | 0.09-0.11 | O(n) - very efficient |

### Cache Efficiency (Excellent)

| Cache Type | Miss Time | Hit Time | Speedup |
|------------|-----------|----------|---------|
| Triggers | ~50ms | 0.006ms | **~8,000x** |
| Effects | ~50ms | 0.006ms | **~8,000x** |

### Memory Usage

| Document Size | Lines | Parse (Peak) | Index (Peak) |
|---------------|-------|--------------|--------------|
| Small | 105 | 0.05 MB | 0.02 MB |
| Medium | 341 | 0.17 MB | 0.03 MB |
| Large | 1,681 | 0.85 MB | 0.05 MB |
| XLarge | 5,001 | 2.55 MB | 0.10 MB |

### Parser Stress Test Results

| Test Case | Description | Time |
|-----------|-------------|------|
| Deeply Nested | 30-level nesting | 1.5ms |
| Very Wide | 200 siblings | 2.9ms |
| Long Lines | 1000-char lines | 0.5ms |
| XLarge | 5001 lines, 100KB | 45ms |

### Incremental Parsing (Consistent)

| Edit Type | Time | Notes |
|-----------|------|-------|
| Single character | 1.16ms | Very fast |
| Insert block | 1.58ms | Consistent |
| Delete multiple lines | 1.58ms | Consistent |

### GC Impact
- GC enabled: ~15ms average parse
- GC disabled: ~14ms average parse
- Overhead: ~6-7%

## Optimization Recommendations

Based on benchmark results:

### HIGH PRIORITY
1. **YAML Loading Optimization** (~350ms startup)
   - Consider lazy loading schemas on first access
   - Use faster YAML parser (ruamel.yaml.clib)
   - Cache compiled schemas to disk (pickle/msgpack)
   - Load schemas in parallel using ThreadPoolExecutor

### MEDIUM PRIORITY
2. **Trait Data Optimization** (~100ms on first access)
   - Implement lazy loading for trait definitions
   - Pre-build trait lookup tables at install time

### ALREADY OPTIMIZED ✅
- Parser performance (linear O(n) scaling)
- Indexer (extremely efficient ~0.1ms/event)
- Cache system (8000x speedup on hits)
- Incremental parsing (consistent ~1.5ms)
- Memory usage (efficient linear growth)
