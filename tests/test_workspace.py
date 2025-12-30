"""
Tests for workspace features module.
"""

import pytest
from pychivalry.workspace import (
    ModDescriptor,
    UndefinedReference,
    EventChainLink,
    LocalizationCoverage,
    parse_mod_descriptor,
    is_valid_mod_descriptor,
    find_undefined_scripted_effects,
    find_undefined_scripted_triggers,
    extract_trigger_event_calls,
    validate_event_chain,
    extract_localization_keys_from_event,
    calculate_localization_coverage,
    find_broken_event_chains,
    get_workspace_diagnostics_summary,
    is_version_compatible,
)


class TestModDescriptorParsing:
    """Tests for mod descriptor file parsing."""
    
    def test_parse_basic_mod_descriptor(self):
        """Test parsing a basic mod descriptor."""
        content = '''
name = "My Cool Mod"
version = "1.0.0"
supported_version = "1.11.*"
path = "mod/my_cool_mod"
'''
        descriptor = parse_mod_descriptor(content)
        
        assert descriptor is not None
        assert descriptor.name == "My Cool Mod"
        assert descriptor.version == "1.0.0"
        assert descriptor.supported_version == "1.11.*"
        assert descriptor.path == "mod/my_cool_mod"
    
    def test_parse_mod_with_tags(self):
        """Test parsing mod with tags."""
        content = '''
name = "Test Mod"
tags = { "Gameplay" "Events" "Balance" }
'''
        descriptor = parse_mod_descriptor(content)
        
        assert descriptor is not None
        assert descriptor.tags == ["Gameplay", "Events", "Balance"]
    
    def test_parse_mod_with_dependencies(self):
        """Test parsing mod with dependencies."""
        content = '''
name = "Dependent Mod"
dependencies = { "required_mod_1" "required_mod_2" }
'''
        descriptor = parse_mod_descriptor(content)
        
        assert descriptor is not None
        assert descriptor.dependencies == ["required_mod_1", "required_mod_2"]
    
    def test_parse_mod_with_replace_paths(self):
        """Test parsing mod with replace_path entries."""
        content = '''
name = "Total Conversion"
replace_path = "common/traits"
replace_path = "events"
'''
        descriptor = parse_mod_descriptor(content)
        
        assert descriptor is not None
        assert descriptor.replace_paths == ["common/traits", "events"]
    
    def test_parse_mod_with_picture(self):
        """Test parsing mod with picture field."""
        content = '''
name = "Visual Mod"
picture = "thumbnail.png"
'''
        descriptor = parse_mod_descriptor(content)
        
        assert descriptor is not None
        assert descriptor.picture == "thumbnail.png"
    
    def test_parse_mod_with_remote_file_id(self):
        """Test parsing mod with Steam Workshop ID."""
        content = '''
name = "Workshop Mod"
remote_file_id = "1234567890"
'''
        descriptor = parse_mod_descriptor(content)
        
        assert descriptor is not None
        assert descriptor.remote_file_id == "1234567890"
    
    def test_parse_empty_content(self):
        """Test parsing empty content returns None."""
        descriptor = parse_mod_descriptor("")
        assert descriptor is None
    
    def test_parse_content_without_name(self):
        """Test parsing content without name returns None."""
        content = 'version = "1.0.0"'
        descriptor = parse_mod_descriptor(content)
        assert descriptor is None


class TestModDescriptorValidation:
    """Tests for mod descriptor validation."""
    
    def test_valid_descriptor(self):
        """Test validation of a valid descriptor."""
        descriptor = ModDescriptor(
            name="Valid Mod",
            version="1.0.0",
            supported_version="1.11.*",
            path="mod/valid_mod"
        )
        
        is_valid, errors = is_valid_mod_descriptor(descriptor)
        assert is_valid
        assert len(errors) == 0
    
    def test_descriptor_without_name(self):
        """Test validation fails without name."""
        descriptor = ModDescriptor(
            name="",
            version="1.0.0",
            supported_version="1.11.*",
            path="mod/test"
        )
        
        is_valid, errors = is_valid_mod_descriptor(descriptor)
        assert not is_valid
        assert "Mod name is required" in errors
    
    def test_descriptor_without_path(self):
        """Test validation fails without path."""
        descriptor = ModDescriptor(
            name="Test Mod",
            version="1.0.0",
            supported_version="1.11.*",
            path=""
        )
        
        is_valid, errors = is_valid_mod_descriptor(descriptor)
        assert not is_valid
        assert "Mod path is required" in errors
    
    def test_descriptor_with_invalid_version_format(self):
        """Test validation fails with invalid version format."""
        descriptor = ModDescriptor(
            name="Test Mod",
            version="1.0.0",
            supported_version="invalid",
            path="mod/test"
        )
        
        is_valid, errors = is_valid_mod_descriptor(descriptor)
        assert not is_valid
        assert any("Invalid supported_version format" in e for e in errors)


