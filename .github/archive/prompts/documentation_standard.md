# Pychivalry Documentation Standard

## Overview
This document defines the comprehensive documentation standard for the pychivalry Language Server Protocol implementation for Crusader Kings 3 modding.

## Documentation Philosophy
**Goal**: Aggressive inline documentation where functionally every line of code has strong documentation explaining the WHY behind decisions, not just the WHAT.

## Module Documentation Structure

### 1. Module Docstring Template

```typescript
/**
 * Module Title - Brief One-Line Description
 *
 * DIAGNOSTIC CODES:
 *     MODULE-XXX-001: Description of error/warning condition
 *     MODULE-XXX-002: Description of another condition
 *     MODULE-XXX-003: Additional error conditions
 *     ...
 *
 * MODULE OVERVIEW:
 *     Comprehensive explanation of what this module does and why it exists.
 *     Include the problem it solves, the approach taken, and key design decisions.
 *     Explain the role this module plays in the larger system.
 *
 * ARCHITECTURE:
 *     Key architectural patterns and design decisions:
 *     - Pattern 1: Why this pattern was chosen
 *     - Pattern 2: Trade-offs and benefits
 *     - Design Decision 3: Rationale and alternatives considered
 *
 * [SPECIFIC SECTION - if applicable]:
 *     Module-specific information like:
 *     - LANGUAGE SPECIFICATION: For parsers
 *     - PROTOCOL DETAILS: For network/LSP modules
 *     - ALGORITHM DESCRIPTION: For complex processing
 *     - DATA STRUCTURES: For storage/indexing modules
 *
 * USAGE EXAMPLES:
 *     ```typescript
 *     // Real-world usage example
 *     const result = functionCall(param);
 *     result.property;  // Expected output
 *     
 *     // Another example showing edge cases
 *     const edgeCase = functionCall(edgeParam);
 *     // Explanation of behavior
 *     ```
 * 
 * PERFORMANCE:
 *     - Operation 1: O(n) complexity, typical time ~Xms
 *     - Memory usage: ~X MB for typical use case
 *     - Optimization notes: Why certain optimizations were made
 *     - Caching strategy: If applicable
 *
 * ERROR HANDLING:
 *     - Strategy: Fail fast / Graceful degradation / etc.
 *     - Error propagation: How errors are handled and reported
 *     - Recovery mechanisms: If applicable
 *
 * SEE ALSO:
 *     - related-module.ts: How it interacts with this module
 *     - another-module.ts: Dependencies and relationships
 *     - external-library: External dependencies
 */

### 2. Section Dividers

Use clear section dividers for visual organization:

```typescript
// =============================================================================
// SECTION NAME (e.g., IMPORTS, DATA STRUCTURES, CORE FUNCTIONS, VALIDATION)
// =============================================================================
```

**Standard Sections**:
- `IMPORTS`: With explanatory comments
- `CONSTANTS`: With purpose and usage
- `DATA STRUCTURES`: Classes and interfaces
- `CORE FUNCTIONS`: Main functionality
- `HELPER FUNCTIONS`: Utilities
- `VALIDATION FUNCTIONS`: Input/output validation
- `UTILITIES`: General utilities

### 3. Import Documentation

Document WHY each import is needed:

```typescript
// =============================================================================
// IMPORTS
// =============================================================================

// Node.js standard library imports
import * as fs from 'fs';  // File system operations for data loading
import * as path from 'path';  // Path utilities for cross-platform compatibility

// Third-party imports
import { Range, Position } from 'vscode-languageserver-types';  // LSP protocol type definitions
import { createConnection } from 'vscode-languageserver/node';  // Core LSP server implementation

// Internal imports - module relationships
import { parseDocument } from './parser';  // AST generation from text
import { validateScopeChain } from './validation/scopes';  // Scope validation logic
```

### 4. Constant Documentation

Every constant should explain its purpose:

```typescript
// Maximum number of completion suggestions to return
// Limited to prevent UI lag in editors with large suggestion lists
const MAX_COMPLETIONS = 100;

// Cache timeout in seconds
// Balance between memory usage and performance
// Set to 300s (5 minutes) based on typical editing patterns
const CACHE_TIMEOUT = 300;

