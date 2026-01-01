# pygls Semantic Tokens Example

> Source: https://pygls.readthedocs.io/en/latest/servers/examples/semantic-tokens.html

## Overview

This implements the various semantic token requests from the LSP specification.

Tokens are sent to the client as a long list of numbers, where each group of 5 numbers describes a single token:

1. **Line number** (relative to previous token)
2. **Character index** (relative to previous token on same line, or absolute if different line)
3. **Token length**
4. **Token type** (index into token types array)
5. **Token modifiers** (bitmask of modifiers)

## Complete Code Example

```python
import enum
import logging
import operator
import re
from functools import reduce
from typing import Dict
from typing import List
from typing import Optional

import attrs
from lsprotocol import types

from pygls.cli import start_server
from pygls.lsp.server import LanguageServer
from pygls.workspace import TextDocument


class TokenModifier(enum.IntFlag):
    deprecated = enum.auto()
    readonly = enum.auto()
    defaultLibrary = enum.auto()
    definition = enum.auto()


@attrs.define
class Token:
    line: int
    offset: int
    text: str

    tok_type: str = ""
    tok_modifiers: List[TokenModifier] = attrs.field(factory=list)


TokenTypes = ["keyword", "variable", "function", "operator", "parameter", "type"]

SYMBOL = re.compile(r"\w+")
OP = re.compile(r"->|[\{\}\(\)\.,+:*-=]")
SPACE = re.compile(r"\s+")

KEYWORDS = {"type", "fn"}


def is_type(token: Optional[Token]) -> bool:
    if token is None:
        return False
    return token.text == "type" and token.tok_type == "keyword"


def is_fn(token: Optional[Token]) -> bool:
    if token is None:
        return False
    return token.text == "fn" and token.tok_type == "keyword"


def is_lparen(token: Optional[Token]) -> bool:
    if token is None:
        return False
    return token.text == "(" and token.tok_type == "operator"


def is_rparen(token: Optional[Token]) -> bool:
    if token is None:
        return False
    return token.text == ")" and token.tok_type == "operator"


def is_lbrace(token: Optional[Token]) -> bool:
    if token is None:
        return False
    return token.text == "{" and token.tok_type == "operator"


def is_rbrace(token: Optional[Token]) -> bool:
    if token is None:
        return False
    return token.text == "}" and token.tok_type == "operator"


def is_colon(token: Optional[Token]) -> bool:
    if token is None:
        return False
    return token.text == ":" and token.tok_type == "operator"


class SemanticTokensServer(LanguageServer):
    """Language server demonstrating the semantic token methods from the LSP
    specification."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tokens: Dict[str, List[Token]] = {}

    def parse(self, doc: TextDocument):
        """Convert the given document into a list of tokens"""
        tokens = self.lex(doc)
        self.classify_tokens(tokens)
        self.tokens[doc.uri] = tokens

    def classify_tokens(self, tokens: List[Token]):
        """Given a list of tokens, determine their type and modifiers."""

        def prev(idx):
            if idx < 0:
                return None
            return tokens[idx - 1]

        def next(idx):
            if idx >= len(tokens) - 1:
                return None
            return tokens[idx + 1]

        in_brace = False
        in_paren = False

        for idx, token in enumerate(tokens):
            if token.tok_type == "operator":
                if is_lparen(token):
                    in_paren = True
                elif is_rparen(token):
                    in_paren = False
                elif is_lbrace(token):
                    in_brace = True
                elif is_rbrace(token):
                    in_brace = False
                continue

            if token.text in KEYWORDS:
                token.tok_type = "keyword"

            elif token.text[0].isupper():
                token.tok_type = "type"
                if is_type(prev(idx)):
                    token.tok_modifiers.append(TokenModifier.definition)

            elif is_fn(prev(idx)) or is_lparen(next(idx)):
                token.tok_type = "function"
                token.tok_modifiers.append(TokenModifier.definition)

            elif is_colon(next(idx)) and in_brace:
                token.tok_type = "parameter"

            elif is_colon(prev(idx)) and in_paren:
                token.tok_type = "type"
                token.tok_modifiers.append(TokenModifier.defaultLibrary)

            else:
                token.tok_type = "variable"

    def lex(self, doc: TextDocument) -> List[Token]:
        """Convert the given document into a list of tokens"""
        tokens = []

        prev_line = 0
        prev_offset = 0

        for current_line, line in enumerate(doc.lines):
            prev_offset = current_offset = 0
            chars_left = len(line)

            while line:
                if (match := SPACE.match(line)) is not None:
                    current_offset += len(match.group(0))
                    line = line[match.end():]

                elif (match := SYMBOL.match(line)) is not None:
                    tokens.append(
                        Token(
                            line=current_line - prev_line,
                            offset=current_offset - prev_offset,
                            text=match.group(0),
                        )
                    )
                    line = line[match.end():]
                    prev_offset = current_offset
                    prev_line = current_line
                    current_offset += len(match.group(0))

                elif (match := OP.match(line)) is not None:
                    tokens.append(
                        Token(
                            line=current_line - prev_line,
                            offset=current_offset - prev_offset,
                            text=match.group(0),
                            tok_type="operator",
                        )
                    )
                    line = line[match.end():]
                    prev_offset = current_offset
                    prev_line = current_line
                    current_offset += len(match.group(0))

                else:
                    raise RuntimeError(f"No match: {line!r}")

                if (n := len(line)) == chars_left:
                    raise RuntimeError("Infinite loop detected")
                else:
                    chars_left = n

        return tokens


server = SemanticTokensServer("semantic-tokens-server", "v1")


@server.feature(types.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: SemanticTokensServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is opened"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(types.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: SemanticTokensServer, params: types.DidOpenTextDocumentParams):
    """Parse each document when it is changed"""
    doc = ls.workspace.get_text_document(params.text_document.uri)
    ls.parse(doc)


@server.feature(
    types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL,
    types.SemanticTokensLegend(
        token_types=TokenTypes,
        token_modifiers=[m.name for m in TokenModifier],
    ),
)
def semantic_tokens_full(ls: SemanticTokensServer, params: types.SemanticTokensParams):
    """Return the semantic tokens for the entire document"""
    data = []
    tokens = ls.tokens.get(params.text_document.uri, [])

    for token in tokens:
        data.extend(
            [
                token.line,
                token.offset,
                len(token.text),
                TokenTypes.index(token.tok_type),
                reduce(operator.or_, token.tok_modifiers, 0),
            ]
        )

    return types.SemanticTokens(data=data)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    start_server(server)
```

