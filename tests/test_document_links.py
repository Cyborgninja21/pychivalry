"""
Tests for document links functionality.

Document links make file paths, URLs, and references clickable in the editor.
"""

import os
import pytest
from lsprotocol import types

from pychivalry.document_links import (
    get_document_links,
    resolve_document_link,
    get_link_at_position,
    find_localization_references,
    LinkInfo,
    _path_to_uri,
    _uri_to_path,
    _find_mod_root,
)


# =============================================================================
# Test: File Path Detection
# =============================================================================


class TestFilePathDetection:
    """Tests for detecting file paths in documents."""
    
    def test_common_folder_path(self):
        """Should detect paths starting with common/."""
        text = "# See common/scripted_effects/my_effects.txt"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        assert any("common/scripted_effects/my_effects.txt" in (link.tooltip or "") for link in links)
    
    def test_events_folder_path(self):
        """Should detect paths starting with events/."""
        text = "# Related: events/my_mod/chapter_one.txt"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        path_found = any("events/my_mod/chapter_one.txt" in str(link.range) or 
                        "events/my_mod/chapter_one.txt" in (link.tooltip or "")
                        for link in links)
        assert path_found or len(links) > 0
    
    def test_gfx_folder_path(self):
        """Should detect paths starting with gfx/."""
        text = "# Icon at gfx/interface/icons/my_icon.dds"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_gui_folder_path(self):
        """Should detect paths starting with gui/."""
        text = "# GUI definition: gui/my_window.gui"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_localization_folder_path(self):
        """Should detect paths starting with localization/."""
        text = "# Translations: localization/english/my_mod_l_english.yml"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_multiple_paths_same_line(self):
        """Should detect multiple paths on same line."""
        text = "# See common/effects.txt and events/main.txt"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 2
    
    def test_path_with_subdirectories(self):
        """Should detect paths with multiple subdirectories."""
        text = "# File: common/scripted_effects/chapter_one/rewards/gold_rewards.txt"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_path_without_extension(self):
        """Should detect paths without file extensions."""
        text = "# Folder: common/scripted_effects"
        
        links = get_document_links(text, "file:///test.txt")
        
        # May or may not detect depending on implementation
        # The important thing is it doesn't crash
        assert isinstance(links, list)
    
    def test_dds_file_path(self):
        """Should detect .dds texture paths."""
        text = "gfx/interface/icons/traits/brave.dds"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_yml_file_path(self):
        """Should detect .yml localization paths."""
        text = "localization/english/events_l_english.yml"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1


# =============================================================================
# Test: URL Detection
# =============================================================================


class TestURLDetection:
    """Tests for detecting URLs in documents."""
    
    def test_https_url(self):
        """Should detect https:// URLs."""
        text = "# Wiki: https://ck3.paradoxwikis.com/Modding"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        url_link = next((l for l in links if l.target and 'paradoxwikis.com' in l.target), None)
        assert url_link is not None
    
    def test_http_url(self):
        """Should detect http:// URLs."""
        text = "# See: http://example.com/page"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        url_link = next((l for l in links if l.target and 'example.com' in l.target), None)
        assert url_link is not None
    
    def test_github_url(self):
        """Should detect GitHub URLs."""
        text = "# Source: https://github.com/user/repo"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        github_link = next((l for l in links if l.target and 'github.com' in l.target), None)
        assert github_link is not None
        assert "GitHub" in (github_link.tooltip or "")
    
    def test_url_with_query_params(self):
        """Should detect URLs with query parameters."""
        text = "# https://example.com/search?q=test&page=1"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_url_with_fragment(self):
        """Should detect URLs with fragments."""
        text = "# https://ck3.paradoxwikis.com/Effects#Character_effects"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_url_strips_trailing_punctuation(self):
        """Should not include trailing punctuation in URL."""
        text = "# See https://example.com/page."
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        url_link = next((l for l in links if l.target and 'example.com' in l.target), None)
        assert url_link is not None
        assert not url_link.target.endswith('.')
    
    def test_paradox_wiki_tooltip(self):
        """Should show special tooltip for Paradox Wiki URLs."""
        text = "# https://ck3.paradoxwikis.com/Triggers"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        wiki_link = next((l for l in links if 'paradoxwikis' in (l.target or '')), None)
        assert wiki_link is not None
        assert "Wiki" in (wiki_link.tooltip or "")


