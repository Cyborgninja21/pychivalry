"""
Integration test for GFX001 validation with real mod files.

Tests the complete pipeline from parsing to diagnostic generation.
"""

import os
import pytest
from pathlib import Path
from pygls.workspace import TextDocument

from pychivalry.parser import parse_document
from pychivalry.diagnostics import collect_all_diagnostics


class TestGFXIntegration:
    """Integration tests with example mod."""

    def test_gfx_validation_with_example_mod(self):
        """Test GFX001 validation with example mod test file."""
        # Get the example mod path
        repo_root = Path(__file__).parent.parent
        test_file = repo_root / "example mod" / "events" / "test_gfx_validation.txt"
        
        # Skip if file doesn't exist
        if not test_file.exists():
            pytest.skip("Test file not found in example mod")
        
        # Read the test file
        with open(test_file, 'r') as f:
            text = f.read()
        
        # Create document
        doc = TextDocument(uri=f"file://{test_file}", source=text)
        
        # Parse
        ast = parse_document(text)
        
        # Get workspace folder (example mod root)
        workspace_folders = [str(test_file.parent.parent)]
        
        # Collect all diagnostics
        diagnostics = collect_all_diagnostics(
            doc, 
            ast, 
            index=None,
            workspace_folders=workspace_folders
        )
        
        # Filter for GFX001 diagnostics
        gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
        
        # Should find 2 missing files (background and icon)
        assert len(gfx_diagnostics) >= 2, f"Expected at least 2 GFX001 diagnostics, got {len(gfx_diagnostics)}"
        
        # Check that they reference the expected missing files
        messages = [d.message for d in gfx_diagnostics]
        assert any("missing_background.dds" in msg for msg in messages)
        assert any("missing_icon.dds" in msg for msg in messages)

    def test_no_false_positives_on_valid_files(self):
        """Test that valid files don't generate GFX001 warnings."""
        # Create a temporary structure with valid files
        import tempfile
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            
            # Create gfx structure
            gfx_dir = tmp_path / "gfx" / "interface" / "icons"
            gfx_dir.mkdir(parents=True)
            
            # Create a valid icon file
            icon_file = gfx_dir / "valid_icon.dds"
            icon_file.write_text("dummy content")
            
            # Create test content referencing the valid file
            text = """
            my_trait = {
                icon = "gfx/interface/icons/valid_icon.dds"
            }
            """
            
            # Parse and validate
            doc = TextDocument(uri="file:///test.txt", source=text)
            ast = parse_document(text)
            
            diagnostics = collect_all_diagnostics(
                doc,
                ast,
                index=None,
                workspace_folders=[str(tmp_path)]
            )
            
            # Should have no GFX001 diagnostics
            gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
            assert len(gfx_diagnostics) == 0

    def test_gfx_validation_disabled(self):
        """Test that GFX validation can be disabled via config."""
        from pychivalry.diagnostics import DiagnosticConfig
        
        text = """
        my_trait = {
            icon = "gfx/interface/icons/missing.dds"
        }
        """
        
        doc = TextDocument(uri="file:///test.txt", source=text)
        ast = parse_document(text)
        
        # Disable graphics validation
        config = DiagnosticConfig(graphics_enabled=False)
        
        diagnostics = collect_all_diagnostics(
            doc,
            ast,
            index=None,
            config=config,
            workspace_folders=[]
        )
        
        # Should have no GFX001 diagnostics when disabled
        gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
        assert len(gfx_diagnostics) == 0
