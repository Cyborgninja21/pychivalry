# CK3 Language Server Development Guide

This document outlines the roadmap and architecture for building a Language Server for Crusader Kings 3 (CK3) script files using the pygls framework.

---

## Overview

Crusader Kings 3 uses a proprietary scripting language (Paradox Script) for its game data files. A Language Server will provide IDE features like autocompletion, error checking, and documentation for CK3 modders.

---

## CK3 File Types

### Script Files (`.txt`)

Located in various directories under `game/` and mod folders:

| Directory | Purpose |
|-----------|---------|
| `common/` | Game definitions (characters, dynasties, cultures, religions, etc.) |
| `events/` | Event scripts |
| `decisions/` | Decision scripts |
| `history/` | Historical data |
| `localization/` | Text strings (`.yml`) |
| `gfx/` | Graphics references |
| `gui/` | UI definitions (`.gui`) |

### Paradox Script Syntax

```
# Comment

namespace = my_namespace

my_trigger = {
    age >= 16
    is_alive = yes
    culture = culture:english
}

my_event = {
    type = character_event
    title = my_event.title
    desc = my_event.desc
    
    option = {
        name = my_event.option.a
        trigger = {
            my_trigger = yes
        }
        effect = {
            add_gold = 100
        }
    }
}
```

---

## Architecture

### Component Structure

```
pychivalry/
├── pygls/                    # Base LSP framework (already included)
├── ck3_ls/                   # CK3-specific implementation
│   ├── __init__.py
│   ├── server.py            # CK3LanguageServer class
│   ├── parser/              # Paradox script parser
│   │   ├── __init__.py
│   │   ├── lexer.py         # Tokenizer
│   │   ├── parser.py        # AST builder
│   │   └── ast.py           # AST node definitions
│   ├── analyzer/            # Semantic analysis
│   │   ├── __init__.py
│   │   ├── validator.py     # Syntax validation
│   │   └── resolver.py      # Reference resolution
│   ├── providers/           # LSP feature providers
│   │   ├── __init__.py
│   │   ├── completion.py    # Autocompletion
│   │   ├── diagnostics.py   # Error reporting
│   │   ├── hover.py         # Hover information
│   │   ├── definition.py    # Go to definition
│   │   └── symbols.py       # Document symbols
│   └── data/                # CK3 game data
│       ├── __init__.py
│       ├── triggers.py      # Built-in triggers
│       ├── effects.py       # Built-in effects
│       ├── scopes.py        # Scope definitions
│       └── schemas.py       # File type schemas
└── docs/                    # Documentation
```

---

## Implementation Plan

### Phase 1: Basic Server Setup

1. **Create server skeleton:**

```python
# ck3_ls/server.py
from pygls.lsp.server import LanguageServer
from lsprotocol import types

class CK3LanguageServer(LanguageServer):
    def __init__(self):
        super().__init__(
            name="ck3-language-server",
            version="0.1.0"
        )
        self.parser = CK3Parser()
        self.game_data = CK3GameData()

server = CK3LanguageServer()
```

2. **Register file patterns:**
   - `.txt` files (scripts)
   - `.gui` files (UI)
   - `.yml` files (localization)

### Phase 2: Parser Implementation

1. **Lexer (Tokenizer):**

```python
# ck3_ls/parser/lexer.py
from enum import Enum, auto

class TokenType(Enum):
    IDENTIFIER = auto()
    STRING = auto()
    NUMBER = auto()
    EQUALS = auto()
    LBRACE = auto()
    RBRACE = auto()
    OPERATOR = auto()
    COMMENT = auto()

class Token:
    def __init__(self, type, value, line, column):
        self.type = type
        self.value = value
        self.line = line
        self.column = column

class CK3Lexer:
    def tokenize(self, source: str) -> list[Token]:
        # Implementation
        pass
```

2. **Parser (AST Builder):**

```python
# ck3_ls/parser/parser.py
from .lexer import CK3Lexer
from .ast import *

class CK3Parser:
    def parse(self, source: str) -> Document:
        tokens = CK3Lexer().tokenize(source)
        return self._parse_document(tokens)
    
    def _parse_block(self, tokens) -> Block:
        # Implementation
        pass
```

3. **AST Nodes:**

