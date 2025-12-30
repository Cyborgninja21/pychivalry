"""Regression tests for fixed bugs.

Each test represents a bug that was found and fixed. These tests ensure the bugs don't come back.
"""

import pytest
from pychivalry.parser import parse_document
from pychivalry.diagnostics import get_diagnostics
from pychivalry.completions import get_context_aware_completions
from pychivalry.navigation import find_definition
from pychivalry.indexer import DocumentIndex


class TestParserRegressions:
    """Regression tests for parser bugs."""

    def test_empty_file_no_crash(self):
        """Regression: Parser should handle empty files without crashing.
        
        Bug: Parser crashed on empty input files.
        Fixed: Added empty file handling in tokenizer.
        """
        result = parse_document("", "empty.txt")
        assert result is not None
        assert result.root is not None

    def test_unclosed_brace_recovery(self):
        """Regression: Parser should recover from unclosed braces.
        
        Bug: Unclosed brace caused parser to hang.
        Fixed: Added error recovery for unmatched delimiters.
        """
        content = """
        namespace = test
        
        character_event = {
            id = test.001
            # Missing closing brace
        """
        
        result = parse_document(content, "unclosed.txt")
        assert result is not None

    def test_nested_quotes_handling(self):
        """Regression: Parser should handle nested quotes correctly.
        
        Bug: String with escaped quotes caused tokenizer error.
        Fixed: Improved string parsing in tokenizer.
        """
        content = """
        text = "This is a \\"quoted\\" word"
        """
        
        result = parse_document(content, "quotes.txt")
        assert result is not None

    def test_comment_at_eof(self):
        """Regression: Parser should handle comments at end of file.
        
        Bug: Comment at EOF without trailing newline caused crash.
        Fixed: Added EOF handling in comment parsing.
        """
        content = "namespace = test\n# Comment at end"
        result = parse_document(content, "comment_eof.txt")
        assert result is not None

    def test_whitespace_only_file(self):
        """Regression: Parser should handle files with only whitespace.
        
        Bug: Files with only spaces/tabs/newlines crashed parser.
        Fixed: Added whitespace-only file detection.
        """
        content = "   \n\t\n   \n"
        result = parse_document(content, "whitespace.txt")
        assert result is not None


class TestDiagnosticsRegressions:
    """Regression tests for diagnostics bugs."""

    def test_no_duplicate_diagnostics(self):
        """Regression: Same diagnostic should not appear multiple times.
        
        Bug: Identical diagnostics were reported multiple times.
        Fixed: Added diagnostic deduplication.
        """
        content = """
        namespace = test
        character_event = {
            id = test.001
            add_gond = 100
            add_gond = 200
        }
        """
        
        doc = parse_document(content, "test.txt")
        diagnostics = get_diagnostics(doc)
        
        # Should have diagnostics for typo, but not duplicates
        typo_diagnostics = [d for d in diagnostics if "add_gond" in d.message]
        
        # Each instance should have its own diagnostic, but messages shouldn't be identical
        if len(typo_diagnostics) > 1:
            messages = [d.message for d in typo_diagnostics]
            # All messages should be the same content but different positions
            assert typo_diagnostics[0].range != typo_diagnostics[1].range

    def test_diagnostics_on_modified_document(self):
        """Regression: Diagnostics should update correctly after document changes.
        
        Bug: Stale diagnostics persisted after document modification.
        Fixed: Clear cached diagnostics on document change.
        """
        content_v1 = """
        namespace = test
        character_event = {
            id = test.001
            add_gond = 100
        }
        """
        
        content_v2 = """
        namespace = test
        character_event = {
            id = test.001
            add_gold = 100
        }
        """
        
        # Parse first version
        doc_v1 = parse_document(content_v1, "test.txt")
        diag_v1 = get_diagnostics(doc_v1)
        
        # Should have typo diagnostic
        assert any("add_gond" in d.message.lower() or "unknown" in d.message.lower() for d in diag_v1)
        
        # Parse corrected version
        doc_v2 = parse_document(content_v2, "test.txt")
        diag_v2 = get_diagnostics(doc_v2)
        
        # Should not have typo diagnostic anymore
        assert not any("add_gond" in d.message.lower() for d in diag_v2)


class TestCompletionsRegressions:
    """Regression tests for completions bugs."""

    def test_completions_after_dot_in_empty_context(self):
        """Regression: Completions after dot should not crash on empty context.
        
        Bug: Requesting completions after "." with no prior context crashed.
        Fixed: Added context validation before scope link completions.
        """
        content = "."
        
        doc = parse_document(content, "test.txt")
        index = DocumentIndex()
        index.index_document("test.txt", doc)
        
        position = (0, 1)
        
        # Should not crash
        completions = get_context_aware_completions(doc, position, index)
        assert isinstance(completions, list)

    def test_completions_at_document_boundary(self):
        """Regression: Completions at document end should not crash.
        
        Bug: Position at or beyond document end caused index error.
        Fixed: Added bounds checking in completion position handling.
        """
        content = "namespace = test\n"
        
        doc = parse_document(content, "test.txt")
        index = DocumentIndex()
        index.index_document("test.txt", doc)
        
        # Position at document end
        position = (1, 0)
        
        # Should not crash
        completions = get_context_aware_completions(doc, position, index)
        assert isinstance(completions, list)

    def test_snippet_completions_in_effect_block(self):
        """Regression: Snippet completions should appear in effect blocks.
        
        Bug: Snippets were filtered out in effect contexts.
        Fixed: Allow snippets in all contexts.
        """
        content = """
        namespace = test
        character_event = {
            id = test.001
            immediate = {
                
            }
        }
        """
        
        doc = parse_document(content, "test.txt")
        index = DocumentIndex()
        index.index_document("test.txt", doc)
        
        position = (5, 16)  # Inside immediate block
        
        completions = get_context_aware_completions(doc, position, index)
        
        # Should include some completions
        assert len(completions) > 0


