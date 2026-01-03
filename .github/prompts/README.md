# Documentation Prompts

This directory contains reference documentation for maintaining code quality, understanding the pychivalry architecture, and specialized development guides.

## Files

### Core Documentation

#### `documentation_standard.md`
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

#### `architecture_and_flow.md`
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

### LSP Development Guides

#### `LSP Feature Implementation.prompt.md`
**Purpose**: Step-by-step guide for implementing new Language Server Protocol features.

**Use this when**:
- Adding new LSP capabilities (completions, hover, code actions, etc.)
- Understanding the LSP implementation pattern
- Integrating with the VS Code extension

**Key sections**:
- LSP specification overview
- Feature module structure
- Handler registration
- Testing patterns
- Common implementation patterns

#### `Debugging LSP Server Issues.prompt.md`
**Purpose**: Comprehensive troubleshooting guide for LSP server problems.

**Use this when**:
- Server not starting or crashing
- Features not working correctly
- Performance issues
- Communication problems between client and server

**Key sections**:
- Quick diagnostics checklist
- Common issues and solutions
- Debugging tools (profiling, logging, inspection)
- Testing approaches

#### `Adding New CK3 Language Features.prompt.md`
**Purpose**: Guide for adding support for new CK3 scripting language elements.

**Use this when**:
- Adding new CK3 effects, triggers, or scopes
- Supporting new game version features
- Expanding language definitions

**Key sections**:
- Language element types (keywords, effects, triggers, scopes)
- Definition patterns
- Validation implementation
- Testing checklist

#### `Test Writing Best Practices.prompt.md`
**Purpose**: Patterns and guidelines for writing high-quality pytest tests.

**Use this when**:
- Writing new tests
- Improving test coverage
- Refactoring existing tests
- Learning testing patterns

**Key sections**:
- Unit test structure
- Async test patterns
- Fixtures and parametrization
- Integration testing
- Performance testing

#### `VS Code Extension Packaging.prompt.md`
**Purpose**: Complete guide for packaging and distributing the VS Code extension.

**Use this when**:
- Creating releases
- Publishing to marketplace
- Distributing the extension
- Managing versions

**Key sections**:
- Pre-packaging checklist
- VSIX creation process
- Marketplace publishing
- GitHub releases
- Version management

### Git Workflow Assistants

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
