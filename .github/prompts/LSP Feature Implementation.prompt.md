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

In `vscode-extension/src/server/server.ts`, declare the capability:

```typescript
import {
    createConnection, 
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    CompletionParams,
    CompletionItem,
    CompletionItemKind,
    TextDocumentSyncKind,
    InitializeResult,
    ServerCapabilities
} from 'vscode-languageserver/node';

export class CK3LanguageServer {
    private connection = createConnection(ProposedFeatures.all);
    
    constructor() {
        // Register capabilities
        this.serverCapabilities: ServerCapabilities = {
            completionProvider: {
                triggerCharacters: [".", ":", " "],
                resolveProvider: false
            },
            // ... other capabilities
        };
    }
}

### 3. Create Feature Module

Create a new file for your feature (e.g., `vscode-extension/src/server/lsp/my-feature.ts`):

```typescript
/**
 * My Feature Implementation
 *
 * Provides [description of feature] for CK3 scripts.
 *
 * LSP Methods:
 *     - textDocument/myFeature (MY_FEATURE-001)
 *
 * Dependencies:
 *     - parser.ts: For AST access
 *     - indexer.ts: For symbol lookup (if needed)
 *     - language.ts: For CK3-specific knowledge
 */

import {
    Position,
    Range,
    TextDocumentIdentifier,
} from 'vscode-languageserver/node';

export class MyFeatureProvider {
    /** Provides my feature functionality. */
    
    constructor(private indexer?: any) {
        /** Initialize the provider.
         * 
         * @param indexer Optional indexer for cross-file lookups
         */
    }
    
    provide(
        document: TextDocument,
        position: Position
    ): MyFeatureResult | null {
        /** Main entry point for the feature.
         * 
         * @param document The text document
         * @param position Cursor position
         * @returns Feature result or null
         */
        // Get AST
        const ast = document.ast;
        if (!ast) {
            return null;
        }
        
        // Find node at position
        const node = findNodeAtPosition(ast, position);
        if (!node) {
            return null;
        }
        
        // Implement feature logic
        const result = this.computeResult(node);
        
        return result;
    }
    
    private computeResult(node: any): MyFeatureResult {
        /** Internal computation logic. */
        // Implementation details
        throw new Error('Not implemented');
    }
```

### 4. Register Handler in Server

In `vscode-extension/src/server/server.ts`:

```typescript
import { createConnection } from 'vscode-languageserver/node';
import { TextDocumentRequestHandler } from 'vscode-languageserver-protocol';

// Import your feature provider
import { MyFeatureProvider } from './lsp/my-feature';

export class CK3LanguageServer {
    private connection = createConnection(ProposedFeatures.all);
    private myFeatureProvider: MyFeatureProvider;
    
    constructor() {
        // Initialize feature provider
        this.myFeatureProvider = new MyFeatureProvider(this.indexer);
        
        // Register handler
        this.connection.onRequest('textDocument/myFeature', this.handleMyFeature.bind(this));
    }

    private async handleMyFeature(params: MyFeatureParams): Promise<MyFeatureResult | null> {
        /** Handle myFeature requests. */
        try {
            // Get document
            const document = this.documents.get(params.textDocument.uri);
            if (!document) {
                return null;
            }
            
            // Call provider
            const result = this.myFeatureProvider.provide(
                document,
                params.position
            );
            
            return result;
            
        } catch (error) {
            this.connection.console.error(`Feature error: ${error}`);
            return null;
        }
    }
```

### 5. Write Tests

Create `vscode-extension/src/test/unit/my-feature.test.ts`:

```typescript
import { expect } from 'chai';
import { MyFeatureProvider } from '../../server/lsp/my-feature';
import { CK3Parser } from '../../server/core/parser';
import { Position } from 'vscode-languageserver/node';

describe('MyFeatureProvider', () => {
    let provider: MyFeatureProvider;
    
    beforeEach(() => {
        provider = new MyFeatureProvider();
    });
    
    it('should provide basic functionality', () => {
        const code = `
        namespace = test
        test_value = 100
        `;
        
        const parser = new CK3Parser();
        const ast = parser.parseText(code);
        
        // Create mock document
        const document = createMockDocument(code, ast);
        const position: Position = { line: 1, character: 10 };
        
        const result = provider.provide(document, position);
        
        expect(result).to.not.be.null;
        // Additional assertions
    });
    
    it('should handle integration with LSP handler', async () => {
        const server = createTestServer();
        
        // Open document
        await server.didOpen({ uri: "file:///test.txt", text: "test code" });
        
        // Call feature
        const params = {
            textDocument: { uri: "file:///test.txt" },
            position: { line: 0, character: 5 }
        };
        
        const result = await server.handleMyFeature(params);
        
        expect(result).to.not.be.null;
    });
});

### 6. Document the Feature

Add to module docstring:

```typescript
/**
 * My Feature (CK3XXX)
 *
 * Provides [feature description] for CK3 script files.
 *
 * Features:
 *     - Feature capability 1
 *     - Feature capability 2
 *     
 * Examples:
 *     const provider = new MyFeatureProvider();
 *     const result = provider.provide(document, position);
 *     
 * Diagnostic Codes:
 *     - CK3XXX: Error type 1
 *     - CK3YYY: Error type 2
 *
 * Dependencies:
 *     - parser.ts: AST parsing
 *     - language.ts: Language definitions
 *
 * LSP Methods:
 *     - textDocument/myFeature
 */
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

```typescript
provide(document: TextDocument, position: Position): MyFeatureResult | null {
    // 1. Get AST
    const ast = document.ast;
    
    // 2. Find node at position
    const node = findNodeAtPosition(ast, position);
    
    // 3. Determine context
    const context = analyzeContext(node);
    
    // 4. Generate results
    const results = computeResults(context);
    
    return results;
}

### Document-Wide Features

For features operating on entire documents (diagnostics, symbols):

```typescript
provide(document: TextDocument): MyFeatureResult[] {
    // 1. Get AST
    const ast = document.ast;
    
    // 2. Walk the tree
    const results: MyFeatureResult[] = [];
    for (const node of walkAst(ast)) {
        // Process each node
        const result = processNode(node);
        if (result) {
            results.push(result);
        }
    }
    
    return results;
}

### Workspace-Wide Features

For features requiring multiple files (find references, rename):

```typescript
provide(workspace: Workspace, params: MyParams): MyFeatureResult[] {
    // 1. Get symbol information
    const symbol = findSymbol(params);
    
    // 2. Search workspace
    const locations: Location[] = [];
    for (const doc of workspace.getAllDocuments()) {
        const matches = searchDocument(doc, symbol);
        locations.push(...matches);
    }
    
    return locations;
}

## Testing Checklist

- [ ] Unit tests for provider logic (Mocha)
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
- [vscode-languageserver Documentation](https://github.com/microsoft/vscode-languageserver-node)
- [VS Code Language Extensions](https://code.visualstudio.com/api/language-extensions/overview)
- [pychivalry Architecture](architecture_and_flow.md)