// Universal scope links available in ALL scope types
// These preserve the current scope type during navigation
// - root: Original scope when script started
// - this: Current scope (explicit reference)
// - prev: Previous scope in transition chain
const UNIVERSAL_LINKS = ["root", "this", "prev", "from", "fromfrom"];
```

### 5. Function Documentation Template

```typescript
/**
 * Brief one-line description of what the function does.
 *
 * Detailed explanation of the function's purpose, behavior, and use cases.
 * Explain any important algorithms or processing steps at a high level.
 *
 * Algorithm (for complex functions):
 * 1. Step one: What happens and why
 * 2. Step two: Processing logic
 * 3. Step three: Result construction
 * 4. Edge case handling
 *
 * @param param1 Description of parameter including:
 *               - Valid value ranges or types
 *               - Default behavior if null/undefined
 *               - Examples of typical values
 * @param param2 Description with constraints and expectations
 *               Can span multiple lines for complex parameters
 *
 * @returns Description of return value including:
 *          - Type and structure
 *          - Special values (null, undefined, empty array, etc.)
 *          - Example return values
 *          
 *          For complex returns:
 *          Structure:
 *          {
 *              key1: 'description',
 *              key2: 'description'
 *          }
 *
 * @throws {ErrorType} When this error occurs and why
 * @throws {AnotherError} Conditions that trigger this error
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = functionName('input', 42);
 * console.log(result);  // Expected: 'output'
 * 
 * // Edge case
 * const result2 = functionName('', 0);
 * console.log(result2);  // Expected: default behavior
 * ```
 *
 * Performance:
 *     - Time complexity: O(n log n) due to sorting
 *     - Space complexity: O(n) for intermediate storage
 *     - Typical execution: <10ms for 1000 items
 *
 * Diagnostic Codes:
 *     MODULE-XXX: Referenced when specific conditions occur
 *
 * Notes:
 *     - Important caveats or limitations
 *     - Thread safety considerations
 *     - Side effects or state changes
 *     - TODO items if applicable
 *
 * See Also:
 *     relatedFunction(): How it relates to this function
 *     module.otherFunction(): Dependencies
 */
function functionName(param1: Type1, param2: Type2): ReturnType {
    // Implementation with inline comments...
}

### 6. Inline Comment Standards

**Rule**: Explain WHY, not WHAT. The code already shows WHAT.

❌ **Bad** (describes what):
```typescript
// Increment counter
counter += 1;
```

✅ **Good** (explains why):
```typescript
// Track number of processed items for progress reporting
counter += 1;
```

❌ **Bad**:
```typescript
// Check if scope_type is in scopes
if (!(scopeType in scopes)) {
    return [];
}
```

✅ **Good**:
```typescript
// Unknown scope types return empty array as safe fallback
// This prevents cascade failures when encountering mod-specific scopes
if (!(scopeType in scopes)) {
    logger.warn(`Unknown scope type: ${scopeType}`);  // SCOPE-001
    return [];  // Safe default allows parsing to continue
}
```

### 7. Inline Comment Placement

**Before complex blocks**:
```typescript
// Algorithm: Boyer-Moore string search for O(n/m) performance
// Chosen over naive O(n*m) for large file performance
for (let i = 0; i < text.length; i++) {
    // ... implementation
}
```

**For non-obvious logic**:
```typescript
// Use Set for O(1) lookup instead of Array O(n) search
// Performance critical in hot path (called thousands of times)
const validItemsSet = new Set(validItems);
```

**For edge cases**:
```typescript
// Handle empty string edge case - prevents IndexError on line[0]
if (!line) {
    continue;
}
```

**For performance optimizations**:
```typescript
// Cache result to avoid repeated YAML file I/O
// Typical 50ms file load → <1ms cached lookup
if (cache === null) {
    cache = loadData();
}
```

### 8. Class and Interface Documentation

