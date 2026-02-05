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
- `CK3_LOG_PARALLEL`: Enable parallel processing (default: "0" - disabled)
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
- Parallel: Similar or slower due to GIL overhead
- Speedup: ~0.6-1.1x (parallel disabled by default)

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
