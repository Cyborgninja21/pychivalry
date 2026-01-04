"""
Tests for graphics file validation (GFX001).

Tests the gfx_validator module which checks for missing graphics file references.
"""

import os
import tempfile
import pytest
from pathlib import Path
from lsprotocol import types

from pychivalry.gfx_validator import (
    is_graphics_reference,
    extract_file_path,
    resolve_graphics_path,
    check_graphics_files,
    _find_mod_root,
)
from pychivalry.parser import parse_document


class TestGraphicsReferenceDetection:
    """Tests for detecting graphics reference keywords."""

    def test_icon_is_graphics_reference(self):
        """icon keyword should be recognized as graphics reference."""
        assert is_graphics_reference("icon") is True

    def test_texture_is_graphics_reference(self):
        """texture keyword should be recognized as graphics reference."""
        assert is_graphics_reference("texture") is True

    def test_sprite_is_graphics_reference(self):
        """sprite keyword should be recognized as graphics reference."""
        assert is_graphics_reference("sprite") is True

    def test_background_is_graphics_reference(self):
        """background keyword should be recognized as graphics reference."""
        assert is_graphics_reference("background") is True

    def test_portrait_texture_is_graphics_reference(self):
        """portrait_texture keyword should be recognized as graphics reference."""
        assert is_graphics_reference("portrait_texture") is True

    def test_reference_is_graphics_reference(self):
        """reference keyword should be recognized as graphics reference."""
        assert is_graphics_reference("reference") is True

    def test_activity_window_background_is_graphics_reference(self):
        """activity_window_background should be recognized as graphics reference."""
        assert is_graphics_reference("activity_window_background") is True

    def test_non_graphics_keyword(self):
        """Non-graphics keywords should not be recognized."""
        assert is_graphics_reference("type") is False
        assert is_graphics_reference("name") is False
        assert is_graphics_reference("trigger") is False


class TestFilePathExtraction:
    """Tests for extracting file paths from value strings."""

    def test_extract_quoted_path(self):
        """Should extract path from quoted string."""
        path = extract_file_path('"gfx/interface/icons/icon.dds"')
        assert path == "gfx/interface/icons/icon.dds"

    def test_extract_single_quoted_path(self):
        """Should extract path from single-quoted string."""
        path = extract_file_path("'gfx/interface/icons/icon.dds'")
        assert path == "gfx/interface/icons/icon.dds"

    def test_extract_unquoted_path(self):
        """Should extract path from unquoted string."""
        path = extract_file_path("gfx/interface/icons/icon.dds")
        assert path == "gfx/interface/icons/icon.dds"

    def test_normalize_backslashes(self):
        """Should normalize backslashes to forward slashes."""
        path = extract_file_path(r'"gfx\interface\icons\icon.dds"')
        assert path == "gfx/interface/icons/icon.dds"

    def test_reject_non_path_value(self):
        """Should return None for non-path values."""
        assert extract_file_path("my_icon_reference") is None
        assert extract_file_path("trait_icon") is None

    def test_reject_empty_value(self):
        """Should return None for empty values."""
        assert extract_file_path("") is None
        assert extract_file_path(None) is None

    def test_accept_relative_paths(self):
        """Should accept relative paths."""
        path = extract_file_path('"../icons/icon.dds"')
        assert path == "../icons/icon.dds"


class TestPathResolution:
    """Tests for resolving graphics paths to absolute paths."""

    def test_resolve_existing_file(self, tmp_path):
        """Should resolve path to existing file."""
        # Create test structure
        gfx_dir = tmp_path / "gfx" / "interface" / "icons"
        gfx_dir.mkdir(parents=True)
        test_file = gfx_dir / "test_icon.dds"
        test_file.write_text("dummy")

        # Resolve path
        resolved = resolve_graphics_path(
            "gfx/interface/icons/test_icon.dds",
            workspace_folders=[str(tmp_path)],
        )

        assert resolved is not None
        assert os.path.exists(resolved)
        assert "test_icon.dds" in resolved

    def test_resolve_missing_file(self, tmp_path):
        """Should return None for missing file."""
        resolved = resolve_graphics_path(
            "gfx/interface/icons/missing.dds",
            workspace_folders=[str(tmp_path)],
        )

        assert resolved is None

    def test_resolve_with_multiple_workspace_folders(self, tmp_path):
        """Should search multiple workspace folders."""
        # Create two workspace folders
        folder1 = tmp_path / "mod1"
        folder2 = tmp_path / "mod2"
        folder1.mkdir()
        folder2.mkdir()

        # File only exists in folder2
        gfx_dir = folder2 / "gfx" / "interface"
        gfx_dir.mkdir(parents=True)
        test_file = gfx_dir / "icon.dds"
        test_file.write_text("dummy")

        # Should find it in folder2
        resolved = resolve_graphics_path(
            "gfx/interface/icon.dds",
            workspace_folders=[str(folder1), str(folder2)],
        )

        assert resolved is not None
        assert "mod2" in resolved