```typescript
/**
 * Abstract Syntax Tree node for CK3 script parsing.
 *
 * Represents a single element in the parsed CK3 script. Nodes form a tree
 * structure where parent nodes contain child nodes, enabling hierarchical
 * representation of script structure.
 *
 * MEMORY OPTIMIZATION:
 * Uses careful property organization to reduce memory footprint by 30-50%. 
 * For large mods with thousands of nodes, this saves 10-50 MB of RAM.
 *
 * NODE TYPES:
 * - 'block': Named block with children (e.g., trigger = { ... })
 * - 'assignment': Key-value pair (e.g., gold = 100)
 * - 'list': Collection of items
 * - 'comment': Comment line
 * - 'event': Event definition
 *
 * SCOPE TRACKING:
 * Each node tracks its scope type (character, title, etc.) enabling
 * scope-aware validation and intelligent completions.
 *
 * @example
 * ```typescript
 * const node = new CK3Node({
 *     type: 'assignment',
 *     key: 'gold',
 *     value: 100,
 *     range: new Range(...)
 * });
 * ```
 *
 * Performance:
 *     Optimized structure: ~50 bytes per node
 *     Unoptimized equivalent: ~150 bytes per node (3x overhead)
 */
interface CK3Node {
    /** Node type classification */
    type: string;
    /** Identifier */
    key: string;
    /** Value or null for containers */
    value: any;
    /** Position in document */
    range: Range;
    /** Parent reference */
    parent?: CK3Node;
    /** For validation */
    scopeType: string;
    /** Nested nodes */
    children: CK3Node[];
}

### 9. Diagnostic Code System

**Format**: `MODULE-XXX`
- MODULE: Module name (SCOPE, DATA, PARSE, LIST, etc.)
- XXX: Three-digit code (001, 002, 003...)

**Usage**:
1. Define all codes in module docstring
2. Reference in function docstrings
3. Include in log messages

```typescript
/**
 * DIAGNOSTIC CODES:
 *     SCOPE-001: Unknown scope type
 *     SCOPE-002: Invalid scope link
 *     SCOPE-003: Invalid scope chain
 */

/**
 * Diagnostic Codes:
 *     SCOPE-001: Emitted when scopeType is unknown
 */
function validateScope(scopeType: string): boolean {
    if (!(scopeType in knownScopes)) {
        logger.warn(`Unknown scope: ${scopeType}`);  // SCOPE-001
        return false;
    }
    return true;
}

## Documentation Ratio Target

**Target**: 45-60% documentation to code ratio

This means for every 100 lines of code, expect 45-60 lines of documentation including:
- Module docstrings
- Function docstrings  
- Inline comments
- Section dividers

## Quality Checklist

Before considering documentation complete, verify:

- [ ] Module docstring with diagnostic codes
- [ ] All imports have explanatory comments
- [ ] Constants document their purpose and values
- [ ] All functions have complete docstrings
- [ ] Complex algorithms have step-by-step explanations
- [ ] Performance characteristics documented where relevant
- [ ] Edge cases explicitly handled and documented
- [ ] Error conditions reference diagnostic codes
- [ ] Section dividers for organization
- [ ] Examples for public API functions
- [ ] Cross-references to related modules

## Examples of Excellent Documentation

See these completed files as references:
- `ck3/validation/scopes.ts`: Comprehensive scope system documentation
- `data/loader.ts`: Data loading with caching patterns
- `core/parser.ts`: Two-phase parsing with algorithm explanations
- `ck3/validation/lists.ts`: Iterator validation with categorized constants

## Anti-Patterns to Avoid

❌ **Don't**: Document the obvious
```typescript
// Create an array
const items: string[] = [];
```

❌ **Don't**: Repeat the code in English
```typescript
// If x is greater than 10
if (x > 10) {
```

❌ **Don't**: Leave complex logic uncommented
```typescript
const result = items.flatMap((item, i) => 
  subItems.map((sub, j) => ({i, j, item, sub}))
  .filter(({item, sub}) => matrix[i][j]));
```

✅ **Do**: Explain the why and the algorithm
```typescript
// Build coordinate pairs for non-zero matrix elements
// Using flatMap + filter for O(n*m) single pass 
// Alternative: nested loops with same complexity but less functional
const result = items.flatMap((item, i) => 
  subItems.map((sub, j) => ({i, j, item, sub}))
  .filter(({item, sub}) => matrix[i][j]));
```

## Maintenance

This standard should be:
1. Applied to all new code
2. Used when refactoring existing code
3. Referenced in code review guidelines
4. Updated as patterns evolve

Last Updated: 2026-01-01
