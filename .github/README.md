# GitHub Copilot Configuration

This directory contains configuration files for GitHub Copilot to provide AI-assisted development for the pychivalry project.

## 📋 Overview

The `.github` directory is structured to help Copilot understand:
- **Project conventions** and coding standards
- **Development workflows** and best practices
- **Specialized tasks** through custom prompts and skills
- **Architecture patterns** and module relationships

## 📁 Directory Structure

```
.github/
├── README.md                    # This file - Copilot setup documentation
├── copilot-instructions.md      # Main Copilot instructions and guidelines
├── prompts/                     # Custom prompt files for specific tasks
│   ├── README.md                # Prompts directory documentation
│   ├── architecture_and_flow.md # System architecture and data flow
│   ├── documentation_standard.md # Code documentation standards
│   ├── Branch Creation Assistant.prompt.md
│   ├── Commit Message Assistant.prompt.md
│   └── [other prompts...]       # GitHub CLI helpers, version updates, etc.
├── skills/                      # Custom Copilot skills
│   ├── github-actions-failure-debugging # CI/CD debugging guide
│   └── tool-list.md             # Available development tools
└── workflows/                   # GitHub Actions CI/CD workflows
```

## 🎯 Key Components

### 1. `copilot-instructions.md`

The main instruction file that Copilot automatically reads. Contains:
- **Operational Guidelines**: Prime directives for code editing
- **Development Environment**: Available tools (Python, Node.js, Git, GitHub CLI)
- **Python Requirements**: Type hints, async/await, testing with pytest
- **TypeScript Requirements**: VS Code extension standards
- **Project Structure**: Complete folder layout and file purposes
- **Documentation Standards**: Docstring requirements
- **Security Considerations**: Input sanitization, error handling

### 2. `prompts/` Directory

Custom prompt files for specialized tasks:

#### Architecture Documentation
- `architecture_and_flow.md` - System architecture, module interactions, data flow
- `ascii_art_architecture_documentation.md` - Visual architecture diagrams
- `documentation_standard.md` - Code documentation templates and standards

#### Development Assistants
- `Branch Creation Assistant.prompt.md` - Git branching workflows
- `Branch Merge Assistant.prompt.md` - Merge conflict resolution
- `Commit Message Assistant.prompt.md` - Conventional commit format
- `Version Update Assistant.prompt.md` - Semantic versioning updates

#### GitHub CLI Integration
- `gh issue create.prompt.md` - Creating issues
- `gh issue edit.prompt.md` - Editing issues
- `gh issue list.prompt.md` - Listing and filtering issues
- `gh pr create.prompt.md` - Creating pull requests
- `gh pr view.prompt.md` - Viewing pull request details
- `gh pr review.prompt.md` - Code review workflow
- `gh pr merge.prompt.md` - Merging pull requests
- `gh pr checks.prompt.md` - CI/CD check status
- `gh run list.prompt.md` - Workflow run listing
- `gh run view.prompt.md` - Workflow run details
- `gh run rerun.prompt.md` - Re-running failed workflows
- `gh release delete.prompt.md` - Release management

### 3. `skills/` Directory

Specialized skills for common tasks:
- `github-actions-failure-debugging` - Step-by-step CI/CD debugging workflow
- `tool-list.md` - Comprehensive list of development tools and their usage

## 🚀 How to Use

### For Copilot Chat

1. **Ask about project conventions**:
   ```
   @workspace What are the Python coding standards for this project?
   ```

2. **Use specialized prompts**:
   ```
   @workspace /prompts/documentation_standard.md Help me document this module
   ```

3. **Debug CI failures**:
   ```
   @workspace The GitHub Actions workflow failed. Can you help debug it?
   ```
   (Copilot will automatically use the `github-actions-failure-debugging` skill)

4. **Create proper commits**:
   ```
   @workspace Help me write a commit message for these changes
   ```
   (Uses `Commit Message Assistant.prompt.md`)

### For Copilot Coding Agent

When Copilot Coding Agent works on issues:
- Automatically reads `copilot-instructions.md` for guidelines
- Uses relevant prompts from `prompts/` directory
- Follows project structure defined in instructions
- Applies coding standards and best practices

### For Contributors

1. **Read the guidelines** in `copilot-instructions.md` to understand:
   - Code formatting (Black, flake8, mypy)
   - Type hint requirements
   - Testing patterns (pytest, pytest-asyncio)
   - Documentation standards

2. **Reference prompt files** when:
   - Writing new modules (use `documentation_standard.md`)
   - Understanding architecture (use `architecture_and_flow.md`)
   - Creating branches or commits (use assistant prompts)
   - Working with GitHub CLI (use gh command prompts)

3. **Add new prompts** if you create reusable patterns or workflows

## 📝 Maintaining This Setup

### When to Update `copilot-instructions.md`

- Adding new development tools or dependencies
- Changing coding standards or style guidelines
- Updating project structure or folder organization
- Modifying build, test, or deployment processes
- Adding new technology stacks or frameworks

### When to Add New Prompts

Create a new prompt file in `prompts/` when you:
- Establish a repeatable workflow or pattern
- Create documentation templates
- Define specialized task procedures
- Build GitHub CLI command helpers

**Naming convention**: `[Tool/Topic] [Action].prompt.md`

Example: `gh pr merge.prompt.md`, `Testing Strategy.prompt.md`

### When to Add New Skills

Create a new skill in `skills/` when you:
- Develop a multi-step debugging procedure
- Create specialized tool workflows
- Build domain-specific task guides

**Format**: YAML frontmatter + markdown content

```yaml
---
name: skill-name
description: Brief description of what this skill does
---

Step-by-step instructions...
```

## 🔗 Integration with Project Documentation

This Copilot setup complements:
- [`../README.md`](../README.md) - Project overview and quick start
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) - Contribution guidelines
- [`../SECURITY.md`](../SECURITY.md) - Security policy
- [`../plan docs/`](../plan%20docs/) - Detailed planning documents

## 📚 Resources

- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Best Practices for Copilot in Repositories](https://gh.io/copilot-coding-agent-tips)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [pygls Documentation](https://pygls.readthedocs.io/)

## ✅ Checklist for New Contributors

- [ ] Read `copilot-instructions.md` to understand project standards
- [ ] Review `prompts/architecture_and_flow.md` to understand the system
- [ ] Check `prompts/documentation_standard.md` for code documentation patterns
- [ ] Set up pre-commit hooks (see `../CONTRIBUTING.md`)
- [ ] Install development dependencies: `pip install -e ".[dev]"`

## 🤝 Contributing to This Setup

If you improve the Copilot setup:
1. Update relevant files in `.github/`
2. Update this README if structure changes
3. Test with Copilot to ensure guidelines work
4. Document new patterns or workflows
5. Submit a pull request with clear descriptions

---

*This Copilot configuration helps maintain high code quality and consistent development practices across the pychivalry project.*
