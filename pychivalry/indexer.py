"""
Document indexer for CK3 language server.

This module provides the DocumentIndex class that tracks symbols across all open
documents in the workspace. It extracts and indexes events, scripted effects,
scripted triggers, namespaces, and other CK3 constructs for cross-file navigation.
"""

from typing import Dict, List, Optional
from lsprotocol import types
from pychivalry.parser import CK3Node
import logging

logger = logging.getLogger(__name__)


class DocumentIndex:
    """
    Track symbols across all open documents.
    
    This index is updated whenever a document is opened, changed, or closed.
    It enables features like:
    - Go to definition for events, scripted effects, scripted triggers
    - Find references across files
    - Workspace-wide symbol search
    """
    
    def __init__(self):
        """Initialize empty index."""
        self.namespaces: Dict[str, str] = {}  # namespace -> file uri
        self.events: Dict[str, types.Location] = {}  # event_id -> Location
        self.scripted_effects: Dict[str, types.Location] = {}  # name -> Location
        self.scripted_triggers: Dict[str, types.Location] = {}  # name -> Location
        self.scripted_lists: Dict[str, types.Location] = {}  # name -> Location
        self.script_values: Dict[str, types.Location] = {}  # name -> Location
        self.on_actions: Dict[str, List[str]] = {}  # on_action -> event list
        self.saved_scopes: Dict[str, types.Location] = {}  # scope_name -> save Location
    
    def update_from_ast(self, uri: str, ast: List[CK3Node]):
        """
        Extract and index all symbols from an AST.
        
        Args:
            uri: Document URI
            ast: List of top-level AST nodes
        """
        # Remove existing entries for this document first
        self._remove_document_entries(uri)
        
        # Index new symbols
        for node in ast:
            self._index_node(uri, node)
    
    def _remove_document_entries(self, uri: str):
        """Remove all entries from a specific document."""
        # Remove namespaces from this document
        self.namespaces = {k: v for k, v in self.namespaces.items() if v != uri}
        
        # Remove events from this document
        self.events = {k: v for k, v in self.events.items() if v.uri != uri}
        
        # Remove scripted effects from this document
        self.scripted_effects = {k: v for k, v in self.scripted_effects.items() if v.uri != uri}
        
        # Remove scripted triggers from this document
        self.scripted_triggers = {k: v for k, v in self.scripted_triggers.items() if v.uri != uri}
        
        # Remove scripted lists from this document
        self.scripted_lists = {k: v for k, v in self.scripted_lists.items() if v.uri != uri}
        
        # Remove script values from this document
        self.script_values = {k: v for k, v in self.script_values.items() if v.uri != uri}
        
        # Remove saved scopes from this document
        self.saved_scopes = {k: v for k, v in self.saved_scopes.items() if v.uri != uri}
    
    def _index_node(self, uri: str, node: CK3Node):
        """
        Index a single node and its children.
        
        Args:
            uri: Document URI
            node: AST node to index
        """
        # Index namespaces
        if node.type == 'namespace':
            if node.value:
                self.namespaces[node.value] = uri
                logger.debug(f"Indexed namespace: {node.value} in {uri}")
        
        # Index events (identified by type == 'event')
        elif node.type == 'event':
            location = types.Location(uri=uri, range=node.range)
            self.events[node.key] = location
            logger.debug(f"Indexed event: {node.key} in {uri}")
        
        # Index saved scopes
        if node.key == 'save_scope_as' or node.key == 'save_temporary_scope_as':
            if node.value:
                location = types.Location(uri=uri, range=node.range)
                self.saved_scopes[node.value] = location
                logger.debug(f"Indexed saved scope: {node.value} in {uri}")
        
        # Recursively index children
        for child in node.children:
            self._index_node(uri, child)
    
    def remove_document(self, uri: str):
        """
        Remove all symbols from a document when it's closed.
        
        Args:
            uri: Document URI to remove
        """
        self._remove_document_entries(uri)
        logger.info(f"Removed index entries for {uri}")
    
    def find_event(self, event_id: str) -> Optional[types.Location]:
        """
        Find the location of an event definition.
        
        Args:
            event_id: Event identifier (e.g., 'my_mod.0001')
            
        Returns:
            Location of the event definition, or None if not found
        """
        return self.events.get(event_id)
    
    def find_saved_scope(self, scope_name: str) -> Optional[types.Location]:
        """
        Find the location where a scope was saved.
        
        Args:
            scope_name: Saved scope name (without 'scope:' prefix)
            
        Returns:
            Location where the scope was saved, or None if not found
        """
        return self.saved_scopes.get(scope_name)
    
    def get_all_events(self) -> List[str]:
        """
        Get all indexed event IDs.
        
        Returns:
            List of event identifiers
        """
        return list(self.events.keys())
    
    def get_all_namespaces(self) -> List[str]:
        """
        Get all indexed namespaces.
        
        Returns:
            List of namespace names
        """
        return list(self.namespaces.keys())
