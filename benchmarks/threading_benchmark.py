#!/usr/bin/env python3
"""
Performance benchmarking script for the pychivalry threading system.

This script measures:
- Task submission throughput
- Task completion latency (P50, P95, P99)
- Cancellation performance (O(1) URI-based vs O(n) scan)
- Priority scheduling effectiveness
- Lock contention and overhead
- Thread pool scalability

Usage:
    python benchmarks/threading_benchmark.py
    python benchmarks/threading_benchmark.py --quick  # Run quick benchmarks only
    python benchmarks/threading_benchmark.py --full   # Run all benchmarks including stress tests
"""

import argparse
import asyncio
import itertools
import statistics
import sys
import time
from concurrent.futures import Future
from pathlib import Path
from typing import List, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pychivalry.threading import CK3ThreadManager, TaskPriority


class BenchmarkResult:
    """Container for benchmark results."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.measurements: List[float] = []

    def add(self, value: float):
        """Add a measurement."""
        self.measurements.append(value)

    def stats(self) -> dict:
        """Calculate statistics."""
        if not self.measurements:
            return {"count": 0}

        sorted_data = sorted(self.measurements)
        return {
            "count": len(self.measurements),
            "min": min(self.measurements),
            "max": max(self.measurements),
            "mean": statistics.mean(self.measurements),
            "median": statistics.median(self.measurements),
            "p95": sorted_data[int(len(sorted_data) * 0.95)],
            "p99": sorted_data[int(len(sorted_data) * 0.99)],
            "stddev": statistics.stdev(self.measurements) if len(self.measurements) > 1 else 0,
        }

    def report(self):
        """Print benchmark report."""
        stats = self.stats()
        if stats["count"] == 0:
            print(f"\n{self.name}: No measurements")
            return

        print(f"\n{self.name}")
        print(f"  Description: {self.description}")
        print(f"  Samples: {stats['count']}")
        print(f"  Min:     {stats['min']:.6f}s ({stats['min'] * 1_000_000:.2f}us)")
        print(f"  Mean:    {stats['mean']:.6f}s ({stats['mean'] * 1_000_000:.2f}us)")
        print(f"  Median:  {stats['median']:.6f}s ({stats['median'] * 1_000_000:.2f}us)")
        print(f"  P95:     {stats['p95']:.6f}s ({stats['p95'] * 1_000_000:.2f}us)")
        print(f"  P99:     {stats['p99']:.6f}s ({stats['p99'] * 1_000_000:.2f}us)")
        print(f"  Max:     {stats['max']:.6f}s ({stats['max'] * 1_000_000:.2f}us)")
        print(f"  StdDev:  {stats['stddev']:.6f}s")


def benchmark_task_submission(mgr: CK3ThreadManager, num_tasks: int = 1000) -> BenchmarkResult:
    """Benchmark task submission overhead."""
    result = BenchmarkResult(
        "Task Submission",
        f"Time to submit {num_tasks} tasks to the thread pool"
    )

    def dummy_task():
        return 42

    futures = []
    for _ in range(num_tasks):
        start = time.perf_counter()
        future = mgr.submit_cpu_bound(dummy_task, priority=TaskPriority.NORMAL)
        elapsed = time.perf_counter() - start
        result.add(elapsed)
        futures.append(future)

    # Wait for all to complete
    for f in futures:
        f.result(timeout=10.0)

    return result


def benchmark_task_latency(mgr: CK3ThreadManager, num_tasks: int = 100) -> BenchmarkResult:
    """Benchmark end-to-end task latency."""
    result = BenchmarkResult(
        "Task Latency",
        f"End-to-end latency for {num_tasks} tasks (submission to completion)"
    )

    def simple_task():
        return time.perf_counter()

    for _ in range(num_tasks):
        submit_time = time.perf_counter()
        future = mgr.submit_cpu_bound(simple_task, priority=TaskPriority.HIGH)
        completion_time = future.result(timeout=5.0)
        latency = completion_time - submit_time
        result.add(latency)

    return result


def benchmark_uri_cancellation(mgr: CK3ThreadManager, num_tasks: int = 100) -> BenchmarkResult:
    """Benchmark O(1) URI-based cancellation."""
    result = BenchmarkResult(
        "URI Cancellation (O(1))",
        f"Time to cancel {num_tasks} tasks by URI using hash index"
    )

    def slow_task():
        time.sleep(1.0)
        return "completed"

    # Run multiple iterations
    for iteration in range(5):
        # Submit tasks with URI
        uri = f"file:///test/document-{iteration}.py"
        futures = []
        for i in range(num_tasks):
            f = mgr.submit_cpu_bound(
                slow_task,
                priority=TaskPriority.LOW,
                task_id=f"task-{iteration}-{i}",
                uri=uri
            )
            futures.append(f)

        # Give tasks time to queue
        time.sleep(0.01)

        # Measure cancellation time
        start = time.perf_counter()
        cancelled_count = mgr.cancel_by_uri(uri)
        elapsed = time.perf_counter() - start
        result.add(elapsed)

    return result


def benchmark_prefix_cancellation(mgr: CK3ThreadManager, num_tasks: int = 100) -> BenchmarkResult:
    """Benchmark O(n) prefix-based cancellation."""
    result = BenchmarkResult(
        "Prefix Cancellation (O(n))",
        f"Time to cancel {num_tasks} tasks by prefix using linear scan"
    )

    def slow_task():
        time.sleep(1.0)
        return "completed"

    # Run multiple iterations
    for iteration in range(5):
        # Submit tasks with prefix
        prefix = f"parse-{iteration}"
        futures = []
        for i in range(num_tasks):
            f = mgr.submit_cpu_bound(
                slow_task,
                priority=TaskPriority.LOW,
                task_id=f"{prefix}-task-{i}"
            )
            futures.append(f)

        # Give tasks time to queue
        time.sleep(0.01)

        # Measure cancellation time
        start = time.perf_counter()
        cancelled_count = mgr.cancel_by_prefix(prefix)
        elapsed = time.perf_counter() - start
        result.add(elapsed)

    return result


def benchmark_priority_enforcement(mgr: CK3ThreadManager, num_tasks: int = 50) -> BenchmarkResult:
    """Benchmark priority scheduling effectiveness."""
    result = BenchmarkResult(
        "Priority Enforcement",
        f"Latency difference between CRITICAL and LOW priority tasks"
    )

    critical_latencies = []
    low_latencies = []

    def blocker():
        """Fill the thread pool."""
        time.sleep(0.5)

    # Fill the pool with blockers
    cpu_workers = mgr.get_metrics()["cpu_workers"]
    blocking_futures = []
    for i in range(cpu_workers):
        f = mgr.submit_cpu_bound(blocker, priority=TaskPriority.BACKGROUND)
        blocking_futures.append(f)

    time.sleep(0.1)  # Let blockers start

    # Submit LOW priority tasks first
    def measure_task(task_type: str, latencies: list):
        start = time.perf_counter()
        # Task runs
        elapsed = time.perf_counter() - start
        latencies.append(elapsed)

    for i in range(num_tasks):
        mgr.submit_cpu_bound(
            measure_task, "LOW", low_latencies,
            priority=TaskPriority.LOW,
            task_id=f"low-{i}"
        )

    time.sleep(0.05)  # Ensure LOW tasks queued

    # Submit CRITICAL priority tasks
    critical_futures = []
    for i in range(num_tasks):
        submit_time = time.perf_counter()
        f = mgr.submit_cpu_bound(
            measure_task, "CRITICAL", critical_latencies,
            priority=TaskPriority.CRITICAL,
            task_id=f"critical-{i}"
        )
        critical_futures.append((submit_time, f))

    # Wait for CRITICAL tasks and measure latency
    for submit_time, f in critical_futures:
        f.result(timeout=5.0)
        latency = time.perf_counter() - submit_time
        result.add(latency)

    # Wait for blockers to complete
    for f in blocking_futures:
        try:
            f.result(timeout=1.0)
        except Exception:
            pass

    return result


def benchmark_throughput(mgr: CK3ThreadManager, duration_seconds: float = 2.0) -> dict:
    """Benchmark overall throughput."""
    print(f"\nThroughput Benchmark (running for {duration_seconds}s)")

    completed_count = 0
    start_time = time.perf_counter()
    end_time = start_time + duration_seconds

    def fast_task(x: int):
        return x * 2

    futures = []
    task_counter = itertools.count()

    while time.perf_counter() < end_time:
        task_num = next(task_counter)
        future = mgr.submit_cpu_bound(fast_task, task_num, priority=TaskPriority.NORMAL)
        futures.append(future)

    # Wait for all to complete
    for f in futures:
        try:
            f.result(timeout=5.0)
            completed_count += 1
        except Exception:
            pass

    elapsed = time.perf_counter() - start_time
    throughput = completed_count / elapsed

    print(f"  Total tasks: {completed_count}")
    print(f"  Duration: {elapsed:.2f}s")
    print(f"  Throughput: {throughput:.2f} tasks/sec")

    return {
        "total_tasks": completed_count,
        "duration": elapsed,
        "throughput": throughput
    }


def benchmark_asyncio_integration(num_tasks: int = 100) -> BenchmarkResult:
    """Benchmark asyncio integration overhead."""
    result = BenchmarkResult(
        "Asyncio Integration",
        f"Overhead of asyncio.wrap_future for {num_tasks} tasks"
    )

    async def run_async_benchmark():
        mgr = CK3ThreadManager()

        try:
            def simple_task(x: int):
                return x * 2

            for i in range(num_tasks):
                start = time.perf_counter()
                future = mgr.submit_cpu_bound(simple_task, i, priority=TaskPriority.NORMAL)
                await asyncio.wrap_future(future)
                elapsed = time.perf_counter() - start
                result.add(elapsed)

        finally:
            mgr.shutdown(wait=True)

    asyncio.run(run_async_benchmark())
    return result


def run_benchmarks(quick: bool = False, full: bool = False):
    """Run all benchmarks."""
    print("=" * 70)
    print("PyChivalry Threading System - Performance Benchmarks")
    print("=" * 70)

    mgr = CK3ThreadManager()

    try:
        metrics = mgr.get_metrics()
        print(f"\nThread Pool Configuration:")
        print(f"  CPU Workers: {metrics['cpu_workers']}")
        print(f"  I/O Workers: {metrics['io_workers']}")
        print(f"  Priority Scheduling: {'Enabled' if mgr._use_priority_scheduling else 'Disabled'}")

        # Always run core benchmarks
        benchmarks = [
            ("submission", lambda: benchmark_task_submission(mgr, 1000)),
            ("latency", lambda: benchmark_task_latency(mgr, 100)),
            ("uri_cancel", lambda: benchmark_uri_cancellation(mgr, 20 if quick else 100)),
        ]

        if not quick:
            benchmarks.extend([
                ("prefix_cancel", lambda: benchmark_prefix_cancellation(mgr, 100)),
                ("priority", lambda: benchmark_priority_enforcement(mgr, 20)),
            ])

        if full:
            benchmarks.extend([
                ("uri_cancel_stress", lambda: benchmark_uri_cancellation(mgr, 500)),
                ("prefix_cancel_stress", lambda: benchmark_prefix_cancellation(mgr, 500)),
            ])

        results = {}
        for name, benchmark_func in benchmarks:
            print(f"\nRunning {name}...")
            result = benchmark_func()
            result.report()
            results[name] = result

        # Throughput benchmark
        throughput_stats = benchmark_throughput(mgr, 2.0 if quick else 5.0)

        # Asyncio integration
        print("\nRunning asyncio integration benchmark...")
        asyncio_result = benchmark_asyncio_integration(50 if quick else 100)
        asyncio_result.report()

        # Final metrics
        print("\n" + "=" * 70)
        print("Final Thread Manager Metrics")
        print("=" * 70)
        final_metrics = mgr.get_metrics()
        for key, value in final_metrics.items():
            print(f"  {key}: {value}")

        print("\n" + "=" * 70)
        print("Benchmark Summary")
        print("=" * 70)
        print(f"  Task submission: {results['submission'].stats()['mean'] * 1_000_000:.2f}us mean")
        print(f"  Task latency: {results['latency'].stats()['median'] * 1000:.2f}ms P50")
        print(f"  URI cancellation: {results['uri_cancel'].stats()['mean'] * 1_000_000:.2f}us mean ({len(results['uri_cancel'].measurements)} samples)")
        print(f"  Throughput: {throughput_stats['throughput']:.2f} tasks/sec")

        if not quick:
            print(f"  Priority enforcement: {results['priority'].stats()['median'] * 1000:.2f}ms P50 for CRITICAL")
            print(f"  Prefix cancellation: {results['prefix_cancel'].stats()['mean'] * 1_000_000:.2f}us mean")

    finally:
        mgr.shutdown(wait=True)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Benchmark pychivalry threading system")
    parser.add_argument("--quick", action="store_true", help="Run quick benchmarks only")
    parser.add_argument("--full", action="store_true", help="Run all benchmarks including stress tests")
    args = parser.parse_args()

    run_benchmarks(quick=args.quick, full=args.full)


if __name__ == "__main__":
    main()