class TestUndefinedReferences:
    """Tests for finding undefined references."""
    
    def test_find_undefined_scripted_effects(self):
        """Test finding undefined scripted effects."""
        used = {"effect_a", "effect_b", "effect_c"}
        defined = {"effect_a", "effect_b"}
        
        undefined = find_undefined_scripted_effects(used, defined)
        assert undefined == ["effect_c"]
    
    def test_no_undefined_effects(self):
        """Test when all effects are defined."""
        used = {"effect_a", "effect_b"}
        defined = {"effect_a", "effect_b", "effect_c"}
        
        undefined = find_undefined_scripted_effects(used, defined)
        assert undefined == []
    
    def test_find_undefined_scripted_triggers(self):
        """Test finding undefined scripted triggers."""
        used = {"trigger_a", "trigger_b", "trigger_c"}
        defined = {"trigger_a"}
        
        undefined = find_undefined_scripted_triggers(used, defined)
        assert undefined == ["trigger_b", "trigger_c"]
    
    def test_no_undefined_triggers(self):
        """Test when all triggers are defined."""
        used = {"trigger_a"}
        defined = {"trigger_a", "trigger_b"}
        
        undefined = find_undefined_scripted_triggers(used, defined)
        assert undefined == []


class TestEventChainValidation:
    """Tests for event chain validation."""
    
    def test_extract_simple_trigger_event(self):
        """Test extracting simple trigger_event calls."""
        content = "trigger_event = my_mod.0001"
        events = extract_trigger_event_calls(content)
        
        assert events == ["my_mod.0001"]
    
    def test_extract_block_trigger_event(self):
        """Test extracting trigger_event with id block."""
        content = "trigger_event = { id = my_mod.0002 days = 5 }"
        events = extract_trigger_event_calls(content)
        
        assert "my_mod.0002" in events
    
    def test_extract_multiple_trigger_events(self):
        """Test extracting multiple trigger_event calls."""
        content = '''
trigger_event = my_mod.0001
trigger_event = { id = my_mod.0002 }
trigger_event = my_mod.0003
'''
        events = extract_trigger_event_calls(content)
        
        assert len(events) == 3
        assert "my_mod.0001" in events
        assert "my_mod.0002" in events
        assert "my_mod.0003" in events
    
    def test_validate_event_chain_all_exist(self):
        """Test validating event chain where all events exist."""
        event_content = "trigger_event = my_mod.0002"
        all_events = {"my_mod.0001", "my_mod.0002", "my_mod.0003"}
        
        links = validate_event_chain("my_mod.0001", event_content, all_events)
        
        assert len(links) == 1
        assert links[0].source_event == "my_mod.0001"
        assert links[0].target_event == "my_mod.0002"
        assert links[0].target_exists
    
    def test_validate_event_chain_with_missing(self):
        """Test validating event chain with missing target."""
        event_content = "trigger_event = my_mod.9999"
        all_events = {"my_mod.0001", "my_mod.0002"}
        
        links = validate_event_chain("my_mod.0001", event_content, all_events)
        
        assert len(links) == 1
        assert links[0].target_event == "my_mod.9999"
        assert not links[0].target_exists
    
    def test_validate_event_chain_no_triggers(self):
        """Test validating event with no trigger_event calls."""
        event_content = "add_gold = 100"
        all_events = {"my_mod.0001"}
        
        links = validate_event_chain("my_mod.0001", event_content, all_events)
        
        assert len(links) == 0


class TestLocalizationCoverage:
    """Tests for localization coverage tracking."""
    
    def test_extract_localization_keys_from_event(self):
        """Test extracting localization keys from event."""
        event_content = '''
title = my_event.t
desc = my_event.desc
option = {
    name = my_event.a
}
option = {
    name = my_event.b
}
'''
        keys = extract_localization_keys_from_event(event_content)
        
        assert "my_event.t" in keys
        assert "my_event.desc" in keys
        assert "my_event.a" in keys
        assert "my_event.b" in keys
    
    def test_calculate_full_coverage(self):
        """Test calculating 100% localization coverage."""
        events = {
            "event_1": "title = event_1.t\ndesc = event_1.desc",
            "event_2": "title = event_2.t\ndesc = event_2.desc"
        }
        loc_keys = {"event_1.t", "event_1.desc", "event_2.t", "event_2.desc"}
        
        coverage = calculate_localization_coverage(events, loc_keys)
        
        assert coverage.total_events == 2
        assert coverage.events_with_loc == 2
        assert coverage.coverage_percentage == 100.0
        assert len(coverage.missing_keys) == 0
    
    def test_calculate_partial_coverage(self):
        """Test calculating partial localization coverage."""
        events = {
            "event_1": "title = event_1.t\ndesc = event_1.desc",
            "event_2": "title = event_2.t\ndesc = event_2.desc"
        }
        loc_keys = {"event_1.t", "event_1.desc"}  # Missing event_2 keys
        
        coverage = calculate_localization_coverage(events, loc_keys)
        
        assert coverage.total_events == 2
        assert coverage.events_with_loc == 1
        assert coverage.coverage_percentage == 50.0
        assert "event_2.t" in coverage.missing_keys
        assert "event_2.desc" in coverage.missing_keys
    
    def test_calculate_zero_coverage(self):
        """Test calculating zero localization coverage."""
        events = {
            "event_1": "title = event_1.t"
        }
        loc_keys = set()  # No localization keys
        
        coverage = calculate_localization_coverage(events, loc_keys)
        
        assert coverage.total_events == 1
        assert coverage.events_with_loc == 0
        assert coverage.coverage_percentage == 0.0
        assert "event_1.t" in coverage.missing_keys


