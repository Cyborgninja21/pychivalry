"""Integration tests for complete LSP workflows.

Tests end-to-end user workflows combining multiple LSP features.
"""

import pytest
from pychivalry.parser import parse_document
from pychivalry.diagnostics import get_diagnostics
from pychivalry.completions import get_context_aware_completions
from pychivalry.navigation import find_definition, find_references
from pychivalry.code_actions import get_all_code_actions
from pychivalry.indexer import DocumentIndex


class TestEndToEndWorkflows:
    """Test complete user workflows from start to finish."""

    def test_open_file_get_diagnostics_apply_fix(self):
        """Test: Open file → Get diagnostics → Apply code action → Verify fix."""
        # 1. Open file with typo
        content = """
        namespace = my_events
        
        character_event = {
            id = my_events.001
            add_gond = 100  # Typo: should be add_gold
        }
        """
        
        # 2. Parse and get diagnostics
        doc = parse_document(content, "test.txt")
        diagnostics = get_diagnostics(doc)
        
        # 3. Verify diagnostic exists
        assert len(diagnostics) > 0
        typo_diagnostic = next((d for d in diagnostics if "add_gond" in d.message.lower()), None)
        assert typo_diagnostic is not None
        
        # 4. Get code actions for the typo
        actions = get_all_code_actions(doc, typo_diagnostic.range, [typo_diagnostic])
        
        # 5. Verify "Did you mean?" suggestion exists
        assert len(actions) > 0
        fix_action = next((a for a in actions if "add_gold" in str(a.title)), None)
        assert fix_action is not None

    def test_type_code_request_completions_accept(self):
        """Test: Type code → Request completions → Accept → Verify result."""
        # 1. Start typing
        content = """
        namespace = my_events
        
        character_event = {
            id = my_events.001
            add_
        """
        
        # 2. Parse document
        doc = parse_document(content, "test.txt")
        index = DocumentIndex()
        index.index_document("test.txt", doc)
        
        # 3. Request completions at cursor
        position = (5, 16)  # After "add_"
        completions = get_context_aware_completions(doc, position, index)
        
        # 4. Verify relevant completions exist
        assert len(completions) > 0
        gold_completion = next((c for c in completions if c.label == "add_gold"), None)
        assert gold_completion is not None
        
        # 5. Simulate accepting completion
        assert "add_gold" in gold_completion.label

    def test_navigate_definition_modify_find_references(self):
        """Test: Navigate definition → Modify → Find references → Verify updates."""
        # 1. Create files with scripted effect
        effect_file = """
        my_custom_effect = {
            add_gold = 100
        }
        """
        
        event_file = """
        namespace = my_events
        
        character_event = {
            id = my_events.001
            immediate = {
                my_custom_effect = yes
            }
        }
        """
        
        # 2. Parse both files
        effect_doc = parse_document(effect_file, "effects.txt")
        event_doc = parse_document(event_file, "events.txt")
        
        # 3. Index both files
        index = DocumentIndex()
        index.index_document("effects.txt", effect_doc)
        index.index_document("events.txt", event_doc)
        
        # 4. Find definition of my_custom_effect from event file
        position = (6, 20)  # On "my_custom_effect"
        definitions = find_definition(event_doc, position, index)
        assert len(definitions) > 0
        assert definitions[0].uri == "effects.txt"
        
        # 5. Find all references to my_custom_effect
        references = find_references(event_doc, position, index, include_declaration=True)
        assert len(references) >= 2  # Definition + usage

    def test_cross_file_event_chain_validation(self):
        """Test: Cross-file event chain validation."""
        # 1. Create event that triggers another event
        event1_file = """
        namespace = events_a
        
        character_event = {
            id = events_a.001
            immediate = {
                trigger_event = events_b.001
            }
        }
        """
        
        event2_file = """
        namespace = events_b
        
        character_event = {
            id = events_b.001
            desc = "Second event"
        }
        """
        
        # 2. Parse both files
        doc1 = parse_document(event1_file, "events_a.txt")
        doc2 = parse_document(event2_file, "events_b.txt")
        
        # 3. Index both files
        index = DocumentIndex()
        index.index_document("events_a.txt", doc1)
        index.index_document("events_b.txt", doc2)
        
        # 4. Validate event chain
        diagnostics1 = get_diagnostics(doc1, index)
        
        # 5. Verify no broken chain errors
        broken_chain_errors = [d for d in diagnostics1 if "undefined" in d.message.lower() and "event" in d.message.lower()]
        assert len(broken_chain_errors) == 0

    def test_multi_file_scripted_effect_usage(self):
        """Test: Scripted effect defined in one file, used in multiple others."""
        # 1. Define scripted effect
        effect_file = """
        grant_gold_and_prestige = {
            add_gold = 100
            add_prestige = 50
        }
        """
        
        # 2. Use in multiple event files
        event1 = """
        namespace = rewards
        character_event = {
            id = rewards.001
            immediate = { grant_gold_and_prestige = yes }
        }
        """
        
        event2 = """
        namespace = bonuses
        character_event = {
            id = bonuses.001
            immediate = { grant_gold_and_prestige = yes }
        }
        """
        
        # 3. Parse all files
        effect_doc = parse_document(effect_file, "effects.txt")
        event1_doc = parse_document(event1, "rewards.txt")
        event2_doc = parse_document(event2, "bonuses.txt")
        
        # 4. Index all files
        index = DocumentIndex()
        index.index_document("effects.txt", effect_doc)
        index.index_document("rewards.txt", event1_doc)
        index.index_document("bonuses.txt", event2_doc)
        
        # 5. Find all references to the scripted effect
        position = (4, 30)  # On grant_gold_and_prestige in event1
        references = find_references(event1_doc, position, index, include_declaration=True)
        
        # Should find: definition + 2 usages
        assert len(references) >= 3


