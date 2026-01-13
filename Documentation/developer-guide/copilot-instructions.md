# COPILOT EDITS OPERATIONAL GUIDELINES

## PRIME DIRECTIVE

Avoid working on more than one file at a time.
Multiple simultaneous edits to a file will cause corruption.
Be chatting and teach about what you are doing while coding.

**NEVER estimate or provide time estimates for how long work will take.** AI cannot accurately predict completion times. Focus on describing the work to be done, not how long it will take.

## LARGE FILE & COMPLEX CHANGE PROTOCOL

### MANDATORY PLANNING PHASE

When working with large files (>300 lines) or complex changes:

1. ALWAYS start by creating a detailed plan BEFORE making any edits
2. Your plan MUST include:
   - All functions/sections that need modification
   - The order in which changes should be applied
   - Dependencies between changes
   - Estimated number of separate edits required
3. Format your plan as:

## PROPOSED EDIT PLAN

Working with: [filename]
Total planned edits: [number]

### MAKING EDITS

- Focus on one conceptual change at a time
- Show clear "before" and "after" snippets when proposing changes
- Include concise explanations of what changed and why
- Always check if the edit maintains the project's coding style

### Edit sequence:

1. [First specific change] - Purpose: [why]
2. [Second specific change] - Purpose: [why]
3. Do you approve this plan? I'll proceed with Edit [number] after your confirmation.
4. WAIT for explicit user confirmation before making ANY edits when user ok edit [number]

### EXECUTION PHASE

- After each individual edit, clearly indicate progress:
  "✅ Completed edit [#] of [total]. Ready for next edit?"
- If you discover additional needed changes during editing:
  - STOP and update the plan
  - Get approval before continuing

#### COMMIT AFTER COMPLETION

After completing a logical unit of work (e.g., implementing a feature phase, completing all edits in a plan), commit the changes with a detailed message:

1. **Stage and review changes:**

   ```bash
   git add -A && git status
   ```

2. **Commit with structured message:**
   Use conventional commit format with detailed bullet points:

   ```bash
   git commit -m "type: Brief summary (Phase X if applicable)

   - High-level change category
     * Specific implementation detail
     * Specific implementation detail
     * Bullet list of key changes/additions:
       - Sub-detail with command/feature name
       - Sub-detail with command/feature name
   - Another high-level change category
     * Implementation details
     * Key additions/modifications
   - Implementation notes
   - Error handling additions

   Next: [What comes next in the project plan]"
   ```

3. **Commit message structure:**

   - **Type prefix:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
   - **Summary line:** Clear, concise description (50-72 chars) with phase number if part of a plan
   - **Body:** Organized bullet list with categories and nested details
     - Use `-` for major categories
     - Use `*` for implementation details under each category
     - Use `-` for sub-items under implementation details
   - **Footer:** "Next:" statement indicating upcoming work

4. **When to commit:**
   - After completing all edits in an approved plan
   - After implementing a complete feature phase
   - When reaching a logical checkpoint with working code
   - Before switching to a different major task
   - NOT after every single small edit (unless explicitly requested)

### REFACTORING GUIDANCE

When refactoring large files:

- Break work into logical, independently functional chunks
- Ensure each intermediate state maintains functionality
- Consider temporary duplication as a valid interim step
- Always indicate the refactoring pattern being applied

### RATE LIMIT AVOIDANCE

- For very large files, suggest splitting changes across multiple sessions
- Prioritize changes that are logically complete units
- Always provide clear stopping points

## Development Environment

This project has the following tools installed and available:

- **Git**: Version control for all project files
- **GitHub CLI (`gh`)**: Installed for GitHub-specific operations (releases, PRs, issues)
  - Use `gh release create` for creating GitHub releases
  - Use `gh pr` commands for pull request management
  - Use `gh issue` commands for issue management
- **Python 3.9+**: Primary language for LSP server
- **Node.js/npm**: Required for VS Code extension development

## General Requirements

Use modern technologies as described below for all code suggestions. Prioritize clean, maintainable code with appropriate comments.

## Python Requirements

- **Target Version**: Python 3.9 or higher (compatible with 3.9, 3.10, 3.11, 3.12)
- **Features to Use**:
  - Type hints for all function parameters and return types
  - Dataclasses for data structures
  - f-strings for string formatting
  - Walrus operator (`:=`) where appropriate
  - Pattern matching (`match`/`case`) for Python 3.10+
  - Union types with `|` syntax for Python 3.10+
  - `typing` module for complex type annotations
  - Context managers for resource handling
  - Generators and iterators for memory efficiency
  - Async/await for asynchronous operations (pygls LSP)
- **Coding Standards**:
  - Follow PEP 8 style guidelines
  - Use Black formatter with line-length of 100
  - Run flake8 for linting
  - Use mypy for static type checking with `disallow_untyped_defs = true`
  - Prefer composition over inheritance
  - Use dependency injection patterns
- **Static Analysis**:
  - Include comprehensive docstrings (Google or NumPy style)
  - Type annotations compatible with mypy strict mode
  - Document all public APIs with param, return, and raises
