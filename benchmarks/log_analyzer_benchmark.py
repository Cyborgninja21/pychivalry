#!/usr/bin/env python3
"""
Performance benchmark for log analyzer parallel processing.

Compares serial vs parallel batch analysis performance on various batch sizes.
"""

import argparse
import statistics
import sys
import time
from pathlib import Path
from typing import List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pychivalry.log.analyzer import CK3LogAnalyzer


def generate_test_logs(count: int) -> List[str]:
    """Generate test log lines with mixed patterns."""
    lines = []
    
    # Mix of different error types
    patterns = [
        lambda i: f"[error] Unknown effect: effect_{i}",
        lambda i: f"[error] Unknown trigger: trigger_{i}",
        lambda i: f"[warning] Missing localization key: key_{i}",
        lambda i: f"[error] Event test.{i} not found",
        lambda i: f"[error] Script system error! in file_{i}.txt",
        lambda i: f"Normal log line {i} - no pattern match",
    ]
    
    for i in range(count):
        pattern = patterns[i % len(patterns)]
        lines.append(pattern(i))
    
    return lines


def benchmark_serial(analyzer: CK3LogAnalyzer, lines: List[str], iterations: int = 3) -> dict:
    """Benchmark serial processing."""
    times = []
    
    # Disable parallel processing
    old_parallel = analyzer._use_parallel
    analyzer._use_parallel = False
    
    for _ in range(iterations):
        analyzer.reset_statistics()
        
        start = time.perf_counter()
        results = analyzer.analyze_batch(lines, "benchmark.log")
        elapsed = time.perf_counter() - start
        
        times.append(elapsed)
    
    # Restore setting
    analyzer._use_parallel = old_parallel
    
    return {
        "min": min(times),
        "max": max(times),
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "stddev": statistics.stdev(times) if len(times) > 1 else 0,
        "iterations": iterations,
    }


def benchmark_parallel(analyzer: CK3LogAnalyzer, lines: List[str], iterations: int = 3) -> dict:
    """Benchmark parallel processing."""
    times = []
    
    # Enable parallel processing
    old_parallel = analyzer._use_parallel
    analyzer._use_parallel = True
    
    for _ in range(iterations):
        analyzer.reset_statistics()
        
        start = time.perf_counter()
        results = analyzer.analyze_batch(lines, "benchmark.log")
        elapsed = time.perf_counter() - start
        
        times.append(elapsed)
    
    # Restore setting
    analyzer._use_parallel = old_parallel
    
    return {
        "min": min(times),
        "max": max(times),
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "stddev": statistics.stdev(times) if len(times) > 1 else 0,
        "iterations": iterations,
    }


def print_comparison(batch_size: int, serial_stats: dict, parallel_stats: dict):
    """Print comparison results."""
    speedup = serial_stats["mean"] / parallel_stats["mean"] if parallel_stats["mean"] > 0 else 0
    
    print(f"\n{'=' * 70}")
    print(f"Batch Size: {batch_size:,} lines")
    print(f"{'=' * 70}")
    
    print(f"\nSerial Processing:")
    print(f"  Mean:   {serial_stats['mean']:.4f}s ({serial_stats['mean'] * 1000:.2f}ms)")
    print(f"  Median: {serial_stats['median']:.4f}s ({serial_stats['median'] * 1000:.2f}ms)")
    print(f"  Min:    {serial_stats['min']:.4f}s")
    print(f"  Max:    {serial_stats['max']:.4f}s")
    print(f"  StdDev: {serial_stats['stddev']:.4f}s")
    
    print(f"\nParallel Processing:")
    print(f"  Mean:   {parallel_stats['mean']:.4f}s ({parallel_stats['mean'] * 1000:.2f}ms)")
    print(f"  Median: {parallel_stats['median']:.4f}s ({parallel_stats['median'] * 1000:.2f}ms)")
    print(f"  Min:    {parallel_stats['min']:.4f}s")
    print(f"  Max:    {parallel_stats['max']:.4f}s")
    print(f"  StdDev: {parallel_stats['stddev']:.4f}s")
    
    print(f"\nSpeedup: {speedup:.2f}x")
    
    if speedup > 1.0:
        improvement = (speedup - 1.0) * 100
        print(f"Improvement: {improvement:.1f}% faster with parallel processing")
    elif speedup < 1.0:
        degradation = (1.0 - speedup) * 100
        print(f"Degradation: {degradation:.1f}% slower with parallel processing")
    else:
        print("Performance: No significant difference")
    
    # Throughput
    serial_throughput = batch_size / serial_stats['mean']
    parallel_throughput = batch_size / parallel_stats['mean']
    
    print(f"\nThroughput:")
    print(f"  Serial:   {serial_throughput:,.0f} lines/sec")
    print(f"  Parallel: {parallel_throughput:,.0f} lines/sec")