# =============================================================================
# Test: Event ID Detection in Comments
# =============================================================================


class TestEventIDDetection:
    """Tests for detecting event IDs in comments."""
    
    def test_event_id_in_comment(self):
        """Should detect event ID in comment."""
        text = "# See rq.0001 for the starting event"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        event_link = next((l for l in links if 'rq.0001' in (l.tooltip or '')), None)
        assert event_link is not None
    
    def test_event_id_fires(self):
        """Should detect 'fires' event references."""
        text = "# This fires my_mod.0050"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_event_id_triggered_by(self):
        """Should detect 'triggered by' event references."""
        text = "# Triggered by chapter_one.0100"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_event_id_multiple_digits(self):
        """Should detect event IDs with multiple digits."""
        text = "# Event chain: rq.1234"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_event_id_not_in_code(self):
        """Should not detect event IDs outside comments."""
        text = "trigger_event = { id = rq.0001 }"
        
        links = get_document_links(text, "file:///test.txt")
        
        # Event IDs in actual code are handled by go-to-definition, not links
        # So this should NOT create a link (or create a different type)
        event_links = [l for l in links if l.data and l.data.get('type') == 'event']
        # The line has no # so it's not a comment - no event links expected
        assert len(event_links) == 0
    
    def test_event_id_tooltip(self):
        """Should show helpful tooltip for event links."""
        text = "# See my_mod.0001"
        
        links = get_document_links(text, "file:///test.txt")
        
        event_link = next((l for l in links if l.data and l.data.get('type') == 'event'), None)
        if event_link:
            assert "Go to event" in (event_link.tooltip or "")
    
    def test_multiple_event_ids_same_comment(self):
        """Should detect multiple event IDs in same comment."""
        text = "# Chain: rq.0001 -> rq.0002 -> rq.0003"
        
        links = get_document_links(text, "file:///test.txt")
        
        event_links = [l for l in links if l.data and l.data.get('type') == 'event']
        assert len(event_links) >= 3


# =============================================================================
# Test: GFX Paths in Script
# =============================================================================


class TestGFXPathsInScript:
    """Tests for detecting GFX paths in script code."""
    
    def test_icon_path(self):
        """Should detect icon = \"gfx/...\" paths."""
        text = 'icon = "gfx/interface/icons/traits/brave.dds"'
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_texture_path(self):
        """Should detect texture = \"...\" paths."""
        text = 'texture = "gfx/map/terrain/plains.dds"'
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_sprite_path(self):
        """Should detect sprite = \"...\" paths."""
        text = 'sprite = "gfx/interface/sprites/button.dds"'
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_background_path(self):
        """Should detect background = \"...\" paths."""
        text = 'background = "gfx/interface/backgrounds/paper.dds"'
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
    
    def test_non_path_icon_value(self):
        """Should not link non-path icon values."""
        text = 'icon = my_trait_icon'
        
        links = get_document_links(text, "file:///test.txt")
        
        # No path-like string, should not create link
        # May or may not be empty depending on other patterns
        gfx_links = [l for l in links if l.tooltip and 'gfx' in l.tooltip.lower()]
        assert len(gfx_links) == 0


# =============================================================================
# Test: Link Ranges
# =============================================================================