- **Error Handling**:
  - Use exceptions consistently for error handling
  - Create custom exception classes for domain-specific errors
  - Provide meaningful, clear exception messages
  - Use `logging` module for diagnostic output
- **Testing**:
  - Write tests using pytest framework
  - Use pytest-asyncio for async test functions
  - Use hypothesis for property-based testing where appropriate
  - Aim for high test coverage on core functionality
- **LSP-Specific (pygls)**:
  - Follow pygls patterns for language server features
  - Use proper LSP types from `lsprotocol`
  - Handle document synchronization correctly
  - Implement incremental text document sync when possible

## TypeScript Requirements (VS Code Extension)

- **Target**: ES2020, CommonJS module format
- **Compiler Options**:
  - Strict mode enabled (`strict: true`)
  - ES module interop enabled
  - Source maps for debugging
  - Skip lib check for faster builds
  - Force consistent casing in file names
- **Features to Use**:
  - Arrow functions
  - Template literals
  - Destructuring assignment
  - Spread/rest operators
  - Async/await for asynchronous code
  - Proper TypeScript interfaces and types
  - Optional chaining (`?.`)
  - Nullish coalescing (`??`)
  - Const assertions
  - Type guards and narrowing
  - Generics where appropriate
- **Avoid**:
  - `any` type (use `unknown` and type guards instead)
  - `var` keyword (use `const` and `let`)
  - Callback-based patterns when promises can be used
  - Type assertions without proper validation
- **VS Code Extension Best Practices**:
  - Use VS Code API types from `@types/vscode`
  - Implement proper activation events
  - Handle extension lifecycle (activate/deactivate)
  - Use OutputChannel for logging
  - Implement proper error handling with user notifications
  - Follow VS Code extension guidelines for UI/UX
- **Error Handling**:
  - Use try-catch blocks consistently for async operations
  - Show user-friendly error messages via `vscode.window.showErrorMessage`
  - Log detailed errors to OutputChannel for debugging
  - Handle LSP client connection errors gracefully

## Folder Structure

Follow this structured directory layout:

