```prompt
# gh pr merge - Merge Pull Request Assistant

When the user asks for help merging pull requests, follow this structured workflow:

## Merging Pull Requests

The `gh pr merge` command allows you to merge PRs with different strategies directly from the command line.

## Basic Usage

### Interactive Merge (Recommended)

```bash
# Merge interactively - prompts for strategy
gh pr merge 42
```

Prompts will ask for:
- Merge strategy (merge, squash, rebase)
- Whether to delete branch
- Confirmation

## Merge Strategies

### 1. **Squash Merge (Recommended for Features)**

```bash
# Squash all commits into one
gh pr merge 42 --squash

# Squash with custom commit message
gh pr merge 42 --squash --body "feat: Add scope validation

Complete implementation of scope tracking and validation system.

Closes #42"
```

**When to use**:
- Feature branches with many WIP commits
- Want clean main branch history
- Standard for most projects

### 2. **Merge Commit (Preserves History)**

```bash
# Create merge commit
gh pr merge 42 --merge

# Merge with custom message
gh pr merge 42 --merge --body "Merge feature/scope-validation

Adds comprehensive scope validation system."
```

**When to use**:
- Want to preserve commit history
- Multiple developers collaborated
- Important to track individual commits

### 3. **Rebase Merge (Linear History)**

```bash
# Rebase and merge
gh pr merge 42 --rebase
```

**When to use**:
- Want linear history without merge commits
- Small PRs with clean commits
- Project prefers rebase workflow

## Advanced Options

### Auto-merge (Merge When Ready)

```bash
# Enable auto-merge - will merge when checks pass and approved
gh pr merge 42 --auto --squash

# Disable auto-merge
gh pr merge 42 --disable-auto
```

### Delete Branch After Merge

```bash
# Merge and delete branch
gh pr merge 42 --squash --delete-branch

# This is recommended to keep repository clean
```

### Admin Merge (Force)

```bash
# Bypass branch protection (requires admin)
gh pr merge 42 --admin

# Use with caution - only for emergencies
```

## Complete Merge Workflows

### Standard Feature Merge

```bash
# 1. Review PR one last time
gh pr view 42

# 2. Check CI status
gh pr checks 42

# 3. Merge with squash and cleanup
gh pr merge 42 --squash --delete-branch --body "feat: Add live log analysis

Implements real-time game.log monitoring with intelligent error detection.

- Auto-detect CK3 log directory
- Pattern-based error detection
- LSP diagnostics integration

Closes #42"
```

### Hotfix Merge

```bash
# Quick merge for urgent fix
gh pr merge <pr-number> --squash --delete-branch
```

### Reviewed PR Merge

```bash
# 1. Verify approval
gh pr view 42 --json reviewDecision --jq '.reviewDecision'

# 2. If APPROVED, merge
if [ "$(gh pr view 42 --json reviewDecision --jq -r '.reviewDecision')" == "APPROVED" ]; then
  gh pr merge 42 --squash --delete-branch
else
  echo "PR not approved yet"
fi
```

## Pre-Merge Checklist

```bash
# Run these checks before merging:

# 1. Check PR status
gh pr view 42

# 2. Verify CI passes
gh pr checks 42 | grep "fail" && echo "❌ Checks failing" || echo "✅ Checks pass"

# 3. Check reviews
gh pr view 42 --json reviewDecision --jq '.reviewDecision'

# 4. View diff one more time
gh pr view 42 --diff | less

# 5. Merge
gh pr merge 42 --squash --delete-branch
```

## Common Options Reference

```bash
--merge               Create merge commit
--squash              Squash commits into one
--rebase              Rebase and merge
--auto                Enable auto-merge
--disable-auto        Disable auto-merge
--delete-branch       Delete branch after merge (recommended)
--body TEXT           Custom merge commit message
--subject TEXT        Custom merge commit subject
--admin               Bypass protection rules (admin only)
```

## Quick Reference

```bash
# Interactive merge
gh pr merge 42

# Squash merge (most common)
gh pr merge 42 --squash --delete-branch

# Merge commit
gh pr merge 42 --merge --delete-branch

# Rebase merge
gh pr merge 42 --rebase --delete-branch

# Auto-merge when ready
gh pr merge 42 --auto --squash

# Force merge (admin)
gh pr merge 42 --admin
```

## Troubleshooting

### "Merge conflicts"

```bash
# Update PR branch with main
gh pr checkout 42
git fetch origin main
git merge origin/main
# Resolve conflicts
git add .
git commit
git push
```

### "Required checks have not passed"

```bash
# View check status
gh pr checks 42

# Wait for checks or fix issues
gh run watch
```

### "Review required"

```bash
# Request review
gh pr edit 42 --add-reviewer teammate1

# Or use web interface
gh pr view 42 --web
```

## Best Practices

1. **Squash by Default**: Keep main branch clean
2. **Delete Branches**: Use `--delete-branch` always
3. **Write Good Merge Messages**: Summarize the PR clearly
4. **Check Before Merge**: Verify CI and reviews
5. **Use Auto-merge**: Let GitHub merge when ready
6. **Prefer Rebase**: For small, clean PRs
7. **Preserve History**: Use merge commits for important features
8. **Test Locally**: Pull and test before merging
9. **Coordinate with Team**: Discuss merge strategy preferences
10. **Update After Merge**: Post-merge actions (changelog, tags)

```