class TestModRootFinding:
    """Tests for finding mod root directory."""

    def test_find_mod_root_with_descriptor(self, tmp_path):
        """Should find mod root by descriptor.mod."""
        descriptor = tmp_path / "descriptor.mod"
        descriptor.write_text("version = \"1.0\"")

        root = _find_mod_root(str(tmp_path))
        assert root == str(tmp_path)

    def test_find_mod_root_with_common_folder(self, tmp_path):
        """Should find mod root by common/ folder."""
        common_dir = tmp_path / "common"
        common_dir.mkdir()

        root = _find_mod_root(str(tmp_path))
        assert root == str(tmp_path)

    def test_find_mod_root_with_events_folder(self, tmp_path):
        """Should find mod root by events/ folder."""
        events_dir = tmp_path / "events"
        events_dir.mkdir()

        root = _find_mod_root(str(tmp_path))
        assert root == str(tmp_path)

    def test_find_mod_root_from_subdirectory(self, tmp_path):
        """Should traverse up to find mod root."""
        # Create structure: mod/common/scripted_effects/
        common_dir = tmp_path / "common"
        common_dir.mkdir()
        effects_dir = common_dir / "scripted_effects"
        effects_dir.mkdir()

        # Start search from subdirectory
        root = _find_mod_root(str(effects_dir))
        assert root == str(tmp_path)

    def test_find_mod_root_not_found(self, tmp_path):
        """Should return None if no mod root found."""
        # Empty directory with no mod markers
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()

        root = _find_mod_root(str(empty_dir))
        assert root is None


