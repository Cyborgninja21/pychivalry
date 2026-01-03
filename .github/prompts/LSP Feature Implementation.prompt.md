# LSP Feature Implementation Guide

**Purpose:** Step-by-step guide for implementing new Language Server Protocol features in pychivalry.

**Use this when:** Adding new LSP capabilities like completions, hover, code actions, or other protocol features.

---

## Feature Implementation Process

### 1. Understand the LSP Specification

Before implementing, read the official specification:
- Visit: https://microsoft.github.io/language-server-protocol/
- Find your feature's specification (e.g., `textDocument/completion`)
- Note the request/response structure
- Understand client and server capabilities

### 2. Register Server Capability

In `pychivalry/server.py`, declare the capability:

```python
from lsprotocol.types import (
    CompletionOptions,
    ServerCapabilities,
)

class CK3LanguageServer(LanguageServer):
    def __init__(self):
        super().__init__("ck3-language-server", "v1.0")
        
        # Register capabilities
        self.server_capabilities = ServerCapabilities(
            completion_provider=CompletionOptions(
                trigger_characters=[".", ":", " "],
                resolve_provider=False
            ),
            # ... other capabilities
        )
```

### 3. Create Feature Module

Create a new file for your feature (e.g., `pychivalry/my_feature.py`):

```python
"""
My Feature Implementation

Provides [description of feature] for CK3 scripts.

LSP Methods:
    - textDocument/myFeature (MY_FEATURE-001)

Dependencies:
    - parser.py: For AST access
    - indexer.py: For symbol lookup (if needed)
    - ck3_language.py: For CK3-specific knowledge
"""

from typing import List, Optional
from lsprotocol.types import (
    Position,
    Range,
    TextDocumentIdentifier,
)

class MyFeatureProvider:
    """Provides my feature functionality."""
    
    def __init__(self, indexer=None):
        """Initialize the provider.
        
        Args:
            indexer: Optional indexer for cross-file lookups
        """
        self.indexer = indexer
    
    def provide(
        self, 
        document: TextDocument,
        position: Position
    ) -> Optional[MyFeatureResult]:
        """Main entry point for the feature.
        
        Args:
            document: The text document
            position: Cursor position
            
        Returns:
            Feature result or None
        """
        # Get AST
        ast = document.ast
        if not ast:
            return None
        
        # Find node at position
        node = find_node_at_position(ast, position)
        if not node:
            return None
        
        # Implement feature logic
        result = self._compute_result(node)
        
        return result
    
    def _compute_result(self, node):
        """Internal computation logic."""
        # Implementation details
        pass
```

### 4. Register Handler in Server

In `pychivalry/server.py`:

```python
from pygls.server import LanguageServer
from lsprotocol.types import TEXT_DOCUMENT_MY_FEATURE

# Import your feature provider
from pychivalry.my_feature import MyFeatureProvider

class CK3LanguageServer(LanguageServer):
    def __init__(self):
        super().__init__("ck3-language-server", "v1.0")
        
        # Initialize feature provider
        self.my_feature_provider = MyFeatureProvider(
            indexer=self.indexer
        )

# Register handler
@server.feature(TEXT_DOCUMENT_MY_FEATURE)
async def my_feature_handler(
    server: CK3LanguageServer,
    params: MyFeatureParams
) -> Optional[MyFeatureResult]:
    """Handle myFeature requests."""
    try:
        # Get document
        document = server.workspace.get_document(params.text_document.uri)
        
        # Call provider
        result = server.my_feature_provider.provide(
            document,
            params.position
        )
        
        return result
        
    except Exception as e:
        server.show_message(f"Feature error: {e}", MessageType.Error)
        return None
```

### 5. Write Tests

Create `tests/test_my_feature.py`:

```python
import pytest
from pychivalry.my_feature import MyFeatureProvider
from pychivalry.parser import CK3Parser

@pytest.fixture
def provider():
    """Feature provider fixture."""
    return MyFeatureProvider()

def test_basic_functionality(provider):
    """Test basic feature behavior."""
    code = """
    namespace = test
    test_value = 100
    """
    
    parser = CK3Parser()
    ast = parser.parse_text(code)
    
    # Create mock document
    document = MockDocument(code, ast)
    position = Position(line=1, character=10)
    
    result = provider.provide(document, position)
    
    assert result is not None
    # Additional assertions

@pytest.mark.asyncio
async def test_handler_integration():
    """Test LSP handler integration."""
    server = create_test_server()
    
    # Open document
    await server.did_open(uri="file:///test.txt", text="test code")
    
    # Call feature
    params = MyFeatureParams(
        text_document=TextDocumentIdentifier(uri="file:///test.txt"),
        position=Position(line=0, character=5)
    )
    
    result = await my_feature_handler(server, params)
    
    assert result is not None
```

### 6. Document the Feature

Add to module docstring:

```python
"""
My Feature (CK3XXX)

Provides [feature description] for CK3 script files.

Features:
    - Feature capability 1
    - Feature capability 2
    
Examples:
    >>> provider = MyFeatureProvider()
    >>> result = provider.provide(document, position)
    
Diagnostic Codes:
    - CK3XXX: Error type 1
    - CK3YYY: Error type 2

Dependencies:
    - parser.py: AST parsing
    - ck3_language.py: Language definitions

LSP Methods:
    - textDocument/myFeature
"""
```

### 7. Update VS Code Extension (if needed)

If the feature requires client-side support, update `vscode-extension/src/extension.ts`:

```typescript
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
    // ... client setup ...
    
    // Register client-side feature
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3.myFeature', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            // Call LSP method
            const result = await client.sendRequest('textDocument/myFeature', {
                textDocument: { uri: editor.document.uri.toString() },
                position: editor.selection.active
            });
            
            // Handle result
            if (result) {
                vscode.window.showInformationMessage('Feature executed!');
            }
        })
    );
}
```

### 8. Add to Feature List

Update `README.md`:

```markdown
### Available Now

#### 🆕 My New Feature
Description of what the feature does.

<!-- ![Feature demo](assets/images/my-feature.png) -->
```

## Common Patterns

### Position-Based Features

For features triggered at a cursor position (hover, completion, definition):

```python
def provide(self, document, position):
    # 1. Get AST
    ast = document.ast
    
    # 2. Find node at position
    node = find_node_at_position(ast, position)
    
    # 3. Determine context
    context = analyze_context(node)
    
    # 4. Generate results
    results = compute_results(context)
    
    return results
```

### Document-Wide Features

For features operating on entire documents (diagnostics, symbols):

```python
def provide(self, document):
    # 1. Get AST
    ast = document.ast
    
    # 2. Walk the tree
    results = []
    for node in walk_ast(ast):
        # Process each node
        result = process_node(node)
        if result:
            results.append(result)
    
    return results
```

### Workspace-Wide Features

For features requiring multiple files (find references, rename):

```python
def provide(self, workspace, params):
    # 1. Get symbol information
    symbol = find_symbol(params)
    
    # 2. Search workspace
    locations = []
    for doc in workspace.get_all_documents():
        matches = search_document(doc, symbol)
        locations.extend(matches)
    
    return locations
```

## Testing Checklist

- [ ] Unit tests for provider logic
- [ ] Integration tests with mock server
- [ ] Tests for edge cases (empty document, invalid position)
- [ ] Performance tests for large files
- [ ] Error handling tests

## Performance Considerations

1. **Cache when possible:** Don't recompute on every request
2. **Limit results:** Don't return thousands of items
3. **Use async/await:** Don't block the event loop
4. **Debounce expensive operations:** Use delays for validation
5. **Profile:** Measure actual performance bottlenecks

## Debugging Tips

1. **Enable verbose logging:**
   ```json
   "ck3LanguageServer.trace.server": "verbose"
   ```

2. **Check LSP messages:** View Output → CK3 Language Server

3. **Use breakpoints:** Debug the handler in VS Code

4. **Test incrementally:** Start with simple cases

5. **Validate against spec:** Ensure response format is correct

## Resources

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [pygls Documentation](https://pygls.readthedocs.io/)
- [VS Code Language Extensions](https://code.visualstudio.com/api/language-extensions/overview)
- [pychivalry Architecture](architecture_and_flow.md)