```python
# ck3_ls/parser/ast.py
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class Node:
    line: int
    column: int

@dataclass
class Document(Node):
    statements: List['Statement']

@dataclass
class Assignment(Node):
    key: str
    value: 'Value'

@dataclass
class Block(Node):
    key: str
    children: List['Statement']

@dataclass
class Value(Node):
    pass

@dataclass
class StringValue(Value):
    value: str

@dataclass
class NumberValue(Value):
    value: float

@dataclass
class Reference(Value):
    scope: Optional[str]
    name: str
```

### Phase 3: LSP Feature Implementation

#### 3.1 Diagnostics (Error Checking)

```python
# ck3_ls/providers/diagnostics.py
from lsprotocol import types
from pygls.lsp.server import LanguageServer

def validate_document(server: LanguageServer, uri: str):
    document = server.workspace.get_text_document(uri)
    diagnostics = []
    
    try:
        ast = server.parser.parse(document.source)
        # Validate AST against schemas
        diagnostics.extend(validate_ast(ast))
    except ParseError as e:
        diagnostics.append(types.Diagnostic(
            range=types.Range(
                start=types.Position(e.line, e.column),
                end=types.Position(e.line, e.column + 1)
            ),
            message=str(e),
            severity=types.DiagnosticSeverity.Error
        ))
    
    server.publish_diagnostics(uri, diagnostics)
```

#### 3.2 Completion

```python
# ck3_ls/providers/completion.py
from lsprotocol import types

@server.feature(types.TEXT_DOCUMENT_COMPLETION)
def completions(params: types.CompletionParams):
    items = []
    document = server.workspace.get_text_document(params.text_document.uri)
    
    # Context-aware completion
    context = analyze_context(document, params.position)
    
    if context.expects_trigger:
        items.extend(get_trigger_completions())
    elif context.expects_effect:
        items.extend(get_effect_completions())
    elif context.expects_scope:
        items.extend(get_scope_completions())
    
    return types.CompletionList(is_incomplete=False, items=items)
```

#### 3.3 Hover Information

```python
# ck3_ls/providers/hover.py
from lsprotocol import types

@server.feature(types.TEXT_DOCUMENT_HOVER)
def hover(params: types.HoverParams):
    document = server.workspace.get_text_document(params.text_document.uri)
    word = document.word_at_position(params.position)
    
    if info := get_game_data_info(word):
        return types.Hover(
            contents=types.MarkupContent(
                kind=types.MarkupKind.Markdown,
                value=format_documentation(info)
            )
        )
    
    return None
```

#### 3.4 Go to Definition

```python
# ck3_ls/providers/definition.py
from lsprotocol import types

@server.feature(types.TEXT_DOCUMENT_DEFINITION)
def definition(params: types.DefinitionParams):
    document = server.workspace.get_text_document(params.text_document.uri)
    word = document.word_at_position(params.position)
    
    if location := find_definition(word, server.workspace):
        return types.Location(
            uri=location.uri,
            range=location.range
        )
    
    return None
```

#### 3.5 Document Symbols

```python
# ck3_ls/providers/symbols.py
from lsprotocol import types

@server.feature(types.TEXT_DOCUMENT_DOCUMENT_SYMBOL)
def document_symbols(params: types.DocumentSymbolParams):
    document = server.workspace.get_text_document(params.text_document.uri)
    ast = server.parser.parse(document.source)
    
    symbols = []
    for node in ast.statements:
        if isinstance(node, Block):
            symbols.append(types.DocumentSymbol(
                name=node.key,
                kind=types.SymbolKind.Class,
                range=node_to_range(node),
                selection_range=node_to_range(node.key_node),
                children=get_child_symbols(node)
            ))
    
    return symbols
```

### Phase 4: CK3 Game Data

#### 4.1 Trigger Database

```python
# ck3_ls/data/triggers.py
TRIGGERS = {
    "age": {
        "description": "Check character's age",
        "scopes": ["character"],
        "parameters": {"type": "integer", "comparison": True}
    },
    "is_alive": {
        "description": "Check if character is alive",
        "scopes": ["character"],
        "parameters": {"type": "boolean"}
    },
    "culture": {
        "description": "Check character's culture",
        "scopes": ["character"],
        "parameters": {"type": "culture_reference"}
    },
    # ... more triggers
}
```

