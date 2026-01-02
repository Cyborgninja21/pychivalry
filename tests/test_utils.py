"""
Tests for shared utility functions.

These tests verify the URI/path conversion and position utilities
that are shared across multiple LSP feature implementations.
"""

import pytest
from lsprotocol import types

from pychivalry.utils import path_to_uri, uri_to_path, position_in_range


class TestPathToUri:
    """Tests for path_to_uri function."""

    def test_unix_path(self):
        """Should convert Unix path to URI."""
        path = "/home/user/mod/events/file.txt"
        uri = path_to_uri(path)
        
        assert uri == "file:///home/user/mod/events/file.txt"

    def test_windows_path(self):
        """Should convert Windows path to URI."""
        path = "C:\\Users\\test\\mod\\events\\file.txt"
        uri = path_to_uri(path)
        
        assert uri.startswith("file:///")
        assert "Users" in uri
        assert "test" in uri

    def test_path_with_spaces(self):
        """Should encode spaces in path."""
        path = "/home/user/my mod/events.txt"
        uri = path_to_uri(path)
        
        assert "my%20mod" in uri or "my mod" in uri  # Depending on quote behavior

    def test_relative_path(self):
        """Should handle relative paths."""
        path = "./events/file.txt"
        uri = path_to_uri(path)
        
        assert uri.startswith("file://")
        assert "events" in uri


class TestUriToPath:
    """Tests for uri_to_path function."""

    def test_unix_uri(self):
        """Should convert Unix URI to path."""
        uri = "file:///home/user/mod/events/file.txt"
        path = uri_to_path(uri)
        
        assert path == "/home/user/mod/events/file.txt"

    def test_windows_uri(self):
        """Should convert Windows URI to path."""
        uri = "file:///C:/Users/test/file.txt"
        path = uri_to_path(uri)
        
        assert path is not None
        assert "Users" in path or "test" in path
        # Windows path should not have leading /
        assert not path.startswith("/C:")

    def test_non_file_uri(self):
        """Should return None for non-file URIs."""
        uri = "https://example.com/file.txt"
        path = uri_to_path(uri)
        
        assert path is None

    def test_empty_file_uri(self):
        """Should return empty path for empty file URI."""
        uri = "file://"
        path = uri_to_path(uri)
        
        # Should return empty string, not None
        assert path == ""


class TestPositionInRange:
    """Tests for position_in_range function."""

    def test_position_inside_single_line_range(self):
        """Should return True when position is inside range on same line."""
        position = types.Position(line=5, character=10)
        range_ = types.Range(
            start=types.Position(line=5, character=5),
            end=types.Position(line=5, character=15)
        )
        
        assert position_in_range(position, range_) is True

    def test_position_at_range_start(self):
        """Should return True when position is at range start."""
        position = types.Position(line=5, character=5)
        range_ = types.Range(
            start=types.Position(line=5, character=5),
            end=types.Position(line=5, character=15)
        )
        
        assert position_in_range(position, range_) is True

    def test_position_at_range_end(self):
        """Should return True when position is at range end."""
        position = types.Position(line=5, character=15)
        range_ = types.Range(
            start=types.Position(line=5, character=5),
            end=types.Position(line=5, character=15)
        )
        
        assert position_in_range(position, range_) is True

    def test_position_before_range(self):
        """Should return False when position is before range."""
        position = types.Position(line=5, character=3)
        range_ = types.Range(
            start=types.Position(line=5, character=5),
            end=types.Position(line=5, character=15)
        )
        
        assert position_in_range(position, range_) is False

    def test_position_after_range(self):
        """Should return False when position is after range."""
        position = types.Position(line=5, character=20)
        range_ = types.Range(
            start=types.Position(line=5, character=5),
            end=types.Position(line=5, character=15)
        )
        
        assert position_in_range(position, range_) is False

    def test_position_on_different_line_before(self):
        """Should return False when position is on earlier line."""
        position = types.Position(line=3, character=10)
        range_ = types.Range(
            start=types.Position(line=5, character=0),
            end=types.Position(line=7, character=20)
        )
        
        assert position_in_range(position, range_) is False

    def test_position_on_different_line_after(self):
        """Should return False when position is on later line."""
        position = types.Position(line=10, character=10)
        range_ = types.Range(
            start=types.Position(line=5, character=0),
            end=types.Position(line=7, character=20)
        )
        
        assert position_in_range(position, range_) is False

    def test_position_inside_multiline_range(self):
        """Should return True when position is inside multi-line range."""
        position = types.Position(line=6, character=10)
        range_ = types.Range(
            start=types.Position(line=5, character=0),
            end=types.Position(line=7, character=20)
        )
        
        assert position_in_range(position, range_) is True


class TestRoundTrip:
    """Test round-trip conversion between paths and URIs."""

    def test_unix_roundtrip(self):
        """Should preserve Unix path through roundtrip."""
        original = "/home/user/mod/events/file.txt"
        uri = path_to_uri(original)
        result = uri_to_path(uri)
        
        assert result == original

    def test_windows_roundtrip(self):
        """Should preserve Windows path through roundtrip (normalized)."""
        original = "C:/Users/test/file.txt"
        uri = path_to_uri(original)
        result = uri_to_path(uri)
        
        # Normalization may change the path
        assert result is not None
        assert "Users" in result
        assert "test" in result
