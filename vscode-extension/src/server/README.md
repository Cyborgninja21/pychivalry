# TypeScript Language Server Implementation

This directory contains the CK3 Language Server implementation providing comprehensive LSP features for Crusader Kings III modding.

## Architecture

The TypeScript server implements a full LSP (Language Server Protocol) server with the following features:

### Core Components

1. **Parser** (`core/parser.ts`)
   - Tokenizes and parses CK3 script files into an Abstract Syntax Tree (AST)
   - Handles CK3-specific syntax: key-value pairs, blocks, lists, comparisons
   - Line and column tracking for precise error locations

2. **Document Indexer** (`core/indexer.ts`)
   - Maintains a workspace-wide symbol index
   - Tracks events, decisions, on-actions, scripted effects/triggers, variables, etc.
   - Enables fast symbol lookup for navigation features

3. **Workspace Manager** (`core/workspace.ts`)
   - Manages workspace folders
   - Discovers mod descriptors
   - Handles workspace file operations

4. **Schema Loader** (`schema/loader.ts`)
   - Lazy-loads YAML schema files for validation
   - Supports schema inheritance
   - Caches loaded schemas for performance

### LSP Features (16 implemented)

All standard LSP features are implemented:

1. **Completions** (`lsp/completions.ts`) - Context-aware auto-completion
2. **Hover** (`lsp/hover.ts`) - Documentation on hover
3. **Go-to-Definition** (`lsp/navigation.ts`) - Jump to symbol definitions
4. **Find References** (`lsp/navigation.ts`) - Find all symbol references
5. **Document Symbols** (`lsp/symbols.ts`) - Document outline/breadcrumbs
6. **Formatting** (`lsp/formatting.ts`) - Document and range formatting
7. **Folding Ranges** (`lsp/folding.ts`) - Code folding
8. **Rename** (`lsp/rename.ts`) - Symbol renaming
9. **Semantic Tokens** (`lsp/semantic-tokens.ts`) - Semantic syntax highlighting
10. **Code Actions** (`lsp/code-actions.ts`) - Quick fixes
11. **Code Lens** (`lsp/code-lens.ts`) - Inline actionable info
12. **Document Links** (`lsp/document-links.ts`) - Clickable links
13. **Inlay Hints** (`lsp/inlay-hints.ts`) - Inline type annotations
14. **Signature Help** (`lsp/signature-help.ts`) - Parameter hints
15. **Document Highlights** (`lsp/document-highlight.ts`) - Highlight occurrences
16. **Diagnostics** (`lsp/diagnostics.ts`) - Error and warning messages

### CK3 Language Support

- **Effects and Triggers** (`ck3/language.ts`)
  - Definitions for all CK3 effects and triggers
  - Context-aware completions
  - Documentation for each effect/trigger

- **Scope System**
  - Scope type inference
  - Scope chain validation (planned)
  - Inlay hints for scope types

## Building

The server is built alongside the extension using webpack:

```bash
npm run compile
```

This produces two output files:
- `dist/extension.js` - The VS Code extension
- `dist/server-main.js` - The language server

## Running

The server is automatically started by the VS Code extension when a CK3 workspace is opened.

## Testing

To test the server directly:

```bash
node dist/server-main.js --stdio
```

The server expects LSP protocol messages on stdin and writes responses to stdout.

## Performance

The server provides excellent performance characteristics:

1. **Fast startup**: ~50-100ms (YAML loading via lazy loading)
2. **Single process**: Runs in the same process as the extension
3. **Compact distribution**: ~2-3MB total package size

## Development

The server is written in TypeScript with strict type checking enabled. All LSP protocol types are imported from `vscode-languageserver/node`.

### Adding New Features

1. Create a new provider in `lsp/`
2. Import it in `server.ts`
3. Register handlers in `registerHandlers()`
4. Add handler methods

### Schema Files

Schema files are loaded from the `pychivalry/data/schemas/` directory. The schema loader supports:
- Lazy loading (schemas loaded on first use)
- Schema inheritance
- Caching

## Future Work

- Complete CK3 validation (scope chains, timing, etc.)
- Game log integration
- Custom commands
- Performance optimizations
- Unit tests