#### 4.2 Effect Database

```python
# ck3_ls/data/effects.py
EFFECTS = {
    "add_gold": {
        "description": "Add gold to character",
        "scopes": ["character"],
        "parameters": {"type": "integer"}
    },
    "set_culture": {
        "description": "Change character's culture",
        "scopes": ["character"],
        "parameters": {"type": "culture_reference"}
    },
    # ... more effects
}
```

#### 4.3 Scope System

```python
# ck3_ls/data/scopes.py
SCOPES = {
    "root": {
        "description": "The root scope (event target)",
        "transitions": ["character", "title", "province"]
    },
    "character": {
        "description": "A character scope",
        "transitions": [
            "liege", "ruler", "primary_title", "capital_province",
            "mother", "father", "spouse", "primary_heir"
        ]
    },
    "title": {
        "description": "A landed title scope",
        "transitions": ["holder", "capital_province", "de_jure_liege"]
    },
    # ... more scopes
}
```

---

## VS Code Extension

### Extension Structure

```
vscode-ck3-ls/
├── package.json            # Extension manifest
├── src/
│   └── extension.ts        # Extension entry point
├── language-configuration.json
└── syntaxes/
    └── ck3.tmLanguage.json # Syntax highlighting
```

### package.json

```json
{
    "name": "vscode-ck3-ls",
    "displayName": "CK3 Language Support",
    "description": "Language support for Crusader Kings 3 modding",
    "version": "0.1.0",
    "engines": {
        "vscode": "^1.75.0"
    },
    "categories": ["Programming Languages"],
    "activationEvents": [
        "onLanguage:ck3"
    ],
    "contributes": {
        "languages": [{
            "id": "ck3",
            "aliases": ["CK3 Script", "ck3"],
            "extensions": [".txt", ".gui"],
            "configuration": "./language-configuration.json"
        }],
        "grammars": [{
            "language": "ck3",
            "scopeName": "source.ck3",
            "path": "./syntaxes/ck3.tmLanguage.json"
        }]
    },
    "main": "./out/extension.js",
    "dependencies": {
        "vscode-languageclient": "^9.0.0"
    }
}
```

### Extension Entry Point

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    const serverOptions: ServerOptions = {
        command: 'python',
        args: ['-m', 'ck3_ls'],
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'ck3' },
        ],
    };

    client = new LanguageClient(
        'ck3-language-server',
        'CK3 Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
```

---

## Testing Strategy

### Unit Tests

```python
# tests/test_parser.py
import pytest
from ck3_ls.parser import CK3Parser

def test_parse_simple_assignment():
    source = "name = value"
    ast = CK3Parser().parse(source)
    assert len(ast.statements) == 1
    assert ast.statements[0].key == "name"

def test_parse_block():
    source = """
    my_event = {
        type = character_event
        title = my_event.title
    }
    """
    ast = CK3Parser().parse(source)
    assert len(ast.statements) == 1
    assert len(ast.statements[0].children) == 2
```

### Integration Tests

```python
# tests/test_server.py
import pytest
from pygls.lsp.client import LanguageClient

@pytest.fixture
async def client():
    client = LanguageClient()
    await client.start_io("python", "-m", "ck3_ls")
    yield client
    await client.stop()

async def test_completion(client):
    # Test completion feature
    pass

async def test_diagnostics(client):
    # Test diagnostics feature
    pass
```

---

## Roadmap

### Version 0.1.0
- [ ] Basic parser for Paradox script
- [ ] Syntax error diagnostics
- [ ] Basic completion for keywords

### Version 0.2.0
- [ ] Full trigger/effect database
- [ ] Scope-aware completion
- [ ] Hover documentation

### Version 0.3.0
- [ ] Go to definition
- [ ] Find references
- [ ] Document symbols

### Version 0.4.0
- [ ] Cross-file analysis
- [ ] Localization support
- [ ] GUI file support

### Version 1.0.0
- [ ] Full game data integration
- [ ] Mod validation
- [ ] Performance optimization

---

## Resources

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [pygls Documentation](https://pygls.readthedocs.io/)
- [CK3 Wiki - Modding](https://ck3.paradoxwikis.com/Modding)
- [lsprotocol Types](https://github.com/microsoft/lsprotocol)