class TestBrokenEventChains:
    """Tests for finding broken event chains."""
    
    def test_find_broken_event_chains(self):
        """Test finding broken event chains in workspace."""
        events = {
            "event_1": "trigger_event = event_2",
            "event_2": "trigger_event = event_missing"
        }
        event_files = {
            "event_1": "file1.txt",
            "event_2": "file2.txt"
        }
        
        broken = find_broken_event_chains(events, event_files)
        
        assert len(broken) == 1
        assert broken[0].source_event == "event_2"
        assert broken[0].target_event == "event_missing"
        assert broken[0].source_file == "file2.txt"
        assert not broken[0].target_exists
    
    def test_no_broken_chains(self):
        """Test when all event chains are valid."""
        events = {
            "event_1": "trigger_event = event_2",
            "event_2": "add_gold = 100"
        }
        event_files = {
            "event_1": "file1.txt",
            "event_2": "file2.txt"
        }
        
        broken = find_broken_event_chains(events, event_files)
        
        assert len(broken) == 0


class TestWorkspaceDiagnostics:
    """Tests for workspace diagnostics summary."""
    
    def test_diagnostics_summary_with_issues(self):
        """Test generating diagnostics summary with issues."""
        undefined_effects = ["effect_1", "effect_2"]
        undefined_triggers = ["trigger_1"]
        broken_chains = [
            EventChainLink("event_1", "event_missing", "file.txt", 10, False)
        ]
        loc_coverage = LocalizationCoverage(
            total_events=10,
            events_with_loc=7,
            missing_keys=["key_1", "key_2"],
            coverage_percentage=70.0
        )
        
        summary = get_workspace_diagnostics_summary(
            undefined_effects,
            undefined_triggers,
            broken_chains,
            loc_coverage
        )
        
        assert "Workspace Validation Summary" in summary
        assert "Undefined References" in summary
        assert "Scripted Effects" in summary
        assert "Scripted Triggers" in summary
        assert "Broken Event Chains" in summary
        assert "Localization Coverage" in summary
        assert "70.0%" in summary
    
    def test_diagnostics_summary_clean(self):
        """Test generating diagnostics summary with no issues."""
        loc_coverage = LocalizationCoverage(
            total_events=10,
            events_with_loc=10,
            missing_keys=[],
            coverage_percentage=100.0
        )
        
        summary = get_workspace_diagnostics_summary(
            [],
            [],
            [],
            loc_coverage
        )
        
        assert "Workspace Validation Summary" in summary
        assert "100.0%" in summary
        assert "Undefined References" not in summary
        assert "Broken Event Chains" not in summary


class TestVersionCompatibility:
    """Tests for version compatibility checking."""
    
    def test_exact_version_match(self):
        """Test exact version match."""
        assert is_version_compatible("1.11.5", "1.11.5")
    
    def test_wildcard_version_match(self):
        """Test wildcard version match."""
        assert is_version_compatible("1.11.*", "1.11.5")
        assert is_version_compatible("1.11.*", "1.11.0")
        assert is_version_compatible("1.11.*", "1.11.99")
    
    def test_wildcard_version_mismatch(self):
        """Test wildcard version mismatch."""
        assert not is_version_compatible("1.11.*", "1.12.0")
        assert not is_version_compatible("1.11.*", "2.0.0")
    
    def test_version_with_no_wildcard_mismatch(self):
        """Test non-matching versions."""
        assert not is_version_compatible("1.11.5", "1.11.6")
        assert not is_version_compatible("1.11.0", "1.12.0")
    
    def test_empty_versions(self):
        """Test empty version strings."""
        assert is_version_compatible("", "1.11.5")
        assert is_version_compatible("1.11.*", "")
        assert is_version_compatible("", "")
    
    def test_multi_level_wildcard(self):
        """Test wildcard at different levels."""
        assert is_version_compatible("1.*", "1.11.5")
        assert is_version_compatible("1.*", "1.0.0")
        assert not is_version_compatible("1.*", "2.0.0")
