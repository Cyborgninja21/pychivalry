# Branch Merge Back to Main Assistant

When the user asks for help merging a feature branch back into main, follow this structured workflow:

## Pre-Merge Checklist

Before merging, verify:

- [ ] All tests pass
- [ ] Code has been reviewed (if applicable)
- [ ] Branch is up to date with main
- [ ] No merge conflicts exist
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated (if applicable)

## Merge Workflow

### 1. **Ensure branch is up to date**

```bash
# Switch to main and pull latest changes
git checkout main
git pull origin main

# Switch back to feature branch
git checkout <feature-branch>

# Merge main into feature branch (resolve conflicts if any)
git merge main
```

### 2. **Run final checks**

```bash
# Run tests
pytest tests/ -v

# Run linters
flake8 pychivalry/
mypy pychivalry/

# Build extension (if applicable)
npm run compile --prefix vscode-extension/
```

### 3. **Switch to main and merge**

```bash
# Switch to main branch
git checkout main

# Merge feature branch (no fast-forward for clear history)
git merge --no-ff <feature-branch> -m "Merge branch '<feature-branch>'"
```

### 4. **Push to remote**

```bash
# Push merged changes
git push origin main
```

### 5. **Clean up (optional)**

```bash
# Delete local branch
git branch -d <feature-branch>

# Delete remote branch
git push origin --delete <feature-branch>
```

## Merge Commit Message Format

When merging with `--no-ff`, use this format:

```
Merge branch '<feature-branch>' into main

Summary: [One-line description of what the branch accomplished]

Major Changes:
- [Category 1]
  * Implementation detail
  * Implementation detail
- [Category 2]
  * Implementation detail
  * Implementation detail

Features Added:
- [Feature 1]: Description
- [Feature 2]: Description

Fixes:
- [Fix 1]: Description
- [Fix 2]: Description

Breaking Changes: [None/List any breaking changes]

Related Issues: #[issue-number], #[issue-number]
```

## Example Merge Scenarios

### Feature Branch with Multiple Commits

```bash
git checkout main
git pull origin main
git merge --no-ff feature/scope-validation -m "Merge branch 'feature/scope-validation' into main

Summary: Complete implementation of scope validation system for CK3 script analysis

Major Changes:
- Scope validation engine
  * Full scope chain tracking and traversal
  * Support for all CK3 scope types (character, title, province, faith, culture)
  * Context-aware scope transition validation
- Diagnostic integration
  * Enhanced error reporting with scope context
  * Inline fix suggestions for invalid scope transitions
  * Performance optimized for large codebases

Features Added:
- Scope chain visualization in hover tooltips
- Real-time scope error detection
- Automatic scope narrowing warnings

Fixes:
- Resolved false positives in nested scope contexts
- Fixed memory leak in scope cache management

Breaking Changes: None

Related Issues: #42, #38, #29"
```

### Hotfix Branch

```bash
git checkout main
git merge --no-ff hotfix/parser-crash -m "Merge branch 'hotfix/parser-crash' into main

Summary: Emergency fix for parser crash on malformed event files

Fixes:
- Parser crash when encountering unexpected EOF
- Null reference exception in AST node validation
- Memory leak in error recovery handler

Testing: All existing tests pass + added regression tests

Related Issues: #156"
```

## Handling Merge Conflicts

If conflicts occur during merge:

```bash
# After git merge shows conflicts
git status  # View conflicted files

# Edit conflicted files manually, or use merge tool
git mergetool

# After resolving conflicts
git add <resolved-files>
git commit  # Complete the merge

# Verify resolution
git log --oneline --graph -10
```

## Post-Merge Actions

1. **Verify merge success:**

   ```bash
   git log --oneline --graph -10
   git show HEAD
   ```

2. **Tag release if appropriate:**

   ```bash
   git tag -a v1.2.0 -m "Release version 1.2.0"
   git push origin v1.2.0
   ```

3. **Update project documentation:**

   - Update CHANGELOG.md with release notes
   - Update README.md if features changed
   - Update version numbers in pyproject.toml, package.json

4. **Notify team:**
   - Post merge announcement
   - Update project board/issues
   - Document any deployment steps

## Guidelines

- Always use `--no-ff` for feature branches to maintain clear history
- Write descriptive merge messages summarizing branch work
- Keep main branch stable - only merge tested, reviewed code
- Update CHANGELOG.md before or immediately after merging
- Consider squashing commits for cleaner history on small branches
- Tag important merges with version numbers

## Troubleshooting

### Merge conflicts

- Always merge main into feature first, resolve conflicts there
- Test thoroughly after conflict resolution
- Consider rebasing for cleaner history (with caution on shared branches)

### Failed tests after merge

- Revert merge: `git reset --hard HEAD~1`
- Fix issues in feature branch
- Retry merge process

### Accidentally fast-forwarded

- Reset: `git reset --hard HEAD~1`
- Re-merge with `--no-ff` flag
