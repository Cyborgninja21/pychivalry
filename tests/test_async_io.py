"""
Tests for async file I/O and workspace scanning functionality.

These tests validate the async/await migration, including:
- Async file reading utilities
- Async workspace scanning
- Error handling and cancellation
- Performance characteristics
"""

import asyncio
import pytest
import tempfile
from pathlib import Path
from pychivalry.core.utils import read_file_async, read_file_async_single
from pychivalry.core.indexer import DocumentIndex


class TestAsyncFileReading:
    """Tests for async file reading utilities."""

    @pytest.mark.asyncio
    async def test_read_file_async_utf8(self):
        """Test reading a UTF-8 file."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8') as f:
            f.write("test content\n")
            temp_path = Path(f.name)
        
        try:
            content = await read_file_async(temp_path)
            assert content == "test content\n"
        finally:
            temp_path.unlink()

    @pytest.mark.asyncio
    async def test_read_file_async_utf8_bom(self):
        """Test reading a UTF-8 file with BOM."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8-sig') as f:
            f.write("test content with BOM\n")
            temp_path = Path(f.name)
        
        try:
            content = await read_file_async(temp_path)
            assert content == "test content with BOM\n"
        finally:
            temp_path.unlink()

    @pytest.mark.asyncio
    async def test_read_file_async_nonexistent(self):
        """Test reading a non-existent file."""
        content = await read_file_async(Path('/nonexistent/file.txt'))
        assert content is None

    @pytest.mark.asyncio
    async def test_read_file_async_single(self):
        """Test reading a file with single encoding."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8') as f:
            f.write("single encoding test\n")
            temp_path = Path(f.name)
        
        try:
            content = await read_file_async_single(temp_path)
            assert content == "single encoding test\n"
        finally:
            temp_path.unlink()

    @pytest.mark.asyncio
    async def test_read_file_async_single_error(self):
        """Test that read_file_async_single raises on error."""
        with pytest.raises(FileNotFoundError):
            await read_file_async_single(Path('/nonexistent/file.txt'))


class TestAsyncWorkspaceScanning:
    """Tests for async workspace scanning."""

    @pytest.mark.asyncio
    async def test_scan_empty_workspace(self):
        """Test scanning an empty workspace."""
        with tempfile.TemporaryDirectory() as tmpdir:
            index = DocumentIndex()
            await index.scan_workspace_async([tmpdir])
            
            # Should complete without errors
            assert len(index.events) == 0
            assert len(index.scripted_effects) == 0

    @pytest.mark.asyncio
    async def test_scan_workspace_with_events(self):
        """Test scanning a workspace with event files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create events folder and file
            events_dir = Path(tmpdir) / 'events'
            events_dir.mkdir()
            
            event_file = events_dir / 'test_events.txt'
            event_file.write_text(
                'namespace = test\n'
                'test.0001 = {\n'
                '    type = character_event\n'
                '}\n',
                encoding='utf-8'
            )
            
            # Scan workspace
            index = DocumentIndex()
            await index.scan_workspace_async([tmpdir])
            
            # Verify results
            assert 'test' in index.namespaces
            assert 'test.0001' in index.events

    @pytest.mark.asyncio
    async def test_scan_workspace_with_effects(self):
        """Test scanning a workspace with scripted effects."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create scripted_effects folder and file
            effects_dir = Path(tmpdir) / 'common' / 'scripted_effects'
            effects_dir.mkdir(parents=True)
            
            effects_file = effects_dir / 'test_effects.txt'
            effects_file.write_text(
                'my_custom_effect = {\n'
                '    add_gold = 100\n'
                '}\n',
                encoding='utf-8'
            )
            
            # Scan workspace
            index = DocumentIndex()
            await index.scan_workspace_async([tmpdir])
            
            # Verify results
            assert 'my_custom_effect' in index.scripted_effects

    @pytest.mark.asyncio
    async def test_scan_workspace_with_localization(self):
        """Test scanning a workspace with localization files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create localization folder and file
            loc_dir = Path(tmpdir) / 'localization' / 'english'
            loc_dir.mkdir(parents=True)
            
            loc_file = loc_dir / 'test_l_english.yml'
            loc_file.write_text(
                'l_english:\n'
                ' test_key:0 "Test Value"\n'
                ' another_key:0 "Another Value"\n',
                encoding='utf-8-sig'
            )
            
            # Scan workspace
            index = DocumentIndex()
            await index.scan_workspace_async([tmpdir])
            
            # Verify results
            assert 'test_key' in index.localization
            assert 'another_key' in index.localization


