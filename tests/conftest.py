"""
Shared pytest fixtures for pychivalry tests.

This module provides common test fixtures that can be reused across multiple test files.
"""

import pytest
from pathlib import Path
from lsprotocol import types
from pygls.workspace import Workspace

# Test fixtures directory
FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir():
    """Path to test fixtures directory."""
    return FIXTURES_DIR


@pytest.fixture
def sample_event_text():
    """Sample valid event text."""
    return '''namespace = test_mod

test_mod.0001 = {
    type = character_event
    title = test_mod.0001.t
    desc = test_mod.0001.desc
    theme = intrigue
    
    left_portrait = root
    
    trigger = {
        is_adult = yes
        is_ruler = yes
    }
    
    immediate = {
        save_scope_as = main_character
    }
    
    option = {
        name = test_mod.0001.a
        add_gold = 100
    }
}
'''


@pytest.fixture
def syntax_error_text():
    """Sample text with syntax errors."""
    return '''namespace = test_mod

test_mod.0001 = {
    type = character_event
    trigger = {
        is_adult = yes
    # Missing closing bracket
    
    option = {
        name = test_mod.0001.a
    }
}
'''


@pytest.fixture
def scope_chain_text():
    """Sample text with scope chains."""
    return '''test_mod.0001 = {
    type = character_event
    trigger = {
        liege = {
            primary_title = {
                holder = { is_adult = yes }
            }
        }
    }
    immediate = {
        liege.primary_title.holder = { save_scope_as = target }
        scope:target = { add_gold = 100 }
    }
}
'''


@pytest.fixture
def workspace(tmp_path):
    """Create a workspace for testing."""
    return Workspace(str(tmp_path))
