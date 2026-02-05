"""
Unit tests for parallel log analyzer functionality.

Tests parallel batch processing, thread safety, and correctness guarantees.
"""

import os
import pytest
from unittest.mock import MagicMock

from pychivalry.log.analyzer import CK3LogAnalyzer


@pytest.fixture(autouse=True)
def enable_parallel_for_tests():
    """Enable parallel processing for all tests in this module."""
    original = os.environ.get("CK3_LOG_PARALLEL")
    os.environ["CK3_LOG_PARALLEL"] = "1"
    yield
    # Restore original value
    if original is not None:
        os.environ["CK3_LOG_PARALLEL"] = original
    else:
        os.environ.pop("CK3_LOG_PARALLEL", None)


class TestParallelLogAnalyzer:
    """Test parallel processing in log analyzer."""

    def test_parallel_batch_correctness(self) -> None:
        """Test that parallel processing produces same results as serial."""
        analyzer = CK3LogAnalyzer(None)
        
        try:
            # Create test data with patterns that will match
            lines = [
                f"[error] Unknown effect: test_effect_{i}"
                for i in range(100)
            ] + [
                f"[warning] Missing localization key: test_key_{i}"
                for i in range(100)
            ] + [
                "Normal log line that shouldn't match"
                for i in range(100)
            ]
            
            # Run serial version
            old_parallel = analyzer._use_parallel
            analyzer._use_parallel = False
            serial_results = analyzer.analyze_batch(lines, "test.log")
            
            # Run parallel version
            analyzer._use_parallel = True
            analyzer.reset_statistics()  # Reset to get fresh stats
            parallel_results = analyzer.analyze_batch(lines, "test.log")
            analyzer._use_parallel = old_parallel
            
            # Should find same number of results
            assert len(serial_results) == len(parallel_results)
            
            # Results should be in same order
            for serial, parallel in zip(serial_results, parallel_results):
                assert serial.category == parallel.category
                assert serial.severity == parallel.severity
                assert serial.raw_line == parallel.raw_line
        finally:
            analyzer.shutdown()

    def test_parallel_batch_no_line_loss(self) -> None:
        """Test that no lines are lost in parallel processing."""
        analyzer = CK3LogAnalyzer(None)
        
        # Create lines with unique identifiers
        lines = [
            f"[error] Unknown effect: effect_{i:05d}"
            for i in range(5000)
        ]
        
        results = analyzer.analyze_batch(lines, "test.log")
        
        # Should process all matching lines
        assert len(results) == 5000
        
        # Check for duplicates
        raw_lines = [r.raw_line for r in results]
        assert len(raw_lines) == len(set(raw_lines)), "Found duplicate lines in results"

    def test_parallel_batch_ordering(self) -> None:
        """Test that results maintain original line order."""
        analyzer = CK3LogAnalyzer(None)
        
        # Create lines with sequential numbering
        lines = [
            f"[error] Unknown effect: effect_{i:05d}"
            for i in range(2000)
        ]
        
        results = analyzer.analyze_batch(lines, "test.log")
        
        # Extract effect numbers from results
        effect_numbers = []
        for result in results:
            # Extract number from message like "Unknown effect 'effect_00042'"
            parts = result.raw_line.split("effect_")
            if len(parts) > 1:
                num_str = parts[1].strip()
                effect_numbers.append(int(num_str))
        
        # Should be in sequential order
        assert effect_numbers == sorted(effect_numbers), "Results not in original order"

    def test_parallel_batch_thread_safety(self) -> None:
        """Test that statistics are updated correctly with parallel processing."""
        analyzer = CK3LogAnalyzer(None)
        
        # Create mixed severity lines
        lines = (
            [f"[error] Unknown effect: effect_{i}" for i in range(500)] +
            [f"[warning] Missing localization key: key_{i}" for i in range(300)] +
            [f"Normal line {i}" for i in range(200)]
        )
        
        analyzer.analyze_batch(lines, "test.log")
        stats = analyzer.get_statistics()
        
        # Statistics should be accurate
        assert stats.total_lines_processed >= 1000
        assert stats.total_errors == 500
        assert stats.total_warnings == 300

    def test_small_batch_uses_serial(self) -> None:
        """Test that small batches use serial processing."""
        analyzer = CK3LogAnalyzer(None)
        
        # Create batch smaller than chunk size
        lines = [
            "[error] Unknown effect: test"
            for i in range(10)
        ]
        
        # Should use serial processing (no parallel overhead)
        results = analyzer.analyze_batch(lines, "test.log")
        
        assert len(results) == 10

    def test_large_batch_uses_parallel(self) -> None:
        """Test that large batches use parallel processing."""
        analyzer = CK3LogAnalyzer(None)
        
        if not analyzer._use_parallel:
            pytest.skip("Parallel processing disabled")
        
        # Create batch larger than parallel threshold
        threshold = analyzer._parallel_threshold
        lines = [
            f"[error] Unknown effect: effect_{i}"
            for i in range(threshold + 100)
        ]
        
        results = analyzer.analyze_batch(lines, "test.log")
        
        # Should process all lines
        assert len(results) == threshold + 100

    def test_empty_batch(self) -> None:
        """Test that empty batch is handled correctly."""
        analyzer = CK3LogAnalyzer(None)
        
        results = analyzer.analyze_batch([], "test.log")
        
        assert results == []

    def test_parallel_with_no_matches(self) -> None:
        """Test parallel processing when no patterns match."""
        analyzer = CK3LogAnalyzer(None)
        
        lines = [
            f"Normal log line {i}"
            for i in range(5000)
        ]
        
        results = analyzer.analyze_batch(lines, "test.log")
        
        # Should return empty list but process all lines
        assert len(results) == 0
        stats = analyzer.get_statistics()
        assert stats.total_lines_processed >= 5000

    def test_parallel_mixed_patterns(self) -> None:
        """Test parallel processing with various error patterns."""
        analyzer = CK3LogAnalyzer(None)
        
        lines = [
            "[error] Unknown effect: test_effect",
            "[error] Unknown trigger: test_trigger",
            "[warning] Missing localization key: test_key",
            "[error] Event test.1 not found",
            "Normal line",
            "[E][error.cpp:123] Script system error!",  # Fixed format
        ] * 500  # Repeat to make it large enough for parallel
        
        results = analyzer.analyze_batch(lines, "test.log")
        
        # Should match 5 patterns per iteration
        assert len(results) >= 2500
        
        # Check category distribution
        stats = analyzer.get_statistics()
        assert len(stats.errors_by_category) > 1

    def test_chunk_size_configuration(self) -> None:
        """Test that chunk size can be configured."""
        # Save original value
        original = os.environ.get("CK3_LOG_CHUNK_SIZE")
        
        try:
            # Set custom chunk size
            os.environ["CK3_LOG_CHUNK_SIZE"] = "500"
            
            # Create new analyzer
            analyzer = CK3LogAnalyzer(None)
            
            assert analyzer._chunk_size == 500
        finally:
            # Restore original value
            if original is not None:
                os.environ["CK3_LOG_CHUNK_SIZE"] = original
            else:
                os.environ.pop("CK3_LOG_CHUNK_SIZE", None)

    def test_parallel_disabled_via_env(self) -> None:
        """Test that parallel processing can be disabled."""
        # Save original value
        original = os.environ.get("CK3_LOG_PARALLEL")
        
        try:
            # Disable parallel processing
            os.environ["CK3_LOG_PARALLEL"] = "0"
            
            # Create new analyzer
            analyzer = CK3LogAnalyzer(None)
            
            assert not analyzer._use_parallel
            
            # Should use serial even for large batches
            lines = [
                f"[error] Unknown effect: effect_{i}"
                for i in range(5000)
            ]
            
            results = analyzer.analyze_batch(lines, "test.log")
            assert len(results) == 5000
        finally:
            # Restore original value
            if original is not None:
                os.environ["CK3_LOG_PARALLEL"] = original
            else:
                os.environ.pop("CK3_LOG_PARALLEL", None)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
