"""
Integration tests for the log watcher system.

Tests the complete workflow: file monitoring → analysis → diagnostics
"""

import tempfile
import time
from pathlib import Path

import pytest

from pychivalry.log_analyzer import CK3LogAnalyzer


class TestLogWatcherIntegration:
    """Integration tests for complete log watching workflow."""

    def test_path_detection_returns_path_or_none(self) -> None:
        """Test path detection returns valid result."""
        from pychivalry.log_watcher import detect_ck3_log_path

        # Should return Path or None, shouldn't crash
        result = detect_ck3_log_path()
        assert result is None or isinstance(result, Path)

    def test_analyzer_processes_error_line(self) -> None:
        """Test analyzer can process an error log line."""
        analyzer = CK3LogAnalyzer(None)

        result = analyzer.analyze_line(
            "[error] Unknown effect 'test_effect' in file.txt:10",
            "game.log"
        )

        assert result is not None
        assert "unknown" in result.category or "error" in result.category

    def test_analyzer_processes_batch(self) -> None:
        """Test analyzer can process multiple log lines."""
        analyzer = CK3LogAnalyzer(None)

        lines = [
            "[error] Error 1",
            "[warning] Warning 1",
            "[info] Info 1",
        ]

        results = analyzer.analyze_batch(lines, "game.log")

        # Should process all lines
        assert len(results) >= 1  # At least some should match patterns

    def test_file_handler_reads_incremental(self) -> None:
        """Test file handler reads only new content."""
        from pychivalry.log_watcher import CK3LogFileHandler

        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.log') as f:
            f.write("Line 1\n")
            f.write("Line 2\n")
            temp_path = f.name

        try:
            handler = CK3LogFileHandler(temp_path)

            # First read
            lines1 = handler.read_new_lines()
            assert len(lines1) == 2

            # Append more
            with open(temp_path, 'a') as f:
                f.write("Line 3\n")

            # Second read should only get new line
            lines2 = handler.read_new_lines()
            assert len(lines2) == 1
            assert "Line 3" in lines2[0]

        finally:
            Path(temp_path).unlink()

    def test_watcher_lifecycle(self) -> None:
        """Test watcher start/stop lifecycle."""
        from pychivalry.log_watcher import CK3LogWatcher

        analyzer = CK3LogAnalyzer(None)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create log file
            log_file = Path(tmpdir) / "game.log"
            log_file.touch()

            watcher = CK3LogWatcher(tmpdir, analyzer)

            # Should start cleanly
            watcher.start()
            time.sleep(0.5)
            assert watcher.is_running()

            # Should pause cleanly
            watcher.pause()
            assert watcher.is_paused()

            # Should resume cleanly
            watcher.resume()
            assert not watcher.is_paused()

            # Should stop cleanly
            watcher.stop()
            time.sleep(0.5)
            assert not watcher.is_running()

    def test_diagnostic_converter_basic(self) -> None:
        """Test diagnostic converter creates valid diagnostics."""
        from pychivalry.log_diagnostics import LogDiagnosticConverter
        from lsprotocol.types import DiagnosticSeverity

        converter = LogDiagnosticConverter()
        analyzer = CK3LogAnalyzer(None)

        # Analyze a line
        result = analyzer.analyze_line(
            "[error] Unknown effect 'test' in file.txt:10",
            "game.log"
        )

        if result:
            # Convert to diagnostic
            diagnostic = converter.convert_to_diagnostic(result)

            assert diagnostic is not None
            assert diagnostic.message is not None
            assert diagnostic.source == "ck3-game-log"
            assert diagnostic.severity in [
                DiagnosticSeverity.Error,
                DiagnosticSeverity.Warning,
                DiagnosticSeverity.Information,
                DiagnosticSeverity.Hint
            ]

    def test_statistics_tracking(self) -> None:
        """Test that statistics are tracked correctly."""
        analyzer = CK3LogAnalyzer(None)

        # Process some lines
        analyzer.analyze_batch([
            "[error] Error 1",
            "[error] Error 2",
            "[warning] Warning 1",
        ], "game.log")

        stats = analyzer.get_statistics()

        # Should have processed lines
        assert stats.total_lines_processed > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
