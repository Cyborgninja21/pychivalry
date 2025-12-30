# How To Interpret Semantic Tokens

## Overview

Semantic tokens provide semantic highlighting for code, offering more detailed syntax highlighting than traditional TextMate grammars. This guide explains how to interpret semantic token data from the Language Server Protocol.

## Semantic Token Format

Semantic tokens are encoded as an array of integers in a compact format. Each token is represented by 5 integers:

1. **Delta Line**: Line offset from the previous token (0 for same line)
2. **Delta Start**: Character offset from previous token (or from line start if delta line > 0)
3. **Length**: Length of the token
4. **Token Type**: Index into the token types array
5. **Token Modifiers**: Bit flags for token modifiers

## Token Types

Standard token types include:

- `namespace`
- `type` / `class` / `enum` / `interface` / `struct` / `typeParameter`
- `parameter` / `variable` / `property` / `enumMember`
- `event` / `function` / `method` / `macro`
- `keyword` / `modifier` / `comment` / `string` / `number` / `regexp` / `operator`

## Token Modifiers

Standard token modifiers include:

- `declaration`: Definition of a symbol
- `definition`: Reference to a definition
- `readonly`: Read-only access
- `static`: Static member
- `deprecated`: Deprecated symbol
- `abstract`: Abstract member
- `async`: Async function
- `modification`: Modified variable
- `documentation`: Documentation comment
- `defaultLibrary`: From default library

## Decoding Example

Given semantic tokens data: `[0, 5, 6, 1, 0]`

- Delta Line: 0 (same line as previous)
- Delta Start: 5 (starts at column 5)
- Length: 6 (token is 6 characters long)
- Token Type: 1 (e.g., "class" if that's index 1)
- Token Modifiers: 0 (no modifiers)

## Python Implementation

```python
def decode_semantic_tokens(data: list[int], token_types: list[str], token_modifiers: list[str]):
    '''Decode semantic tokens data.'''
    tokens = []
    line = 0
    start = 0
    
    for i in range(0, len(data), 5):
        delta_line = data[i]
        delta_start = data[i + 1]
        length = data[i + 2]
        token_type_idx = data[i + 3]
        token_modifiers_bits = data[i + 4]
        
        # Update position
        line += delta_line
        if delta_line > 0:
            start = delta_start
        else:
            start += delta_start
        
        # Get token type
        token_type = token_types[token_type_idx] if token_type_idx < len(token_types) else 'unknown'
        
        # Decode modifiers
        modifiers = []
        for j, modifier in enumerate(token_modifiers):
            if token_modifiers_bits & (1 << j):
                modifiers.append(modifier)
        
        tokens.append({
            'line': line,
            'start': start,
            'length': length,
            'type': token_type,
            'modifiers': modifiers
        })
    
    return tokens
```

## Server Registration

```python
from lsprotocol.types import (
    SemanticTokensLegend,
    SemanticTokensParams,
    SemanticTokens,
    TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL
)

# Define token types and modifiers
TOKEN_TYPES = ['keyword', 'class', 'function', 'variable', 'string', 'number']
TOKEN_MODIFIERS = ['declaration', 'readonly', 'static']

# Register capabilities
server.server_capabilities.semantic_tokens_provider = SemanticTokensLegend(
    token_types=TOKEN_TYPES,
    token_modifiers=TOKEN_MODIFIERS
)

@server.feature(TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL)
def semantic_tokens_full(params: SemanticTokensParams):
    # Tokenize document and build data array
    data = []
    # ... tokenization logic
    return SemanticTokens(data=data)
```

## Best Practices

1. **Cache Tokens**: Cache token data for performance
2. **Incremental Updates**: Use range or delta updates when possible
3. **Consistent Types**: Use standard token types when applicable
4. **Performance**: Tokenization should be fast (<100ms for typical files)
5. **Testing**: Test with various code samples to ensure accuracy
