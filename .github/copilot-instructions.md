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
- **Node.js 18+**: Primary runtime for the language server and extension
- **npm**: Package manager for all dependencies
- **TypeScript 5.0+**: Primary language for all code

## General Requirements

Use TypeScript for all code. Prioritize clean, maintainable code with appropriate comments.



## TypeScript Requirements

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
pychivalry/                          # Project root
├── .github/                         # GitHub & AI configuration
│   ├── copilot-instructions.md      # AI assistant guidelines (this file)
│   ├── agents/                      # CK3 specialist agents (13 agent definitions)
│   ├── prompts/                     # Reusable context prompts (27 files)
│   ├── skills/                      # Debugging & workflow skills (7 skill areas)
│   └── workflows/                   # GitHub Actions CI/CD
│       └── ci.yml                   # Automated testing & releases
│
├── data/                            # Game definition data (YAML format)
│   ├── animations.yaml              # CK3 animation definitions
│   ├── diagnostics.yaml             # Error/warning message definitions
│   ├── game_structure.yaml          # CK3 folder/file structure mapping
│   ├── interaction_hooks.yaml       # Character interaction hooks
│   ├── modifier_types.yaml          # In-game modifier types
│   ├── on_actions.yaml              # On-action trigger definitions
│   ├── scope_accessors.yaml         # Scope accessor chains
│   ├── scriptable_directories.yaml  # Scriptable game directories
│   ├── concepts/                    # Game concepts & categories
│   ├── effects/                     # Game effects with signatures
│   │   └── effects.yaml
│   ├── icons/                       # Icon definitions (5,452 references)
│   ├── mods/                        # Mod registry & Carnalitas integration
│   ├── schemas/                     # Content type validation schemas (35 files)
│   │   ├── _base.yaml               # Base schema definitions
│   │   ├── _types.yaml              # Reusable type definitions
│   │   ├── events.yaml              # Event file schema
│   │   ├── decisions.yaml           # Decision file schema
│   │   └── ...                      # 30+ additional content type schemas
│   ├── scopes/                      # Scope type definitions (15 files)
│   │   ├── character.yaml           # Character scope chains
│   │   ├── province.yaml            # Province scope chains
│   │   ├── title.yaml               # Landed title scope chains
│   │   └── ...                      # 12 additional scope types
│   ├── traits/                      # Trait definitions by category (7 files)
│   │   ├── personality.yaml
│   │   ├── education.yaml
│   │   └── ...
│   └── triggers/                    # Game triggers with signatures
│       └── triggers.yaml
│
├── vscode-extension/                # VS Code extension & LSP server (TypeScript)
│   ├── package.json                 # Extension manifest & dependencies
│   ├── tsconfig.json                # TypeScript configuration
│   ├── webpack.config.js            # Build configuration
│   ├── .eslintrc.json               # Linting rules
│   ├── .prettierrc                  # Code formatting
│   ├── syntaxes/                    # TextMate grammars for syntax highlighting
│   ├── snippets/                    # Code snippets for common patterns
│   │
│   └── src/                         # TypeScript source code
│       ├── extension.ts             # Extension entry point (client side)
│       ├── server-main.ts           # LSP server launcher
│       ├── statusBar.ts             # Status bar integration
│       ├── logger.ts                # Client-side logging
│       │
│       ├── server/                  # LSP server implementation
│       │   ├── server.ts            # Main server init & protocol handlers
│       │   │
│       │   ├── core/                # Core infrastructure (8 files)
│       │   │   ├── parser.ts        # CK3 script parser (AST generation)
│       │   │   ├── incremental-parser.ts  # Optimized incremental parsing
│       │   │   ├── indexer.ts       # Symbol indexing
│       │   │   ├── indexer-enhanced.ts    # Enhanced indexing features
│       │   │   ├── workspace.ts     # Workspace management
│       │   │   ├── workspace-enhanced.ts  # Enhanced workspace features
│       │   │   ├── call-graph.ts    # Call graph analysis
│       │   │   └── localization-index.ts  # Localization indexing
│       │   │
│       │   ├── lsp/                 # LSP protocol handlers (17 files)
│       │   │   ├── completions.ts   # Auto-completion
│       │   │   ├── hover.ts         # Hover information
│       │   │   ├── navigation.ts    # Go-to-definition, find references
│       │   │   ├── symbols.ts       # Document outline
│       │   │   ├── diagnostics.ts   # Diagnostic aggregator
│       │   │   ├── semantic-tokens.ts    # Syntax highlighting
│       │   │   ├── code-actions.ts  # Quick fixes, refactoring
│       │   │   ├── code-lens.ts     # Inline actionable info
│       │   │   ├── formatting.ts    # Document formatting
│       │   │   ├── folding.ts       # Code folding
│       │   │   ├── rename.ts        # Workspace renaming
│       │   │   ├── inlay-hints.ts   # Inline hints
│       │   │   ├── signature-help.ts     # Parameter hints
│       │   │   ├── document-highlight.ts # Highlight occurrences
│       │   │   ├── document-links.ts     # Clickable links
│       │   │   ├── selection-range.ts    # Smart selection
│       │   │   └── call-hierarchy.ts     # Call hierarchy
│       │   │
│       │   ├── schema/              # Schema system (5 files)
│       │   │   ├── loader.ts        # Load & resolve YAML schemas
│       │   │   ├── validator.ts     # Schema-based validation engine
│       │   │   ├── completions.ts   # Schema-aware completions
│       │   │   ├── hover.ts         # Schema-based hover docs
│       │   │   └── symbols.ts       # Schema-driven symbol extraction
│       │   │
│       │   ├── ck3/                 # CK3-specific game logic
│       │   │   ├── language.ts      # Keywords, effects, triggers, scopes
│       │   │   ├── validation/      # Game validators (28 files)
│       │   │   │   ├── diagnostics.ts    # Validation coordinator
│       │   │   │   ├── scopes.ts         # Scope validation
│       │   │   │   ├── scope-timing.ts   # Scope timing rules
│       │   │   │   ├── events.ts         # Event validation
│       │   │   │   ├── traits.ts         # Trait validation
│       │   │   │   └── ...               # 23 additional validators
│       │   │   └── localization/    # Localization subsystem (3 files)
│       │   │       ├── validator.ts # Localization syntax validation
│       │   │       ├── concepts.ts  # Game concept validation
│       │   │       └── icons.ts     # Icon reference validation
│       │   │
│       │   ├── log/                 # Game log integration (3 files)
│       │   │   ├── watcher.ts       # Real-time log monitoring
│       │   │   ├── analyzer.ts      # Log pattern matching
│       │   │   └── diagnostics.ts   # Convert log to LSP diagnostics
│       │   │
│       │   ├── data/                # Data loading (3 files)
│       │   │   ├── loader.ts        # YAML data loader (singleton)
│       │   │   ├── directory-registry.ts  # Scriptable directory registry
│       │   │   └── mod-scanner.ts   # Mod detection and scanning
│       │   │
│       │   └── utils/               # Utilities (3 files)
│       │       ├── logger.ts        # Server-side logging
│       │       ├── uri.ts           # URI/path utilities
│       │       └── fuzzy-match.ts   # Fuzzy string matching
│       │
│       └── test/                    # Tests (Mocha + TypeScript)
│           ├── runTest.ts           # Test runner
│           ├── suite/               # Integration test suites
│           └── unit/                # Unit tests
│
├── tools/                           # Development & automation scripts
│   ├── merge-keywords.js            # Merge keywords from pdx-parser-re
│   ├── extract-traits.ts            # Trait extraction from CK3 game files
│   ├── extract-effects.ts           # Effect extraction
│   ├── extract-triggers.ts          # Trigger extraction
│   ├── extract-on-actions.ts        # On-action extraction
│   ├── extract-themes.ts            # Event theme extraction
│   ├── extract-backgrounds.ts       # Event background extraction
│   ├── extract-scopes.ts            # Scope accessor extraction
│   ├── lib/                         # Shared extraction utilities
│   │   └── extractor-utils.ts       # CK3 file parser, YAML writer
│   ├── Check-Prerequisites.ps1      # Windows environment check
│   ├── Install-Prerequisites.ps1    # Windows setup script
│   └── setup-dev-env.sh             # Unix setup script
│
├── example mod/                     # Example CK3 mod for testing
│   ├── descriptor.mod               # Mod descriptor
│   ├── 01_syntax/ ... 14_*/         # Organized test scenarios
│   └── README.md
│
├── Documentation/                   # All project documentation (consolidated)
│   ├── README.md                    # Documentation index
│   ├── PRD.md                       # Product requirements document
│   ├── archive/                     # Historical planning docs
│   ├── ck3-reference/               # CK3 game reference materials
│   ├── developer-guide/             # Developer documentation
│   │   ├── architecture/            # Architecture docs
│   │   └── ...                      # Pre-commit guides, test suites
│   ├── schemas/                     # Schema authoring guides
│   ├── user-guide/                  # User-facing documentation
│   │   ├── feature_matrix.md        # Feature implementation status
│   │   └── diagnostics/             # Diagnostic code documentation
│   └── examples/                    # Documentation examples
│
├── README.md                        # Project readme
├── CHANGELOG.md                     # Version history
├── CONTRIBUTING.md                  # Contribution guidelines
├── SECURITY.md                      # Security policy
├── Taskfile.yml                     # Task runner definitions
├── package.json                     # Root package (devDependencies only)
└── LICENSE                          # License file
```

## Documentation Requirements

### Code Documentation
- Include JSDoc/TSDoc comments for TypeScript code.
- Document complex functions with clear examples.
- Minimum docblock info: `param`, `return`, `throws`

### Folder Documentation Rule
**ONE README.md per folder hierarchy.** Each major folder should have exactly one `README.md` that documents:
- The folder's purpose and contents
- How the files within relate to each other
- Any conventions specific to that folder

Do NOT create additional markdown files to summarize changes or document individual features within a folder. Keep documentation consolidated:
- Use `Documentation/` for all project documentation
- Use `Documentation/archive/` for historical planning docs
- Do NOT create docs in `vscode-extension/` or code folders (except folder-specific README.md files for data directories)

### New Documentation Rule
**ALL new documentation MUST be placed in the `Documentation/` folder.** When creating any new markdown documentation:
- Place feature docs in `Documentation/developer-guide/` or `Documentation/user-guide/`
- Place schema docs in `Documentation/schemas/`
- Place planning/historical docs in `Documentation/archive/`
- Place CK3 reference materials in `Documentation/ck3-reference/`
- NEVER create documentation files in the project root or `vscode-extension/` folders
- Exception: README.md files for folder navigation and standard root files (CHANGELOG.md, CONTRIBUTING.md, SECURITY.md)

## Security Considerations

- Sanitize all user inputs thoroughly.
- Validate file paths to prevent directory traversal.
- Handle untrusted script content safely during parsing.
- Implement proper error boundaries to prevent crashes.
- Log errors without exposing sensitive information.