```
pychivalry/                   # Project root
├── .github/                  # GitHub configuration
│   └── copilot-instructions.md  # AI assistant guidelines
├── pychivalry/               # Main Python package (LSP server source code)
│   ├── __init__.py           # Package init with feature overview
│   ├── server.py             # LSP server entry point and protocol handlers
│   ├── parser.py             # CK3 script parser, converts text to AST
│   ├── utils.py              # Shared utility functions
│   │
│   │   # Core LSP Features
│   ├── diagnostics.py        # Error detection and validation coordination
│   ├── completions.py        # Context-aware auto-completion provider
│   ├── hover.py              # Hover documentation for effects/triggers/scopes
│   ├── navigation.py         # Go-to definition and find references
│   ├── symbols.py            # Document outline and breadcrumb navigation
│   ├── formatting.py         # Document formatting to Paradox conventions
│   ├── code_actions.py       # Quick fixes and refactoring actions
│   ├── code_lens.py          # Inline actionable info (reference counts, etc.)
│   ├── document_highlight.py # Highlight all occurrences of a symbol
│   ├── document_links.py     # Clickable links for file paths, URLs, event IDs
│   ├── folding.py            # Code folding for blocks and events
│   ├── inlay_hints.py        # Inline type annotations for scopes
│   ├── rename.py             # Workspace-wide symbol renaming
│   ├── semantic_tokens.py    # Context-aware syntax highlighting tokens
│   ├── signature_help.py     # Parameter hints for effects/triggers
│   │
│   │   # Schema-Driven Validation System
│   ├── schema_loader.py      # YAML schema loading and inheritance resolution
│   ├── schema_validator.py   # Schema-based validation engine
│   ├── schema_completions.py # Schema-aware auto-completions
│   ├── schema_hover.py       # Schema-based hover documentation
│   ├── schema_symbols.py     # Schema-driven document symbols
│   ├── generic_rules_validator.py  # Generic validation rules engine
│   │
│   │   # CK3 Game Logic Validation
│   ├── ck3_language.py       # CK3 language definitions (keywords, effects, triggers)
│   ├── effect_trigger_docs.py # Effect and trigger documentation
│   ├── events.py             # Event validation and processing
│   ├── scopes.py             # Scope type tracking and validation
│   ├── scope_timing.py       # "Golden Rule" validation (immediate vs trigger timing)
│   ├── script_values.py      # Script value and formula validation
│   ├── scripted_blocks.py    # Scripted triggers/effects validation
│   ├── lists.py              # List iterator validation (any_*, every_*, etc.)
│   ├── variables.py          # Variable system validation (var:, local_var:, global_var:)
│   ├── traits.py             # Trait validation and lookups
│   ├── story_cycles.py       # Story cycle validation
│   │
│   │   # Code Quality & Style
│   ├── paradox_checks.py     # Paradox convention and common pitfall validation
│   ├── style_checks.py       # Code style validation (indentation, whitespace)
│   ├── localization.py       # Localization syntax and reference validation
│   │
│   │   # Workspace & Indexing
│   ├── workspace.py          # Cross-file validation and mod descriptor parsing
│   ├── indexer.py            # Cross-file symbol indexing
│   │
│   │   # Game Log Integration
│   ├── log_watcher.py        # Real-time game log monitoring
│   ├── log_analyzer.py       # Game log parsing and analysis
│   ├── log_diagnostics.py    # Diagnostics from game log errors
│   │
│   ├── documents/            # Architecture documentation
│   │   └── ARCHITECTURE_FLOW.md  # System flow documentation
│   │
│   └── data/                 # Static data files for CK3 game definitions
│       ├── __init__.py       # Data loader for YAML game definitions
│       ├── game_structure.yaml   # CK3 folder/file structure mapping
│       ├── diagnostics.yaml      # Diagnostic message definitions
│       │
│       ├── schemas/          # Content type validation schemas (YAML)
│       │   ├── _base.yaml        # Base schema definitions and inheritance
│       │   ├── _types.yaml       # Reusable type definitions
│       │   ├── events.yaml       # Event file schema
│       │   ├── decisions.yaml    # Decision file schema
│       │   ├── character_interactions.yaml  # Interaction schema
│       │   ├── on_actions.yaml   # On-action hook schema
│       │   ├── schemes.yaml      # Scheme file schema
│       │   ├── story_cycles.yaml # Story cycle schema
│       │   └── generic_rules.yaml # Generic validation rules
│       │
│       ├── scopes/           # Scope type definitions (YAML)
│       │   ├── character.yaml    # Character scope links and operations
│       │   ├── province.yaml     # Province scope links and operations
│       │   └── title.yaml        # Landed title scope links and operations
│       │
│       ├── effects/          # Effect definitions
│       │   └── effects.yaml      # All game effects with signatures
│       │
│       ├── triggers/         # Trigger definitions
│       │   └── triggers.yaml     # All game triggers with signatures
│       │
│       └── traits/           # Trait definitions by category
│           ├── childhood.yaml    # Childhood traits
│           ├── education.yaml    # Education traits
│           ├── fame.yaml         # Fame/legacy traits
│           ├── health.yaml       # Health-related traits
│           ├── lifestyle.yaml    # Lifestyle traits
│           ├── personality.yaml  # Personality traits
│           └── special.yaml      # Special/unique traits
│
├── vscode-extension/         # VS Code extension (TypeScript)
│   ├── src/                  # Extension source code
│   ├── syntaxes/             # TextMate grammars for syntax highlighting
│   ├── snippets/             # Code snippets for common patterns
│   ├── test-workspace/       # Test workspace for extension development
│   ├── package.json          # Extension manifest
│   ├── tsconfig.json         # TypeScript configuration
│   └── webpack.config.js     # Build configuration
│
├── tests/                    # Unit and integration tests
│   ├── conftest.py           # Pytest configuration and fixtures
│   ├── fixtures/             # Test fixture files
│   ├── integration/          # Integration tests
│   ├── performance/          # Performance benchmarks
│   ├── regression/           # Regression test cases
│   ├── fuzzing/              # Fuzz testing
│   └── test_*.py             # Test modules (one per source module)
│
├── example mod/              # Example CK3 mod for testing
│   ├── descriptor.mod        # Mod descriptor
│   ├── common/               # Common game files
│   ├── events/               # Event files
│   ├── localization/         # Localization files
│   └── ...                   # Other mod directories
│
├── docs/                     # User documentation
│   ├── SCHEMA_AUTHORING_GUIDE.md  # How to write schemas
│   ├── VALIDATION.md         # Validation system docs
│   └── PRE_COMMIT_*.md       # Pre-commit hook guides
│
├── Documentation/            # Developer documentation
│   ├── feature_matrix.md     # Feature implementation status
│   └── diagnostics/          # Diagnostic documentation
│
├── plan docs/                # Project planning documents
├── tools/                    # Development and setup scripts
│   ├── extract_traits.py     # Trait extraction utility
│   ├── Install-Prerequisites.ps1  # Windows setup script
│   └── setup-dev-env.sh      # Unix setup script
│
├── pyproject.toml            # Python project configuration
├── README.md                 # Project readme
├── CHANGELOG.md              # Version history
├── CONTRIBUTING.md           # Contribution guidelines
├── SECURITY.md               # Security policy
└── LICENSE                   # License file
```

## Documentation Requirements

- Include docstrings for all Python modules, classes, and functions.
- Include JSDoc/TSDoc comments for TypeScript code.
- Document complex functions with clear examples.
- Maintain concise Markdown documentation.
- Minimum docblock info: `param`, `return`, `raises`/`throws`

## Security Considerations

- Sanitize all user inputs thoroughly.
- Validate file paths to prevent directory traversal.
- Handle untrusted script content safely during parsing.
- Implement proper error boundaries to prevent crashes.
- Log errors without exposing sensitive information.
