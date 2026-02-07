# Enhanced Code Lens Implementation

## Overview

The enhanced code lens provider offers comprehensive inline actionable information for CK3 mod development. It displays reference counts, complexity metrics, event chains, namespace statistics, and localization coverage directly in the editor.

## Architecture

### Core Components

#### CodeLensProvider
Main provider class that orchestrates lens generation:
- Manages configuration and caching
- Coordinates multiple specialized generators
- Implements LSP protocol handlers
- Provides performance optimizations (caching, limits)

#### Lens Generators
Specialized generators implementing the `LensGenerator` interface:
- `EventLensGenerator` - Event-specific lenses
- `DecisionLensGenerator` - Decision-specific lenses
- `ScriptedEffectLensGenerator` - Scripted effect lenses
- `ScriptedTriggerLensGenerator` - Scripted trigger lenses
- `ComplexityLensGenerator` - Generic complexity metrics
- `NamespaceLensGenerator` - Namespace statistics
- `LocalizationLensGenerator` - Localization coverage

### Configuration

```typescript
interface CodeLensConfig {
    showReferenceCounts: boolean;      // Show "N references" for symbols
    showComplexity: boolean;           // Show complexity metrics
    showEventChains: boolean;          // Show event trigger chains
    showNamespaceStats: boolean;       // Show namespace statistics
    showLocalization: boolean;         // Show localization coverage
    minLinesForLens: number;          // Minimum lines to show lens (default: 10)
    maxLensesPerDocument: number;     // Maximum lenses per file (default: 50)
}
```

## Features

### 1. Reference Counts

Displays reference counts for symbols across the workspace:

```
namespace.1001 = {           # 5 references
    type = character_event
    ...
}

some_decision = {            # 0 references • unused
    ...
}
```

- **Events**: Shows usage across all event files
- **Decisions**: Tracks references in triggers and effects
- **Scripted effects/triggers**: Shows call sites
- **Variables**: Declaration and usage tracking
- **Localization keys**: Missing or N usages

### 2. Complexity Metrics

Visual indicators for code complexity:

```
namespace.1001 = {           # 🟢 75 lines, 3 options, depth 2
    ...
}

namespace.2001 = {           # 🟡 120 lines, 4 options, depth 3
    ...
}

namespace.3001 = {           # 🔴 200 lines, 7 options, depth 5
    ...
}
```

#### Complexity Levels

- **🟢 Simple**: <50 lines, <3 options, low nesting
- **🟡 Moderate**: 50-150 lines, 3-5 options, moderate nesting
- **🔴 Complex**: >150 lines, >5 options, deep nesting

#### Metrics Calculated

- **Lines**: Total line count
- **Depth**: Maximum nesting depth
- **Statements**: Assignment and comparison count
- **Branches**: Options, conditionals (if/else_if)
- **Score**: Weighted complexity score

### 3. Event Chain Visualization

Tracks event trigger relationships:

```
namespace.1001 = {           # → triggers 2 events
    option = {
        trigger_event = namespace.1002
        trigger_event = namespace.1003
    }
}

namespace.1002 = {           # ← triggered by 1 event
    ...
}

namespace.1003 = {           # ⚠ circular reference detected
    option = {
        trigger_event = namespace.1001
    }
}
```

- **Triggers**: Shows events this event triggers
- **Triggered by**: Shows events that trigger this event
- **Circular references**: Warns about infinite loops
- **Event flow**: Full chain visualization

### 4. Namespace Statistics

Per-namespace metrics:

```
# At namespace declaration or first event

namespace.1001 = {           # namespace: 15 events, 3 decisions
                             # loc: 85% (51/60 keys)
                             # 4 files
    ...
}
```

- **Event count**: Total events in namespace
- **Decision count**: Total decisions in namespace
- **Localization coverage**: Percentage of required keys present
- **File distribution**: Number of files using this namespace

### 5. Clickable Actions

All lenses are interactive and execute commands:

- **Find references** → `ck3.showReferences`
  - Opens references panel with all usages
  - Navigates to reference locations

- **Show event chain** → `ck3.showEventChain`
  - Visualizes full trigger chain
  - Shows event flow diagram

- **Show callers** → `ck3.showCallers`
  - Displays call hierarchy
  - Lists all events that trigger this event

- **Show circular reference** → `ck3.showCircularReference`
  - Highlights circular dependency
  - Shows cycle path

### 6. Context-Specific Lenses

Different lenses appear based on content type:

#### Events
- Reference count
- Complexity metrics (lines, options, depth)
- Trigger chains (→ targets, ← callers)
- Circular reference warnings
- Localization coverage

#### Decisions
- Reference count
- Conditions count
- Effects count
- Total lines