## Key Concepts

### 1. Token Types and Modifiers

Define the token types and modifiers your server supports:

```python
TokenTypes = ["keyword", "variable", "function", "operator", "parameter", "type"]

class TokenModifier(enum.IntFlag):
    deprecated = enum.auto()
    readonly = enum.auto()
    defaultLibrary = enum.auto()
    definition = enum.auto()
```

### 2. SemanticTokensLegend

Register with a legend defining available types and modifiers:

```python
@server.feature(
    types.TEXT_DOCUMENT_SEMANTIC_TOKENS_FULL,
    types.SemanticTokensLegend(
        token_types=TokenTypes,
        token_modifiers=[m.name for m in TokenModifier],
    ),
)
def semantic_tokens_full(ls, params):
    ...
```

### 3. Token Data Encoding

Each token is encoded as 5 integers:

```python
data.extend([
    token.line,                              # Delta line
    token.offset,                            # Delta character
    len(token.text),                         # Length
    TokenTypes.index(token.tok_type),        # Token type index
    reduce(operator.or_, token.tok_modifiers, 0),  # Modifiers bitmask
])
```

### 4. Relative Positioning

Positions are relative to the previous token:
- **Line**: Delta from previous token's line
- **Character**: Delta from previous token's character (or absolute if on different line)

```python
prev_line = 0
prev_offset = 0

for current_line, line in enumerate(doc.lines):
    # ...
    tokens.append(Token(
        line=current_line - prev_line,      # Relative line
        offset=current_offset - prev_offset, # Relative offset
        text=match.group(0),
    ))
    prev_line = current_line
    prev_offset = current_offset
```

### 5. Modifier Bitmask

Combine modifiers using bitwise OR:

```python
# Single modifier
modifiers = TokenModifier.definition  # = 8 (0b1000)

# Multiple modifiers
modifiers = TokenModifier.definition | TokenModifier.readonly  # = 10 (0b1010)

# In the data array
reduce(operator.or_, token.tok_modifiers, 0)
```

## Standard Token Types

| Index | Type | Description |
|-------|------|-------------|
| 0 | namespace | Module/package names |
| 1 | type | Type names |
| 2 | class | Class names |
| 3 | enum | Enum names |
| 4 | interface | Interface names |
| 5 | struct | Struct names |
| 6 | typeParameter | Type parameters |
| 7 | parameter | Function parameters |
| 8 | variable | Variables |
| 9 | property | Properties |
| 10 | enumMember | Enum members |
| 11 | event | Events |
| 12 | function | Functions |
| 13 | method | Methods |
| 14 | macro | Macros |
| 15 | keyword | Keywords |
| 16 | modifier | Modifiers |
| 17 | comment | Comments |
| 18 | string | Strings |
| 19 | number | Numbers |
| 20 | regexp | Regular expressions |
| 21 | operator | Operators |

## Standard Token Modifiers

| Bit | Modifier | Description |
|-----|----------|-------------|
| 0 | declaration | Declaration of symbol |
| 1 | definition | Definition of symbol |
| 2 | readonly | Read-only variable |
| 3 | static | Static member |
| 4 | deprecated | Deprecated symbol |
| 5 | abstract | Abstract member |
| 6 | async | Async function |
| 7 | modification | Being modified |
| 8 | documentation | Documentation |
| 9 | defaultLibrary | From standard library |

## Lexer vs Classifier Pattern

This example separates:

1. **Lexing** - Breaking text into tokens with positions
2. **Classification** - Determining token types based on context

```python
def parse(self, doc: TextDocument):
    tokens = self.lex(doc)        # Step 1: Lexing
    self.classify_tokens(tokens)   # Step 2: Classification
    self.tokens[doc.uri] = tokens
```

## Related pygls Examples

- [Document Color](https://pygls.readthedocs.io/en/latest/servers/examples/colors.html)
- [Document & Workspace Symbols](https://pygls.readthedocs.io/en/latest/servers/examples/symbols.html)
- [Hover](https://pygls.readthedocs.io/en/latest/servers/examples/hover.html)

## References

- [LSP Specification - Semantic Tokens](https://microsoft.github.io/language-server-protocol/specification.html#textDocument_semanticTokens)
- [How To Interpret Semantic Tokens](https://pygls.readthedocs.io/en/latest/protocol/howto/interpret-semantic-tokens.html)
