"""
Tests for asset validation module (GFX001, SND001, SND002).

Tests cover:
- GFX001: Missing graphics file references
- SND001: Missing sound file references
- SND002: Invalid FMOD music event path format
"""

import os
import tempfile
import pytest
from lsprotocol import types

from pychivalry.core.parser import parse_document
from pychivalry.ck3.validation.asset_validation import (
    AssetConfig,
    validate_asset_references,
    check_graphics_references,
    check_sound_references,
    check_music_event_paths,
    _is_graphics_path,
    _is_sound_path,
    _is_fmod_event_path,
    _validate_fmod_event_path,
)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def get_diagnostic_codes(diagnostics):
    """Extract diagnostic codes from a list of diagnostics."""
    return [d.code for d in diagnostics]


# =============================================================================
# UTILITY FUNCTION TESTS
# =============================================================================


class TestUtilityFunctions:
    """Tests for utility functions."""

    def test_is_graphics_path_dds(self):
        """DDS files should be detected as graphics."""
        assert _is_graphics_path("gfx/interface/icons/icon.dds") is True

    def test_is_graphics_path_png(self):
        """PNG files should be detected as graphics."""
        assert _is_graphics_path("gfx/portraits/portrait.png") is True

    def test_is_graphics_path_tga(self):
        """TGA files should be detected as graphics."""
        assert _is_graphics_path("gfx/masks/mask.tga") is True

    def test_is_graphics_path_gfx_directory(self):
        """Paths in gfx/ directory should be detected as graphics."""
        assert _is_graphics_path("gfx/interface/icons/test") is True

    def test_is_graphics_path_non_graphics(self):
        """Non-graphics paths should return False."""
        assert _is_graphics_path("common/scripted_effects/test.txt") is False
        assert _is_graphics_path("sound/effects/click.ogg") is False

    def test_is_sound_path_ogg(self):
        """OGG files should be detected as sound."""
        assert _is_sound_path("sound/effects/click.ogg") is True

    def test_is_sound_path_wav(self):
        """WAV files should be detected as sound."""
        assert _is_sound_path("sound/ui/notification.wav") is True

    def test_is_sound_path_sound_directory(self):
        """Paths in sound/ directory should be detected as sound."""
        assert _is_sound_path("sound/effects/test") is True

    def test_is_sound_path_non_sound(self):
        """Non-sound paths should return False."""
        assert _is_sound_path("gfx/icons/test.dds") is False
        assert _is_sound_path("common/effects/test.txt") is False

    def test_is_fmod_event_path_valid(self):
        """FMOD event paths should be detected."""
        assert _is_fmod_event_path("event:/MUSIC/Moods/track_01") is True
        assert _is_fmod_event_path("event:/SFX/Events/click") is True

    def test_is_fmod_event_path_invalid(self):
        """Non-FMOD paths should return False."""
        assert _is_fmod_event_path("gfx/icons/test.dds") is False
        assert _is_fmod_event_path("sound/effects/click.ogg") is False


class TestFmodEventPathValidation:
    """Tests for FMOD event path validation."""

    def test_valid_music_path(self):
        """Valid music event path should not produce error."""
        result = _validate_fmod_event_path("event:/MUSIC/Moods/Calls/mx_mood_call_01")
        assert result is None

    def test_valid_sfx_path(self):
        """Valid SFX event path should not produce error."""
        result = _validate_fmod_event_path("event:/SFX/Events/Positive/generic_positive")
        assert result is None

    def test_valid_ui_path(self):
        """Valid UI event path should not produce error."""
        result = _validate_fmod_event_path("event:/UI/Click/button_click")
        assert result is None

    def test_invalid_prefix(self):
        """Invalid event path prefix should produce error."""
        result = _validate_fmod_event_path("event:/INVALID/something")
        assert result is not None
        assert "Unknown FMOD event category" in result

    def test_missing_event_prefix(self):
        """Path without event:/ prefix should produce error."""
        result = _validate_fmod_event_path("MUSIC/Moods/track_01")
        assert result is not None
        assert "must start with 'event:/'" in result

    def test_incomplete_path(self):
        """Incomplete event path should produce error."""
        result = _validate_fmod_event_path("event:/MUSIC/")
        assert result is not None
        assert "incomplete" in result.lower()