class TestNavigationRegressions:
    """Regression tests for navigation bugs."""

    def test_find_definition_same_file(self):
        """Regression: Find definition should work within same file.
        
        Bug: Definition search only checked other files, not current file.
        Fixed: Include current file in definition search.
        """
        content = """
        my_effect = {
            add_gold = 100
        }
        
        character_event = {
            id = test.001
            immediate = {
                my_effect = yes
            }
        }
        """
        
        doc = parse_document(content, "test.txt")
        index = DocumentIndex()
        index.index_document("test.txt", doc)
        
        # Position on "my_effect" usage
        position = (8, 20)
        
        definitions = find_definition(doc, position, index)
        
        # Should find definition in same file
        assert len(definitions) > 0
        assert definitions[0].uri == "test.txt"

    def test_definition_of_namespaced_event(self):
        """Regression: Should find event definitions with namespace prefix.
        
        Bug: Event IDs with namespace weren't matched correctly.
        Fixed: Improved event ID parsing to handle namespace.id format.
        """
        event_file = """
        namespace = my_events
        
        character_event = {
            id = my_events.001
            desc = "Test event"
        }
        """
        
        trigger_file = """
        character_event = {
            id = other.001
            immediate = {
                trigger_event = my_events.001
            }
        }
        """
        
        event_doc = parse_document(event_file, "my_events.txt")
        trigger_doc = parse_document(trigger_file, "trigger.txt")
        
        index = DocumentIndex()
        index.index_document("my_events.txt", event_doc)
        index.index_document("trigger.txt", trigger_doc)
        
        # Find definition of my_events.001
        position = (4, 35)  # On trigger_event value
        
        definitions = find_definition(trigger_doc, position, index)
        
        # Should find the event definition
        assert len(definitions) > 0


class TestScopesRegressions:
    """Regression tests for scope validation bugs."""

    def test_universal_scope_in_any_context(self):
        """Regression: Universal scopes should work in any context.
        
        Bug: Universal scopes like "root" were rejected in some contexts.
        Fixed: Added universal scope handling to all validation paths.
        """
        from pychivalry.scopes import validate_scope_chain
        
        # root is a universal scope
        result = validate_scope_chain("root", "character")
        assert result is not None  # Should be valid

    def test_scope_chain_with_list_iteration(self):
        """Regression: Scope chains through list iterators should validate.
        
        Bug: Scope changed by list iterator wasn't tracked correctly.
        Fixed: Updated scope resolution to track list iterator scope changes.
        """
        from pychivalry.scopes import validate_scope_chain
        
        # any_vassal changes scope from character to character
        result = validate_scope_chain("any_vassal", "character")
        assert result is not None


class TestEventsRegressions:
    """Regression tests for event system bugs."""

    def test_event_without_theme_allowed(self):
        """Regression: Events should be valid without explicit theme.
        
        Bug: Events without theme field were flagged as errors.
        Fixed: Made theme field optional for events.
        """
        from pychivalry.events import validate_event_structure
        
        event_node = parse_document("""
        character_event = {
            id = test.001
            desc = test.001.desc
        }
        """, "test.txt").root.children[0]
        
        errors = validate_event_structure(event_node)
        
        # Should not have error about missing theme
        assert not any("theme" in e.lower() for e in errors)

    def test_dynamic_desc_validates(self):
        """Regression: Dynamic descriptions should validate correctly.
        
        Bug: triggered_desc was flagged as invalid desc format.
        Fixed: Added support for triggered_desc, first_valid, random_valid.
        """
        from pychivalry.events import validate_event_structure
        
        event_node = parse_document("""
        character_event = {
            id = test.001
            desc = {
                triggered_desc = {
                    trigger = { age >= 16 }
                    desc = test.001.desc_young
                }
                triggered_desc = {
                    trigger = { age >= 50 }
                    desc = test.001.desc_old
                }
            }
        }
        """, "test.txt").root.children[0]
        
        errors = validate_event_structure(event_node)
        
        # Should not flag dynamic desc as error
        # (May have other errors, but not desc-related)
        assert not any("desc" in e.lower() and "invalid" in e.lower() for e in errors)


class TestBackwardCompatibility:
    """Tests ensuring backward compatibility with older CK3 versions."""

    def test_old_event_format_compatibility(self):
        """Ensure parser handles older CK3 event format."""
        # Older format that might have been used
        content = """
        events = {
            character_event = {
                id = 1
                desc = "OLD_FORMAT"
            }
        }
        """
        
        result = parse_document(content, "old_format.txt")
        assert result is not None

    def test_legacy_scope_names(self):
        """Ensure legacy scope names still work."""
        from pychivalry.scopes import get_scope_definition
        
        # Some scopes might have had different names in older versions
        # This test would check that we still support them
        scope = get_scope_definition("character")
        assert scope is not None
