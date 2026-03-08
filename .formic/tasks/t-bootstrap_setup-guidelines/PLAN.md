# Setup AI Development Guidelines - Implementation Plan

## Status
**PENDING** - Plan created, implementation to begin.

## Context
Audit the pychivalry codebase—a TypeScript VS Code extension with an embedded CK3 language server—and produce a `kanban-development-guideline.md` capturing the project's tech stack, architecture, coding standards, testing strategy, and forbidden practices as a single-source-of-truth for AI-assisted development.

## Implementation Overview

### Phase 1: Codebase Audit
Systematically read and extract information from configuration files (`package.json`, `.pre-commit-config.yaml`, `Taskfile.yml`, `webpack.config.js`, `tsconfig.json`, ESLint/Prettier configs), existing guidelines (`.github/copilot-instructions.md`, `CONTRIBUTING.md`), CI workflows, and the source tree structure to build an accurate picture of conventions, dependencies, and patterns.

### Phase 2: Document Authoring
Write the seven required sections of `kanban-development-guideline.md` using only verified facts from Phase 1: Project Overview, Architectural Patterns, Coding Standards, Preferred Libraries & Tools, Development Workflow, Build & Test Commands, and Forbidden Practices.

### Phase 3: Verification
Cross-check that every file path, dependency version, and convention cited in the guideline exists in the actual codebase. Ensure no source code, configs, or project structure are modified.

## Key Milestones
- All configuration and guideline source files audited and key facts recorded
- Complete `kanban-development-guideline.md` draft written to workspace root
- Verification pass confirms all references match the live codebase

## Success Criteria
- `kanban-development-guideline.md` exists at `/home/cwallace/git/pychivalry/kanban-development-guideline.md`
- Document contains all 7 required sections with accurate, codebase-derived content
- All dependency versions match `package.json` and config files
- All file paths and architectural descriptions match the actual source tree
- No source code, configuration files, or project structure was modified