class TestLinkRanges:
    """Tests for accurate link range positions."""
    
    def test_link_range_single_line(self):
        """Link range should be on correct line."""
        text = "line one\n# See common/effects.txt\nline three"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        # The link should be on line 1 (0-indexed)
        path_link = next((l for l in links if "common" in (l.tooltip or "")), None)
        if path_link:
            assert path_link.range.start.line == 1
    
    def test_link_range_character_positions(self):
        """Link range should have correct character positions."""
        text = "prefix common/effects.txt suffix"
        
        links = get_document_links(text, "file:///test.txt")
        
        assert len(links) >= 1
        link = links[0]
        
        # Extract the text in the range
        start_char = link.range.start.character
        end_char = link.range.end.character
        linked_text = text[start_char:end_char]
        
        assert "common" in linked_text or "effects" in linked_text
    
    def test_url_range_accuracy(self):
        """URL link range should match the URL exactly."""
        text = "Check https://example.com/page for info."
        
        links = get_document_links(text, "file:///test.txt")
        
        url_link = next((l for l in links if 'example.com' in (l.target or '')), None)
        assert url_link is not None
        
        start = url_link.range.start.character
        end = url_link.range.end.character
        linked_text = text[start:end]
        
        assert linked_text == "https://example.com/page"


# =============================================================================
# Test: Path Resolution
# =============================================================================


class TestPathResolution:
    """Tests for path resolution utilities."""
    
    def test_path_to_uri_windows(self):
        """Should convert Windows path to URI."""
        path = "C:\\Users\\test\\mod\\events\\file.txt"
        
        uri = _path_to_uri(path)
        
        assert uri.startswith("file://")
        assert "Users" in uri
        assert "events" in uri
    
    def test_path_to_uri_unix(self):
        """Should convert Unix path to URI."""
        path = "/home/user/mod/events/file.txt"
        
        uri = _path_to_uri(path)
        
        assert uri.startswith("file://")
        assert "home" in uri
    
    def test_uri_to_path_windows(self):
        """Should convert URI to Windows path."""
        uri = "file:///C:/Users/test/file.txt"
        
        path = _uri_to_path(uri)
        
        assert path is not None
        assert "Users" in path or "test" in path
    
    def test_uri_to_path_unix(self):
        """Should convert URI to Unix path."""
        uri = "file:///home/user/file.txt"
        
        path = _uri_to_path(uri)
        
        assert path is not None
        assert "home" in path
    
    def test_uri_to_path_non_file_uri(self):
        """Should return None for non-file URIs."""
        uri = "https://example.com/file.txt"
        
        path = _uri_to_path(uri)
        
        assert path is None


# =============================================================================
# Test: Link Resolution
# =============================================================================


class TestLinkResolution:
    """Tests for document link resolution."""
    
    def test_resolve_link_with_target(self):
        """Should return link unchanged if target already set."""
        link = types.DocumentLink(
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            target="file:///existing.txt",
        )
        
        resolved = resolve_document_link(link)
        
        assert resolved.target == "file:///existing.txt"
    
    def test_resolve_event_link(self):
        """Should resolve event link to command URI."""
        link = types.DocumentLink(
            range=types.Range(
                start=types.Position(line=0, character=0),
                end=types.Position(line=0, character=10),
            ),
            target=None,
            data={"type": "event", "id": "rq.0001"},
        )
        
        resolved = resolve_document_link(link)
        
        assert resolved.target is not None
        assert "ck3.goToEvent" in resolved.target
        assert "rq.0001" in resolved.target