# =============================================================================
# GFX001: GRAPHICS FILE VALIDATION TESTS
# =============================================================================


class TestGraphicsValidation:
    """Tests for GFX001 - missing graphics file references."""

    def test_graphics_file_exists_no_diagnostic(self):
        """Valid graphics reference to existing file should not produce diagnostic."""
        # Create a temp directory with a graphics file
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create gfx/interface/icons directory
            gfx_dir = os.path.join(tmpdir, "gfx", "interface", "icons")
            os.makedirs(gfx_dir)
            
            # Create a dummy .dds file
            dds_file = os.path.join(gfx_dir, "test_icon.dds")
            with open(dds_file, "w") as f:
                f.write("dummy")
            
            # Parse script with reference to that file
            text = '''my_event.0001 = {
    icon = "gfx/interface/icons/test_icon.dds"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = check_graphics_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "GFX001" not in codes

    def test_graphics_file_missing_produces_diagnostic(self):
        """Reference to non-existent graphics file should produce GFX001."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''my_event.0001 = {
    icon = "gfx/interface/icons/missing_icon.dds"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = check_graphics_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "GFX001" in codes
            assert "missing_icon.dds" in diagnostics[0].message

    def test_texture_key_validation(self):
        """texture = should trigger graphics validation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''sprite = {
    texture = "gfx/portraits/missing.dds"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = check_graphics_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "GFX001" in codes

    def test_background_key_validation(self):
        """background = should trigger graphics validation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''window = {
    background = "gfx/interface/backgrounds/missing.dds"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = check_graphics_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "GFX001" in codes

    def test_graphics_validation_disabled(self):
        """Disabled graphics validation should not produce diagnostics."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''my_event.0001 = {
    icon = "gfx/interface/icons/missing.dds"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig(graphics_validation=False)
            
            diagnostics = check_graphics_references(ast, [tmpdir], config)
            
            assert len(diagnostics) == 0


# =============================================================================
# SND001: SOUND FILE VALIDATION TESTS
# =============================================================================


class TestSoundValidation:
    """Tests for SND001 - missing sound file references."""

    def test_sound_file_exists_no_diagnostic(self):
        """Valid sound reference to existing file should not produce diagnostic."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create sound directory
            sound_dir = os.path.join(tmpdir, "sound", "effects")
            os.makedirs(sound_dir)
            
            # Create a dummy .ogg file
            ogg_file = os.path.join(sound_dir, "click.ogg")
            with open(ogg_file, "w") as f:
                f.write("dummy")
            
            text = '''button = {
    sound = "sound/effects/click.ogg"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = check_sound_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "SND001" not in codes

    def test_sound_file_missing_produces_diagnostic(self):
        """Reference to non-existent sound file should produce SND001."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''button = {
    sound = "sound/effects/missing.ogg"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = check_sound_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "SND001" in codes
            assert "missing.ogg" in diagnostics[0].message

    def test_fmod_paths_not_validated_as_files(self):
        """FMOD event paths should not trigger SND001 (they're validated by SND002)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''button = {
    sound = "event:/SFX/UI/click"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = check_sound_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "SND001" not in codes

    def test_sound_validation_disabled(self):
        """Disabled sound validation should not produce diagnostics."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''button = {
    sound = "sound/effects/missing.ogg"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig(sound_validation=False)
            
            diagnostics = check_sound_references(ast, [tmpdir], config)
            
            assert len(diagnostics) == 0


# =============================================================================
# SND002: MUSIC EVENT PATH VALIDATION TESTS
# =============================================================================


class TestMusicEventValidation:
    """Tests for SND002 - invalid FMOD music event path format."""

    def test_valid_music_event_no_diagnostic(self):
        """Valid music event path should not produce diagnostic."""
        text = '''mx_mood_call_01 = {
    music = "event:/MUSIC/Moods/Calls/mx_mood_call_01/mx_mood_call_01"
}'''
        ast, _ = parse_document(text)
        config = AssetConfig()
        
        diagnostics = check_music_event_paths(ast, config)
        codes = get_diagnostic_codes(diagnostics)
        
        assert "SND002" not in codes

    def test_valid_sfx_event_no_diagnostic(self):
        """Valid SFX event path should not produce diagnostic."""
        text = '''immediate = {
    play_sound_effect = "event:/SFX/Events/Positive/generic_positive"
}'''
        ast, _ = parse_document(text)
        config = AssetConfig()
        
        diagnostics = check_music_event_paths(ast, config)
        codes = get_diagnostic_codes(diagnostics)
        
        assert "SND002" not in codes

    def test_invalid_event_category_produces_diagnostic(self):
        """Invalid FMOD event category should produce SND002."""
        text = '''mx_invalid = {
    music = "event:/INVALID/something/track_01"
}'''
        ast, _ = parse_document(text)
        config = AssetConfig()
        
        diagnostics = check_music_event_paths(ast, config)
        codes = get_diagnostic_codes(diagnostics)
        
        assert "SND002" in codes
        assert "Unknown FMOD event category" in diagnostics[0].message

    def test_incomplete_event_path_produces_diagnostic(self):
        """Incomplete FMOD event path should produce SND002."""
        text = '''mx_incomplete = {
    music = "event:/MUSIC/"
}'''
        ast, _ = parse_document(text)
        config = AssetConfig()
        
        diagnostics = check_music_event_paths(ast, config)
        codes = get_diagnostic_codes(diagnostics)
        
        assert "SND002" in codes
        assert "incomplete" in diagnostics[0].message.lower()

    def test_music_event_validation_disabled(self):
        """Disabled music event validation should not produce diagnostics."""
        text = '''mx_invalid = {
    music = "event:/INVALID/something"
}'''
        ast, _ = parse_document(text)
        config = AssetConfig(music_event_validation=False)
        
        diagnostics = check_music_event_paths(ast, config)
        
        assert len(diagnostics) == 0


# =============================================================================
# INTEGRATION TESTS
# =============================================================================


class TestAssetValidationIntegration:
    """Integration tests for the main validate_asset_references function."""

    def test_all_diagnostics_combined(self):
        """All asset diagnostics should be returned from main entry point."""
        with tempfile.TemporaryDirectory() as tmpdir:
            text = '''my_event.0001 = {
    icon = "gfx/interface/icons/missing.dds"
}
button = {
    sound = "sound/effects/missing.ogg"
}
mx_invalid = {
    music = "event:/INVALID/track"
}'''
            ast, _ = parse_document(text)
            config = AssetConfig()
            
            diagnostics = validate_asset_references(ast, [tmpdir], config)
            codes = get_diagnostic_codes(diagnostics)
            
            assert "GFX001" in codes
            assert "SND001" in codes
            assert "SND002" in codes

    def test_no_workspace_folders(self):
        """Validation should handle None workspace folders gracefully."""
        text = '''my_event.0001 = {
    icon = "gfx/interface/icons/test.dds"
}'''
        ast, _ = parse_document(text)
        config = AssetConfig()
        
        # Should not raise, but will produce GFX001 since no folders to search
        diagnostics = validate_asset_references(ast, None, config)
        codes = get_diagnostic_codes(diagnostics)
        
        # GFX001 expected since path can't be resolved
        assert "GFX001" in codes

    def test_empty_ast(self):
        """Validation should handle empty AST gracefully."""
        ast = []
        config = AssetConfig()
        
        diagnostics = validate_asset_references(ast, None, config)
        
        assert len(diagnostics) == 0

    def test_multiple_workspace_folders(self):
        """Validation should search multiple workspace folders."""
        with tempfile.TemporaryDirectory() as tmpdir1:
            with tempfile.TemporaryDirectory() as tmpdir2:
                # Create file in second workspace folder
                gfx_dir = os.path.join(tmpdir2, "gfx", "icons")
                os.makedirs(gfx_dir)
                with open(os.path.join(gfx_dir, "test.dds"), "w") as f:
                    f.write("dummy")
                
                text = '''my_event = {
    icon = "gfx/icons/test.dds"
}'''
                ast, _ = parse_document(text)
                config = AssetConfig()
                
                # File is in tmpdir2, not tmpdir1
                diagnostics = validate_asset_references(ast, [tmpdir1, tmpdir2], config)
                codes = get_diagnostic_codes(diagnostics)
                
                # Should NOT produce GFX001 since file exists in tmpdir2
                assert "GFX001" not in codes