class TestModDescriptorWorkflow:
    """Test mod descriptor loading and validation workflows."""

    def test_load_mod_with_descriptor(self):
        """Test: Load mod descriptor → Parse script files → Validate."""
        from pychivalry.workspace import parse_mod_descriptor
        
        # 1. Create mod descriptor
        descriptor = """
        name = "My Test Mod"
        version = "1.0.0"
        supported_version = "1.11.*"
        path = "mod/my_mod"
        """
        
        # 2. Parse descriptor
        mod = parse_mod_descriptor(descriptor)
        
        # 3. Verify parsing
        assert mod is not None
        assert mod.name == "My Test Mod"
        assert mod.version == "1.0.0"
        assert mod.supported_version == "1.11.*"
        
        # 4. Create script file
        script = """
        namespace = my_mod
        character_event = {
            id = my_mod.001
        }
        """
        
        # 5. Parse and validate script
        doc = parse_document(script, "events.txt")
        diagnostics = get_diagnostics(doc)
        
        # No errors expected for valid event
        assert all(d.severity != 1 for d in diagnostics)  # No errors


class TestLocalizationWorkflow:
    """Test localization key validation across files."""

    def test_event_localization_coverage(self):
        """Test: Event references localization keys → Validate coverage."""
        from pychivalry.workspace import extract_localization_keys_from_event
        
        # 1. Create event with loc keys
        event = """
        namespace = story
        character_event = {
            id = story.001
            title = story.001.t
            desc = story.001.desc
            option = {
                name = story.001.a
            }
        }
        """
        
        # 2. Parse event
        doc = parse_document(event, "events.txt")
        
        # 3. Extract loc keys
        loc_keys = extract_localization_keys_from_event(doc.root.children[1] if len(doc.root.children) > 1 else None)
        
        # 4. Verify keys extracted
        assert len(loc_keys) >= 3
        assert any("story.001.t" in key for key in loc_keys)
        assert any("story.001.desc" in key for key in loc_keys)
        assert any("story.001.a" in key for key in loc_keys)