# =============================================================================
# Test: Edge Cases
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_empty_document(self):
        """Should handle empty document."""
        text = ""
        
        links = get_document_links(text, "file:///test.txt")
        
        assert links == []
    
    def test_no_links_in_code(self):
        """Should handle document with no linkable content."""
        text = """
my_event.0001 = {
    trigger = { is_adult = yes }
}
"""
        links = get_document_links(text, "file:///test.txt")
        
        # May or may not have links depending on what we detect
        # The important thing is it doesn't crash
        assert isinstance(links, list)
    
    def test_malformed_path(self):
        """Should handle malformed paths gracefully."""
        text = "# See common//broken/path.txt"
        
        links = get_document_links(text, "file:///test.txt")
        
        # Should not crash
        assert isinstance(links, list)
    
    def test_very_long_path(self):
        """Should handle very long paths."""
        long_path = "common/" + "/".join(["folder"] * 20) + "/file.txt"
        text = f"# {long_path}"
        
        links = get_document_links(text, "file:///test.txt")
        
        # Should not crash
        assert isinstance(links, list)
    
    def test_special_characters_in_path(self):
        """Should handle special characters in paths."""
        text = "# gfx/icons/my icon (2).dds"
        
        links = get_document_links(text, "file:///test.txt")
        
        # Should not crash
        assert isinstance(links, list)
    
    def test_unicode_in_comment(self):
        """Should handle Unicode in comments."""
        text = "# 日本語 https://example.com/page"
        
        links = get_document_links(text, "file:///test.txt")
        
        # Should find the URL
        assert len(links) >= 1


# =============================================================================
# Test: get_link_at_position
# =============================================================================


class TestGetLinkAtPosition:
    """Tests for getting link at specific position."""
    
    def test_position_on_link(self):
        """Should return link when position is on it."""
        text = "# See https://example.com/page"
        position = types.Position(line=0, character=10)  # On the URL
        
        link = get_link_at_position(text, position, "file:///test.txt")
        
        assert link is not None
        assert "example.com" in (link.target or "")
    
    def test_position_not_on_link(self):
        """Should return None when position is not on link."""
        text = "# No link here"
        position = types.Position(line=0, character=5)
        
        link = get_link_at_position(text, position, "file:///test.txt")
        
        assert link is None
    
    def test_position_at_link_start(self):
        """Should detect link at start position."""
        text = "https://example.com"
        position = types.Position(line=0, character=0)
        
        link = get_link_at_position(text, position, "file:///test.txt")
        
        assert link is not None
    
    def test_position_at_link_end(self):
        """Should detect link at end position."""
        text = "https://example.com"
        position = types.Position(line=0, character=len(text) - 1)
        
        link = get_link_at_position(text, position, "file:///test.txt")
        
        assert link is not None


# =============================================================================
# Test: Localization References
# =============================================================================


class TestLocalizationReferences:
    """Tests for localization key detection."""
    
    def test_find_loc_reference(self):
        """Should find localization key references."""
        text = "title = my_event.0001.t"
        
        refs = find_localization_references(text, 0)
        
        assert len(refs) >= 1
        assert any(r.target == "my_event.0001.t" for r in refs)
    
    def test_find_desc_reference(self):
        """Should find desc localization references."""
        text = "desc = my_event.0001.desc"
        
        refs = find_localization_references(text, 0)
        
        assert len(refs) >= 1
    
    def test_skip_scope_reference(self):
        """Should skip scope: references."""
        text = "title = scope:target"
        
        refs = find_localization_references(text, 0)
        
        # Should not find scope:target as localization
        assert not any(r.target == "scope:target" for r in refs)


# =============================================================================
# Test: Integration
# =============================================================================


class TestIntegration:
    """Integration tests with realistic content."""
    
    def test_full_event_header_comment(self):
        """Should find links in event header comments."""
        text = """# ============================================================================
# Event Chain: Character Introduction
# 
# Related files:
#   - common/scripted_effects/intro_effects.txt
#   - localization/english/intro_l_english.yml
#
# See rq.0001 for the starting event
# Wiki: https://ck3.paradoxwikis.com/Events
# ============================================================================

namespace = my_mod
"""
        links = get_document_links(text, "file:///test.txt")
        
        # Should find: 2 file paths + 1 event ID + 1 URL = 4 links
        assert len(links) >= 3
    
    def test_mixed_content(self):
        """Should handle mixed content types."""
        text = """# File: common/effects.txt
# URL: https://example.com
my_event.0001 = {
    icon = "gfx/icons/icon.dds"
}
"""
        links = get_document_links(text, "file:///test.txt")
        
        # Should find multiple link types
        assert len(links) >= 2