def run_benchmarks(batch_sizes: List[int], iterations: int = 3):
    """Run benchmarks for different batch sizes."""
    print("=" * 70)
    print("Log Analyzer - Serial vs Parallel Performance Benchmark")
    print("=" * 70)
    
    analyzer = CK3LogAnalyzer(None)
    
    print(f"\nConfiguration:")
    print(f"  Parallel: {analyzer._use_parallel}")
    print(f"  Chunk Size: {analyzer._chunk_size:,}")
    print(f"  Iterations per batch: {iterations}")
    
    results = []
    
    for batch_size in batch_sizes:
        print(f"\nGenerating {batch_size:,} test log lines...")
        lines = generate_test_logs(batch_size)
        
        print(f"Running serial benchmark...")
        serial_stats = benchmark_serial(analyzer, lines, iterations)
        
        print(f"Running parallel benchmark...")
        parallel_stats = benchmark_parallel(analyzer, lines, iterations)
        
        print_comparison(batch_size, serial_stats, parallel_stats)
        
        results.append({
            "batch_size": batch_size,
            "serial": serial_stats,
            "parallel": parallel_stats,
            "speedup": serial_stats["mean"] / parallel_stats["mean"] if parallel_stats["mean"] > 0 else 0,
        })
    
    # Summary
    print(f"\n{'=' * 70}")
    print("Summary")
    print(f"{'=' * 70}")
    print(f"\n{'Batch Size':>12} | {'Serial (ms)':>12} | {'Parallel (ms)':>14} | {'Speedup':>8}")
    print("-" * 70)
    
    for result in results:
        batch = result["batch_size"]
        serial_ms = result["serial"]["mean"] * 1000
        parallel_ms = result["parallel"]["mean"] * 1000
        speedup = result["speedup"]
        
        print(f"{batch:>12,} | {serial_ms:>12.2f} | {parallel_ms:>14.2f} | {speedup:>7.2f}x")
    
    # Recommendations
    print(f"\n{'=' * 70}")
    print("Recommendations")
    print(f"{'=' * 70}")
    
    # Find crossover point where parallel becomes beneficial
    for result in results:
        if result["speedup"] > 1.1:  # 10% improvement threshold
            print(f"\nParallel processing becomes beneficial at ~{result['batch_size']:,} lines")
            print(f"Current chunk size: {analyzer._chunk_size:,} lines")
            break
    else:
        print("\nParallel processing did not show significant speedup in tested range")
        print("Consider testing with larger batch sizes or adjusting chunk size")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Benchmark log analyzer serial vs parallel performance"
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run quick benchmark with small batches"
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Run full benchmark with large batches"
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=3,
        help="Number of iterations per batch size (default: 3)"
    )
    
    args = parser.parse_args()
    
    if args.quick:
        batch_sizes = [100, 500, 1000, 2000]
        iterations = 2
    elif args.full:
        batch_sizes = [100, 500, 1000, 2000, 5000, 10000, 20000]
        iterations = 5
    else:
        # Default
        batch_sizes = [500, 1000, 2000, 5000, 10000]
        iterations = args.iterations
    
    run_benchmarks(batch_sizes, iterations)


if __name__ == "__main__":
    main()