#### Scripted Effects/Triggers
- Usage count across workspace
- Parameter count
- Performance metrics (when available)

#### Options
- Weight display
- Conditions summary
- AI chance

#### Trigger/Effect Blocks
- Condition count
- Effect count
- Scope context

## Performance Optimizations

### Caching Strategy

```typescript
private referenceCache: Map<string, ReferenceInfo>;
private namespaceCache: Map<string, NamespaceStats>;
private cacheTimestamp: number;
private readonly CACHE_TTL = 5000; // 5 seconds
```

- **Reference cache**: Stores reference lookups to avoid repeated indexer queries
- **Namespace cache**: Caches namespace statistics
- **TTL expiration**: Automatic cache invalidation after 5 seconds
- **Lazy computation**: Expensive metrics computed only when needed

### Limits

- **Max lenses per document**: Default 50 (configurable)
- **Minimum lines for lens**: Default 10 (configurable)
- **Debounced updates**: Prevents excessive recomputation

### Incremental Updates

- Only recomputes lenses for changed documents
- Preserves cache across unchanged files
- Uses document indexer for efficient cross-file lookups

## Integration Points

### DocumentIndexer
- Symbol lookups by name and type
- Reference tracking across workspace
- Event metadata extraction

### CK3Parser
- AST traversal for node analysis
- Node type identification
- Range and position information

### VS Code LSP
- `textDocument/codeLens` request handler
- `codeLens/resolve` for deferred computation
- Command execution for lens actions

## Usage Examples

### Example 1: Event with Full Information

```ck3
namespace.1001 = {           # 3 references
                             # 🟢 45 lines, 2 options, depth 2
                             # → triggers 1 event
    type = character_event
    title = namespace.1001.t
    desc = namespace.1001.desc
    
    option = {
        name = namespace.1001.a
        trigger_event = namespace.1002
    }
    
    option = {
        name = namespace.1001.b
    }
}
```

### Example 2: Complex Event Warning

```ck3
namespace.5001 = {           # 0 references • unused
                             # 🔴 210 lines, 8 options, depth 6
                             # → triggers 5 events
                             # ← triggered by 3 events
    type = character_event
    # ... 200+ lines of complex logic ...
}
```

### Example 3: Decision with Stats

```ck3
my_decision = {              # 2 references
                             # 5 conditions, 8 effects
    is_shown = { ... }
    is_valid = { ... }
    is_valid_showing_failures_only = { ... }
    effect = { ... }
}
```

## Future Enhancements

### Planned Features
1. **Performance metrics** - Execution time estimation
2. **Dependency graphs** - Visual dependency trees
3. **AI behavior analysis** - AI_chance aggregation
4. **Historical data** - Reference count trends
5. **Refactoring suggestions** - Split complex events
6. **Test coverage** - Unit test lens integration
7. **Git blame** - Last modified information
8. **Scope validation** - Scope chain correctness

### Extensibility
The generator pattern allows easy addition of new lens types:

```typescript
class CustomLensGenerator implements LensGenerator {
    canApply(node: ASTNode, context: LensContext): boolean {
        // Detection logic
    }
    
    generate(node: ASTNode, context: LensContext): CodeLens[] {
        // Generation logic
    }
}
```

## Configuration in VS Code

Users can configure code lens behavior in settings:

```json
{
    "ck3.codeLens.showReferenceCounts": true,
    "ck3.codeLens.showComplexity": true,
    "ck3.codeLens.showEventChains": true,
    "ck3.codeLens.showNamespaceStats": true,
    "ck3.codeLens.minLinesForLens": 10,
    "ck3.codeLens.maxLensesPerDocument": 50
}
```

## Testing

### Unit Tests
- Complexity calculation accuracy
- Reference counting correctness
- Cache invalidation behavior
- Generator selection logic

### Integration Tests
- End-to-end lens generation
- Command execution
- Performance benchmarks
- Large file handling

## Troubleshooting

### Common Issues

1. **Missing lenses**
   - Check if file is indexed
   - Verify document is parsed correctly
   - Check lens limits (max per document)

2. **Incorrect reference counts**
   - Force index rebuild
   - Clear reference cache
   - Check symbol name matching

3. **Performance issues**
   - Increase cache TTL
   - Reduce max lenses per document
   - Increase minimum lines threshold

4. **Circular reference false positives**
   - Review event chain analysis logic
   - Check visited set implementation
   - Verify target extraction

## Related Documentation

- [LSP Features Overview](./lsp-features.md)
- [Document Indexer](./indexer.md)
- [AST Parser](./parser.md)
- [VS Code LSP Protocol](https://microsoft.github.io/language-server-protocol/)