class TestGraphicsValidation:
    """Tests for full graphics validation pipeline."""

    def test_detect_missing_icon(self, tmp_path):
        """Should detect missing icon file."""
        text = """
        my_trait = {
            icon = "gfx/interface/icons/missing_icon.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        diag = diagnostics[0]
        assert diag.code == "GFX001"
        assert "missing_icon.dds" in diag.message
        assert diag.severity == types.DiagnosticSeverity.Warning

    def test_detect_missing_texture(self, tmp_path):
        """Should detect missing texture file."""
        text = """
        my_background = {
            texture = "gfx/interface/backgrounds/missing.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any(d.code == "GFX001" for d in diagnostics)

    def test_no_diagnostic_for_existing_file(self, tmp_path):
        """Should not generate diagnostic for existing file."""
        # Create the file
        gfx_dir = tmp_path / "gfx" / "interface" / "icons"
        gfx_dir.mkdir(parents=True)
        icon_file = gfx_dir / "existing_icon.dds"
        icon_file.write_text("dummy")

        text = """
        my_trait = {
            icon = "gfx/interface/icons/existing_icon.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        # Should have no GFX001 diagnostics
        gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
        assert len(gfx_diagnostics) == 0

    def test_detect_missing_background(self, tmp_path):
        """Should detect missing background file."""
        text = """
        my_event.0001 = {
            background = "gfx/interface/backgrounds/missing_bg.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any("missing_bg.dds" in d.message for d in diagnostics)

    def test_detect_missing_sprite(self, tmp_path):
        """Should detect missing sprite file."""
        text = """
        my_gui_element = {
            sprite = "gfx/interface/sprites/missing_sprite.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any(d.code == "GFX001" for d in diagnostics)

    def test_detect_missing_portrait_texture(self, tmp_path):
        """Should detect missing portrait texture."""
        text = """
        my_portrait = {
            portrait_texture = "gfx/portraits/missing_portrait.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any("missing_portrait.dds" in d.message for d in diagnostics)

    def test_detect_missing_activity_background(self, tmp_path):
        """Should detect missing activity window background."""
        text = """
        rq_grand_debauch = {
            activity_window_background = "gfx/interface/backgrounds/missing_activity.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any("missing_activity.dds" in d.message for d in diagnostics)

    def test_multiple_missing_files(self, tmp_path):
        """Should detect multiple missing files."""
        text = """
        my_content = {
            icon = "gfx/icons/missing1.dds"
            texture = "gfx/textures/missing2.dds"
            background = "gfx/backgrounds/missing3.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
        assert len(gfx_diagnostics) >= 3

    def test_nested_structures(self, tmp_path):
        """Should detect missing files in nested structures."""
        text = """
        my_event.0001 = {
            type = character_event
            option = {
                name = my_event.0001.a
                trigger = {
                    custom_tooltip = {
                        icon = "gfx/icons/nested_missing.dds"
                    }
                }
            }
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any("nested_missing.dds" in d.message for d in diagnostics)

    def test_ignore_non_path_icon_values(self, tmp_path):
        """Should ignore icon values that are not file paths."""
        text = """
        my_trait = {
            icon = my_icon_reference
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        # Should not generate diagnostic for non-path icon value
        assert len(diagnostics) == 0

    def test_no_duplicate_diagnostics(self, tmp_path):
        """Should not generate duplicate diagnostics for same file."""
        text = """
        item1 = {
            icon = "gfx/icons/missing.dds"
        }
        item2 = {
            icon = "gfx/icons/missing.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        # Should only report the missing file once
        gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
        assert len(gfx_diagnostics) == 1


class TestRealWorldScenarios:
    """Tests based on real-world CK3 modding scenarios."""

    def test_activity_with_phases(self, tmp_path):
        """Test activity definition with phase backgrounds."""
        text = """
        rq_grand_debauch = {
            activity_window_background = "gfx/interface/activities/missing_activity.dds"
            
            phase_1 = {
                icon = "gfx/interface/icons/phase1_missing.dds"
            }
            
            phase_2 = {
                icon = "gfx/interface/icons/phase2_missing.dds"
            }
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        # Should detect all 3 missing files
        gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
        assert len(gfx_diagnostics) >= 3

    def test_event_with_scene_background(self, tmp_path):
        """Test event with scene background."""
        text = """
        namespace = test_events

        test_events.0001 = {
            type = character_event
            background = "gfx/interface/illustrations/event_scenes/missing_scene.dds"
            
            option = {
                name = test_events.0001.a
            }
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any("missing_scene.dds" in d.message for d in diagnostics)

    def test_decision_with_icon(self, tmp_path):
        """Test decision definition with icon."""
        text = """
        my_decision = {
            icon = "gfx/interface/icons/decisions/missing_decision.dds"
            
            is_shown = {
                always = yes
            }
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        assert len(diagnostics) >= 1
        assert any("missing_decision.dds" in d.message for d in diagnostics)

    def test_mixed_existing_and_missing(self, tmp_path):
        """Test with both existing and missing files."""
        # Create one existing file
        gfx_dir = tmp_path / "gfx" / "interface" / "icons"
        gfx_dir.mkdir(parents=True)
        existing_file = gfx_dir / "existing.dds"
        existing_file.write_text("dummy")

        text = """
        trait1 = {
            icon = "gfx/interface/icons/existing.dds"
        }
        trait2 = {
            icon = "gfx/interface/icons/missing.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        # Should only report the missing file
        gfx_diagnostics = [d for d in diagnostics if d.code == "GFX001"]
        assert len(gfx_diagnostics) == 1
        assert "missing.dds" in gfx_diagnostics[0].message
        assert "existing.dds" not in gfx_diagnostics[0].message


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_empty_ast(self, tmp_path):
        """Should handle empty AST."""
        ast = []
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])
        assert len(diagnostics) == 0

    def test_no_graphics_references(self, tmp_path):
        """Should handle document with no graphics references."""
        text = """
        my_effect = {
            add_gold = 100
            add_prestige = 50
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])
        assert len(diagnostics) == 0

    def test_empty_workspace_folders(self):
        """Should handle empty workspace folders list."""
        text = """
        my_trait = {
            icon = "gfx/icons/missing.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[])

        # Should still generate diagnostic (just can't resolve the path)
        assert len(diagnostics) >= 1

    def test_none_workspace_folders(self):
        """Should handle None workspace folders."""
        text = """
        my_trait = {
            icon = "gfx/icons/missing.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=None)

        # Should still generate diagnostic
        assert len(diagnostics) >= 1

    def test_malformed_path(self, tmp_path):
        """Should handle malformed paths gracefully."""
        text = """
        my_trait = {
            icon = "gfx//double//slash//path.dds"
        }
        """
        ast = parse_document(text)
        diagnostics = check_graphics_files(ast, workspace_folders=[str(tmp_path)])

        # Should attempt to validate (will likely fail to find file)
        assert isinstance(diagnostics, list)
