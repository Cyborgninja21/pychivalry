# Documentation Prompts

This directory contains reference documentation for maintaining code quality and understanding the pychivalry architecture.

## Files

### `documentation_standard.md`
**Purpose**: Defines the comprehensive documentation standard for all Python files in pychivalry.

**Use this when**:
- Writing new modules
- Refactoring existing code
- Reviewing pull requests
- Onboarding new contributors

**Key sections**:
- Module docstring template with diagnostic codes
- Function documentation standards
- Inline comment guidelines
- Class/dataclass documentation patterns
- Examples of excellent documentation

### `architecture_and_flow.md`
**Purpose**: Explains the system architecture, module interactions, and data flow through the language server.

**Use this when**:
- Understanding how modules work together
- Planning new features
- Debugging cross-module issues
- Learning the codebase

**Key sections**:
- Module categorization (Foundation, Validation, LSP, Features, etc.)
- Request flow examples (completion, diagnostics, hover)
- Critical dependencies and relationships
- Performance considerations
- Documentation priority order

## Quick Start

### For New Contributors
1. Read `architecture_and_flow.md` to understand the system
2. Review `documentation_standard.md` for code style
3. Look at completed files (scopes.py, lists.py, data/__init__.py) as examples

### For Documentation Work
1. Use `documentation_standard.md` as template
2. Reference `architecture_and_flow.md` for module relationships
3. Follow the established diagnostic code pattern (MODULE-XXX)

### For Feature Development
1. Check `architecture_and_flow.md` for where your feature fits
2. Identify dependencies and interactions
3. Document following `documentation_standard.md`

## Documentation Status

**Completed** (5/32 files - 16%):
- ✅ `__init__.py` - Package initialization
- ✅ `data/__init__.py` - Data loading
- ✅ `scopes.py` - Scope validation
- ✅ `parser.py` - AST parsing (partial)
- ✅ `lists.py` - List iterator validation

**In Progress** (27/32 files - 84%):
- See `architecture_and_flow.md` for priority order
- Critical: server.py, indexer.py, diagnostics.py, completions.py
- High: semantic_tokens.py, hover.py, navigation.py, ck3_language.py
- Medium: All other feature implementations
- Lower: Supporting utilities and specialized validators

## Maintenance

These prompt files should be updated when:
- New modules are added
- Architecture patterns change
- Documentation standards evolve
- New diagnostic code categories are introduced

## AI Assistant Usage

These files are designed to be used as context for AI coding assistants:
- Load both files as context when working on pychivalry code
- Reference specific sections for targeted work
- Use as templates for generating new documentation
- Follow patterns for consistency across the codebase

## Contributing

When updating these prompts:
1. Keep language clear and concise
2. Include concrete examples
3. Update "Last Updated" date
4. Maintain consistency with actual code
5. Cross-reference between documents

## Contact

For questions about documentation standards or architecture:
- Check existing documented files as examples
- Review GitHub issues and discussions
- See CONTRIBUTING.md in repository root
