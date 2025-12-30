# Parser Module (parser.py)

## Purpose

The parser module is the foundation of the pychivalry Language Server. It handles parsing CK3 script files into an Abstract Syntax Tree (AST) with full position tracking for LSP operations.

## Key Classes

### CK3Node
Represents a node in the Abstract Syntax Tree.

```python
@dataclass
class CK3Node:
    type: str              # Node type: 'block', 'assignment', 'value', 'list'
    value: Any             # Node value (string, number, list, dict)
    range: Range           # LSP Range for this node
    children: List['CK3Node'] = field(default_factory=list)
    parent: Optional['CK3Node'] = None
```

**Node Types:**
- `block`: Code blocks with `{ }` braces
- `assignment`: Key-value pairs (`key = value`)
- `value`: Simple values (strings, numbers, identifiers)
- `list`: Lists of values

### Token
Represents a lexical token from the tokenizer.

```python
@dataclass
class Token:
    type: str       # Token type: 'identifier', 'number', 'string', 'operator', etc.
    value: str      # Token text
    line: int       # Line number (0-indexed)
    column: int     # Column number (0-indexed)
```

## Key Functions

### tokenize(text: str) -> List[Token]
Converts script text into tokens with position tracking.

**Example:**
```python
text = "gold = 100"
tokens = tokenize(text)
# [Token(type='identifier', value='gold', line=0, column=0),
#  Token(type='operator', value='=', line=0, column=5),
#  Token(type='number', value='100', line=0, column=7)]
```

### parse_document(text: str) -> CK3Node
Parses CK3 script text into an AST.

**Example:**
```python
text = """
namespace = my_mod

my_event = {
    type = character_event
    title = my_event.t
}
"""
ast = parse_document(text)
# Returns root CK3Node with hierarchical structure
```

### get_node_at_position(node: CK3Node, line: int, column: int) -> Optional[CK3Node]
Finds the AST node at a specific cursor position.

**Example:**
```python
# Cursor at line 4, column 10 (on "character_event")
node = get_node_at_position(ast, 4, 10)
# Returns the CK3Node for "character_event" value
```

### find_parent_block(node: CK3Node, block_name: str) -> Optional[CK3Node]
Finds the nearest parent block with a specific name.

**Example:**
```python
# Find the enclosing 'trigger' block
trigger_block = find_parent_block(current_node, 'trigger')
```

### get_block_contents(node: CK3Node) -> Dict[str, Any]
Extracts contents of a block node as a dictionary.

**Example:**
```python
event_node = # ... node for an event block
contents = get_block_contents(event_node)
# {'type': 'character_event', 'title': 'my_event.t', ...}
```

## Features

### Error Recovery
The parser continues parsing even after encountering errors, allowing diagnostics for the entire file.

### Position Tracking
Every node has a `Range` with start/end positions for:
- Diagnostics
- Hover information
- Code navigation
- Syntax highlighting

### Nested Structure Handling
Properly handles deeply nested blocks:
```
event {
    trigger {
        any_vassal {
            limit {
                gold > 100
            }
        }
    }
}
```

### Comments
Preserves comments for documentation:
```python
# Single-line comment
/* Multi-line
   comment */
```

## Data Structures

### Range
LSP position range:
```python
@dataclass
class Range:
    start: Position  # Start position
    end: Position    # End position
```

### Position
LSP position:
```python
@dataclass
class Position:
    line: int     # 0-indexed line number
    character: int  # 0-indexed column number
```

## Integration

The parser module integrates with:

- **diagnostics.py**: Validates the AST
- **completions.py**: Uses AST for context detection
- **hover.py**: Looks up node information
- **navigation.py**: Finds definition locations
- **symbols.py**: Extracts document structure
- **indexer.py**: Indexes parsed documents

## Usage Example

```python
from pychivalry.parser import parse_document, get_node_at_position

# Parse a CK3 script file
with open('events/my_events.txt', 'r') as f:
    text = f.read()

# Create AST
ast = parse_document(text)

# Find node at cursor position (line 10, column 15)
node = get_node_at_position(ast, 10, 15)

if node:
    print(f"Node type: {node.type}")
    print(f"Node value: {node.value}")
    print(f"Range: {node.range}")
```

## Performance

- **Fast parsing**: <10ms for typical event files
- **Incremental updates**: Only reparse changed sections
- **Memory efficient**: Minimal AST overhead

## Test Coverage

35 comprehensive tests covering:
- Tokenization of all CK3 constructs
- AST generation for nested blocks
- Position tracking accuracy
- Error recovery behavior
- Edge cases (empty files, malformed syntax)
