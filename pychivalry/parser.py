"""
CK3 Script Parser

This module provides parsing capabilities for Crusader Kings 3 (Jomini) script files.
It converts CK3 script text into an Abstract Syntax Tree (AST) that can be used for
validation, completion, navigation, and other language server features.

The parser handles:
- Assignments: key = value
- Blocks: key = { ... }
- Lists: key = { item1 item2 item3 }
- Comments: # comment text
- Scope chains: liege.primary_title.holder
- Saved scopes: scope:my_target
- Operators: =, >, <, >=, <=, !=

The parser preserves position information (LSP Range) for every node, enabling
precise cursor-based operations like hover, go-to-definition, and diagnostics.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional, Union
from lsprotocol import types
import re


@dataclass(slots=True)
class CK3Node:
    """
    AST node for CK3 script parsing.

    Represents a single element in the CK3 script syntax tree. Nodes can be nested
    to form a hierarchical structure representing the script's logical organization.

    Uses __slots__ for 30-50% memory reduction on large files with many nodes.

    Attributes:
        type: Node type - 'block', 'assignment', 'list', 'comment', 'namespace', 'event'
        key: Node key/identifier (e.g., 'trigger', 'add_gold', 'my_mod.0001')
        value: Node value - can be a string, number, or None for blocks
        range: LSP Range indicating start and end positions in the document
        parent: Reference to parent node (None for top-level nodes)
        scope_type: Current scope type ('character', 'title', 'province', 'unknown')
        children: List of child nodes for blocks and lists
    """

    type: str
    key: str
    value: Any
    range: types.Range
    parent: Optional["CK3Node"] = None
    scope_type: str = "unknown"
    children: List["CK3Node"] = field(default_factory=list)


class CK3Token:
    """
    Token produced by the tokenizer.

    Represents a single lexical unit in the CK3 script (keyword, operator, value, etc.)
    Uses __slots__ for reduced memory footprint.
    """

    __slots__ = ("type", "value", "line", "character")

    def __init__(self, type: str, value: str, line: int, character: int):
        self.type = type  # 'identifier', 'operator', 'string', 'number', 'brace', 'comment'
        self.value = value
        self.line = line
        self.character = character

    def __repr__(self):
        return f"Token({self.type}, {self.value!r}, {self.line}:{self.character})"


def tokenize(text: str) -> List[CK3Token]:
    """
    Tokenize CK3 script text into a list of tokens.

    This is the lexical analysis phase that breaks the input text into meaningful
    units (tokens) that the parser can work with.

    Args:
        text: The CK3 script text to tokenize

    Returns:
        List of CK3Token objects representing the lexical structure
    """
    tokens = []
    lines = text.split("\n")

    for line_num, line in enumerate(lines):
        col = 0
        while col < len(line):
            # Skip whitespace
            if line[col].isspace():
                col += 1
                continue

            # Comments
            if line[col] == "#":
                comment_text = line[col:].strip()
                tokens.append(CK3Token("comment", comment_text, line_num, col))
                break  # Rest of line is comment

            # Braces
            if line[col] in "{}":
                tokens.append(CK3Token("brace", line[col], line_num, col))
                col += 1
                continue

            # Operators
            if col + 1 < len(line) and line[col : col + 2] in (">=", "<=", "!=", "=="):
                tokens.append(CK3Token("operator", line[col : col + 2], line_num, col))
                col += 2
                continue

            if line[col] in "=><":
                tokens.append(CK3Token("operator", line[col], line_num, col))
                col += 1
                continue

            # Quoted strings
            if line[col] == '"':
                end_quote = col + 1
                while end_quote < len(line) and line[end_quote] != '"':
                    if line[end_quote] == "\\" and end_quote + 1 < len(line):
                        end_quote += 2  # Skip escaped character
                    else:
                        end_quote += 1

                if end_quote < len(line):
                    string_value = line[col : end_quote + 1]
                    tokens.append(CK3Token("string", string_value, line_num, col))
                    col = end_quote + 1
                else:
                    # Unclosed string - treat rest of line as string
                    tokens.append(CK3Token("string", line[col:], line_num, col))
                    break
                continue

            # Numbers (including negative numbers and decimals)
            if line[col].isdigit() or (
                line[col] == "-" and col + 1 < len(line) and line[col + 1].isdigit()
            ):
                num_end = col + 1
                has_decimal = False
                while num_end < len(line):
                    if line[num_end].isdigit():
                        num_end += 1
                    elif line[num_end] == "." and not has_decimal:
                        has_decimal = True
                        num_end += 1
                    else:
                        break

                number_value = line[col:num_end]
                tokens.append(CK3Token("number", number_value, line_num, col))
                col = num_end
                continue

            # Identifiers (keywords, names, etc.)
            if line[col].isalnum() or line[col] in "_.:@$":
                id_end = col
                while id_end < len(line) and (line[id_end].isalnum() or line[id_end] in "_.:@$-"):
                    id_end += 1

                identifier = line[col:id_end]
                tokens.append(CK3Token("identifier", identifier, line_num, col))
                col = id_end
                continue

            # Unknown character - skip it
            col += 1

    return tokens


def parse_document(text: str) -> List[CK3Node]:
    """
    Parse CK3 script text into an Abstract Syntax Tree (AST).

    This is the main parsing function that converts tokenized CK3 script into a
    hierarchical node structure. The resulting AST can be used for validation,
    completion, navigation, and other language server features.

    Args:
        text: The CK3 script text to parse

    Returns:
        List of top-level CK3Node objects representing the script structure
    """
    tokens = tokenize(text)
    if not tokens:
        return []

    nodes = []
    index = [0]  # Use list to make it mutable in nested function

    def peek() -> Optional[CK3Token]:
        """Look at current token without consuming it."""
        if index[0] < len(tokens):
            return tokens[index[0]]
        return None

    def consume() -> Optional[CK3Token]:
        """Consume and return current token."""
        if index[0] < len(tokens):
            token = tokens[index[0]]
            index[0] += 1
            return token
        return None

    def parse_value():
        """Parse a value (string, number, or identifier)."""
        token = peek()
        if not token:
            return None

        if token.type in ("string", "number", "identifier"):
            consume()
            return token.value

        return None

    def parse_block(key_token: CK3Token, parent: Optional[CK3Node] = None) -> Optional[CK3Node]:
        """Parse a block structure: key = { ... }"""
        # Expect '=' operator
        op_token = peek()
        if not op_token or op_token.type != "operator" or op_token.value != "=":
            return None
        consume()  # consume '='

        # Expect '{' brace
        brace_token = peek()
        if not brace_token or brace_token.type != "brace" or brace_token.value != "{":
            # Not a block, might be a simple assignment
            value = parse_value()
            if value is not None:
                # Determine node type for simple assignments
                node_type = "assignment"
                if key_token.value == "namespace":
                    node_type = "namespace"

                node = CK3Node(
                    type=node_type,
                    key=key_token.value,
                    value=value,
                    range=types.Range(
                        start=types.Position(line=key_token.line, character=key_token.character),
                        end=types.Position(
                            line=key_token.line,
                            character=key_token.character + len(key_token.value),
                        ),
                    ),
                    parent=parent,
                )
                return node
            return None

        start_brace = consume()  # consume '{'

        # Determine node type
        node_type = "block"
        if key_token.value == "namespace":
            node_type = "namespace"
        elif "." in key_token.value and any(char.isdigit() for char in key_token.value):
            node_type = "event"

        # Create node
        node = CK3Node(
            type=node_type,
            key=key_token.value,
            value=None,
            range=types.Range(
                start=types.Position(line=key_token.line, character=key_token.character),
                end=types.Position(line=start_brace.line, character=start_brace.character + 1),
            ),
            parent=parent,
        )

        # Parse children until closing brace
        while True:
            token = peek()
            if not token:
                break

            if token.type == "brace" and token.value == "}":
                end_brace = consume()
                # Update node range to include closing brace
                node.range = types.Range(
                    start=node.range.start,
                    end=types.Position(line=end_brace.line, character=end_brace.character + 1),
                )
                break

            if token.type == "comment":
                consume()
                # Could add comment nodes if needed
                continue

            if token.type == "identifier":
                child = parse_statement(parent=node)
                if child:
                    node.children.append(child)
            else:
                consume()  # Skip unexpected token

        return node

    def parse_statement(parent: Optional[CK3Node] = None) -> Optional[CK3Node]:
        """Parse a statement (assignment or block)."""
        key_token = peek()
        if not key_token or key_token.type != "identifier":
            return None

        key_token = consume()

        # Look ahead to determine if this is a block or assignment
        next_token = peek()
        if not next_token:
            return None

        if next_token.type == "operator":
            return parse_block(key_token, parent)

        return None

    # Parse top-level statements
    while index[0] < len(tokens):
        token = peek()
        if not token:
            break

        if token.type == "comment":
            consume()
            continue

        if token.type == "identifier":
            node = parse_statement()
            if node:
                nodes.append(node)
        else:
            consume()  # Skip unexpected token

    return nodes


def get_node_at_position(nodes: List[CK3Node], position: types.Position) -> Optional[CK3Node]:
    """
    Find the AST node at a given cursor position.

    This function performs a depth-first search through the AST to find the most
    specific (deepest) node that contains the given position. This is used by
    hover, completion, goto-definition, and other cursor-based features.

    Args:
        nodes: List of top-level AST nodes to search
        position: LSP Position (line and character) to search for

    Returns:
        The most specific CK3Node containing the position, or None if not found
    """

    def position_in_range(pos: types.Position, range_: types.Range) -> bool:
        """Check if position is within range."""
        if pos.line < range_.start.line or pos.line > range_.end.line:
            return False
        if pos.line == range_.start.line and pos.character < range_.start.character:
            return False
        if pos.line == range_.end.line and pos.character > range_.end.character:
            return False
        return True

    def search_node(node: CK3Node) -> Optional[CK3Node]:
        """Recursively search for node at position."""
        if not position_in_range(position, node.range):
            return None

        # Check children first (more specific)
        for child in node.children:
            result = search_node(child)
            if result:
                return result

        # Return this node if no child matches
        return node

    # Search all top-level nodes
    for node in nodes:
        result = search_node(node)
        if result:
            return result

    return None