class TestAsyncCancellation:
    """Tests for async cancellation handling."""

    @pytest.mark.asyncio
    async def test_file_read_cancellation(self):
        """Test that file reading can be cancelled."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write("x" * 10000)  # Large file
            temp_path = Path(f.name)
        
        try:
            # Create a task and cancel it immediately
            task = asyncio.create_task(read_file_async(temp_path))
            task.cancel()
            
            with pytest.raises(asyncio.CancelledError):
                await task
        finally:
            temp_path.unlink()

    @pytest.mark.asyncio
    async def test_workspace_scan_cancellation(self):
        """Test that workspace scanning can be cancelled."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create many files to scan
            events_dir = Path(tmpdir) / 'events'
            events_dir.mkdir()
            
            for i in range(50):
                event_file = events_dir / f'test_{i}.txt'
                event_file.write_text(f'test.{i:04d} = {{ }}\n', encoding='utf-8')
            
            # Start scan and cancel it
            index = DocumentIndex()
            task = asyncio.create_task(index.scan_workspace_async([tmpdir]))
            
            # Give it a moment to start
            await asyncio.sleep(0.01)
            task.cancel()
            
            with pytest.raises(asyncio.CancelledError):
                await task


class TestAsyncErrorHandling:
    """Tests for async error handling."""

    @pytest.mark.asyncio
    async def test_invalid_file_handling(self):
        """Test that invalid files are handled gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a directory that looks like a file (permission issue)
            events_dir = Path(tmpdir) / 'events'
            events_dir.mkdir()
            
            # Create an unreadable file
            bad_file = events_dir / 'bad.txt'
            bad_file.write_text('test', encoding='utf-8')
            bad_file.chmod(0o000)
            
            # Scan should complete without raising
            index = DocumentIndex()
            try:
                await index.scan_workspace_async([tmpdir])
                # Should not raise, but bad file should be skipped
            finally:
                # Cleanup: restore permissions
                bad_file.chmod(0o644)

    @pytest.mark.asyncio
    async def test_mixed_encoding_files(self):
        """Test handling files with different encodings."""
        with tempfile.TemporaryDirectory() as tmpdir:
            events_dir = Path(tmpdir) / 'events'
            events_dir.mkdir()
            
            # UTF-8 file
            utf8_file = events_dir / 'utf8.txt'
            utf8_file.write_text('test.0001 = { }\n', encoding='utf-8')
            
            # UTF-8-BOM file
            utf8bom_file = events_dir / 'utf8bom.txt'
            utf8bom_file.write_text('test.0002 = { }\n', encoding='utf-8-sig')
            
            # Latin-1 file
            latin1_file = events_dir / 'latin1.txt'
            with open(latin1_file, 'w', encoding='latin-1') as f:
                f.write('test.0003 = { }\n')
            
            # Scan should handle all encodings
            index = DocumentIndex()
            await index.scan_workspace_async([tmpdir])
            
            # All events should be found
            assert 'test.0001' in index.events
            assert 'test.0002' in index.events
            assert 'test.0003' in index.events


class TestAsyncConcurrency:
    """Tests for async concurrency behavior."""

    @pytest.mark.asyncio
    async def test_concurrent_file_reads(self):
        """Test that multiple files can be read concurrently."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create multiple files
            files = []
            for i in range(10):
                file_path = Path(tmpdir) / f'file_{i}.txt'
                file_path.write_text(f'content {i}\n', encoding='utf-8')
                files.append(file_path)
            
            # Read all files concurrently
            tasks = [read_file_async(f) for f in files]
            results = await asyncio.gather(*tasks)
            
            # Verify all were read
            assert len(results) == 10
            for i, content in enumerate(results):
                assert content == f'content {i}\n'

    @pytest.mark.asyncio
    async def test_concurrent_workspace_scans(self):
        """Test that multiple workspace scans can run concurrently."""
        with tempfile.TemporaryDirectory() as tmpdir1, \
             tempfile.TemporaryDirectory() as tmpdir2:
            
            # Create events in both workspaces
            for tmpdir in [tmpdir1, tmpdir2]:
                events_dir = Path(tmpdir) / 'events'
                events_dir.mkdir()
                
                event_file = events_dir / 'test.txt'
                event_file.write_text('test.0001 = { }\n', encoding='utf-8')
            
            # Scan both concurrently
            index1 = DocumentIndex()
            index2 = DocumentIndex()
            
            await asyncio.gather(
                index1.scan_workspace_async([tmpdir1]),
                index2.scan_workspace_async([tmpdir2])
            )
            
            # Both should have results
            assert 'test.0001' in index1.events
            assert 'test.0001' in index2.events
