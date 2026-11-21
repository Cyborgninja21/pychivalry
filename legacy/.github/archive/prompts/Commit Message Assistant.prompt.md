# Git Commit Message Assistant

When the user asks for help creating a commit message or committing changes, follow this structured format:

## Commit Workflow

1. **Stage and review changes:**
   ```bash
   git add -A && git status
   ```

2. **Create structured commit message** using conventional commit format:

## Commit Message Format

```
type: Brief summary (Phase X if applicable)

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

Next: [What comes next in the project plan]
```

## Type Prefixes

- `feat:` - New feature or functionality
- `fix:` - Bug fix
- `refactor:` - Code restructuring without changing behavior
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks (dependencies, build config, etc.)

## Structure Requirements

1. **Summary line:** Clear, concise description (50-72 chars) with phase number if part of a plan
2. **Body:** Organized bullet list with hierarchical structure:
   - Use `-` for major categories
   - Use `*` for implementation details under each category
   - Use `-` for sub-items under implementation details
3. **Footer:** "Next:" statement indicating upcoming work

## Example

When user asks to commit, generate something like:

```bash
git commit -m "feat: Add scope validation system (Phase 2)

- Scope tracking and validation
  * Implemented scope chain traversal with context preservation
  * Added support for all CK3 scope types (character, title, province, etc.)
  * Key validation features:
    - Effect and trigger scope compatibility checking
    - Invalid scope transition detection
    - Scope narrowing warnings
- Diagnostic integration
  * Enhanced diagnostics.py with scope error reporting
  * Added inline error messages with fix suggestions
- Implementation notes
  * Used dataclasses for scope context management
  * Integrated with existing parser AST structure
- Error handling additions
  * Added graceful fallback for unknown scope types
  * Enhanced error messages with scope chain context

Next: Implement code actions for automatic scope fixes"
```

## Guidelines

- Be specific with implementation details
- Use active voice in present tense ("Add" not "Added" or "Adds")
- Group related changes by functional area
- Include context about why changes were made if not obvious
- Keep the "Next:" footer to maintain project momentum
