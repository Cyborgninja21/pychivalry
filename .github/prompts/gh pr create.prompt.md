````prompt
# gh pr create - Pull Request Creation Assistant

When the user asks for help creating a pull request, follow this structured workflow:

## Pull Request Creation

The `gh pr create` command allows you to create pull requests directly from the command line without using the web interface.

## Basic Usage

### Interactive Creation (Recommended for First-Time Users)

```bash
# Create PR interactively - prompts for all details
gh pr create
````

This will prompt you for:

- Title
- Body/Description
- Base branch (usually `main`)
- Whether to mark as draft
- Assignees
- Labels
- Reviewers

### Non-Interactive Creation

```bash
# Create PR with all details specified
gh pr create \
  --title "feat: Add scope validation system" \
  --body "Comprehensive scope tracking and validation for CK3 scripts." \
  --base main \
  --head feature/scope-validation
```

## Common Creation Patterns

### 1. **Feature Branch PR**

```bash
# Quick PR from current branch with auto-filled details
gh pr create --fill

# The --fill flag auto-generates title and body from your commits
```

### 2. **PR with Full Details**

```bash
gh pr create \
  --title "feat: Add live log analysis" \
  --body "Implements real-time game.log monitoring with error detection.

## Changes
- Added file watcher for game.log
- Implemented pattern-based error detection
- Integrated with LSP diagnostics system

## Testing
- All existing tests pass
- Added 15 new test cases
- Manually tested with live game sessions

Closes #42" \
  --assignee @me \
  --reviewer teammate1,teammate2 \
  --label enhancement,high-priority
```

### 3. **Draft PR (Work in Progress)**

```bash
# Create as draft PR
gh pr create --draft \
  --title "WIP: Experimenting with async parser" \
  --body "Exploring async/await patterns for better performance.

**Status**: Experimental, not ready for review yet."
```

### 4. **PR with Milestone and Project**

```bash
gh pr create \
  --title "fix: Parser crash on malformed files" \
  --body "Critical fix for issue #156" \
  --label bug,urgent \
  --milestone "v1.2.0" \
  --project "CK3 Language Server" \
  --assignee @me
```

### 5. **PR from Specific Branch**

```bash
# Create PR from specific branch (when not on that branch)
gh pr create \
  --head feature/my-feature \
  --base main \
  --title "New feature" \
  --body "Description"
```

## Advanced Options

### Multi-line Body with Markdown

```bash
gh pr create --title "feat: Semantic token enhancements" --body "## Overview
Improves semantic token accuracy using scope context.

## Technical Details
- Enhanced scope-aware classification
- Added effect/trigger distinction
- Implemented variable reference highlighting

## Performance Impact
- Token generation: <5ms (no regression)
- Memory usage: +2MB per workspace

## Testing Strategy
- 20 new unit tests
- Integration testing in VS Code
- Manual verification across multiple mods

## Screenshots
[Before/After comparison attached]

Closes #67"
```

### Body from File

```bash
# Use external file for PR description
gh pr create \
  --title "feat: Major refactoring" \
  --body-file PR_DESCRIPTION.md \
  --label refactor
```

### Open in Browser After Creation

```bash
# Create and immediately open in browser
gh pr create --web
```

### Auto-fill from Commits

```bash
# Auto-generate title from first commit, body from all commits
gh pr create --fill

# This is perfect for feature branches with descriptive commits
```

## Complete PR Creation Workflows

### Feature Branch Workflow

```bash
# 1. Ensure you're on your feature branch
git checkout feature/semantic-tokens

# 2. Ensure changes are pushed
git push -u origin feature/semantic-tokens

# 3. Create PR with full details
gh pr create \
  --title "feat: Enhance semantic token accuracy" \
  --body "Improves token classification using scope awareness.

## Changes
- Scope-aware token classification
- Effect/trigger distinction
- Variable reference highlighting

## Testing
- All tests pass (142/142)
- Added 20 new test cases
- Manual testing completed

## Performance
- No measurable impact (<5ms)

Closes #67" \
  --label enhancement \
  --reviewer @team/core-maintainers \
  --assignee @me

# 4. View created PR
gh pr view --web
```

### Hotfix Workflow

```bash
# 1. Create hotfix branch
git checkout -b hotfix/parser-crash main

# 2. Make fix
# ... edit files ...
git add .
git commit -m "fix: Prevent parser crash on unexpected EOF"

# 3. Push branch
git push -u origin hotfix/parser-crash

# 4. Create urgent PR
gh pr create \
  --title "HOTFIX: Parser crash on unexpected EOF" \
  --body "**Critical**: Fixes production crash in parser.

## Issue
Parser crashes when encountering unexpected EOF in event files.

## Root Cause
Missing null check in token iterator (parser.py:234)

## Fix
- Added null checks before token access
- Enhanced error recovery for malformed files
- Added regression test

## Testing
- Verified fix with reported file
- All tests pass (142/142)
- No performance impact

Fixes #156" \
  --label bug,urgent,hotfix \
  --assignee @me \
  --reviewer @team/core-maintainers \
  --milestone "v1.1.1"

# 5. Notify team
echo "🚨 Urgent hotfix PR created! Please review ASAP."
```

### Quick PR (Minimal)

```bash
# For simple, obvious changes
gh pr create --fill
```

## PR Templates

If you have a PR template at `.github/PULL_REQUEST_TEMPLATE.md`, it will be automatically used:

```bash
# Uses template automatically
gh pr create

# Skip template
gh pr create --title "..." --body "..."
```

## Linking Issues

Use keywords in the PR body to automatically close issues:

```bash
gh pr create --title "Fix memory leak" --body "Fixed memory leak in scope cache.

Closes #42
Fixes #43
Resolves #44
Relates to #45"
```

Keywords that close issues:

- `Closes #123`
- `Fixes #123`
- `Resolves #123`

## Common Options Reference

```bash
--title TEXT          PR title (required if not --fill)
--body TEXT           PR description
--body-file FILE      Read description from file
--fill                Auto-fill title and body from commits
--base BRANCH         Base branch (default: main)
--head BRANCH         Head branch (default: current branch)
--draft               Create as draft PR
--web                 Open browser to create PR interactively
--assignee LOGIN      Assign users (@me for yourself)
--label NAME          Add labels (comma-separated)
--milestone NAME      Add to milestone
--project NAME        Add to project
--reviewer LOGIN      Request reviews (comma-separated)
```

## Quick Reference

```bash
# Interactive creation
gh pr create

# Auto-fill from commits
gh pr create --fill

# Full specification
gh pr create --title "..." --body "..." --label bug --reviewer user1

# Draft PR
gh pr create --draft

# Open in browser
gh pr create --web
```

## Troubleshooting

### "No commits between base and head"

```bash
# Ensure you have committed changes
git status
git add .
git commit -m "Your changes"
git push
```

### "Branch not found"

```bash
# Push your branch first
git push -u origin feature/my-feature
```

### "No default branch configured"

```bash
# Specify base branch explicitly
gh pr create --base main
```

### Can't set reviewers/assignees

```bash
# Check permissions
gh auth status

# Ensure users have access to repo
# Use --reviewer @team/team-name for teams
```

## Best Practices

1. **Use Descriptive Titles**: Follow conventional commits format (`feat:`, `fix:`, etc.)
2. **Write Clear Descriptions**: Include context, changes, testing, and impact
3. **Link Issues**: Use "Closes #123" to auto-close related issues
4. **Add Labels**: Help with organization and filtering
5. **Request Reviews**: Tag appropriate reviewers immediately
6. **Use Draft for WIP**: Mark unfinished work as draft
7. **Test Before Creating**: Ensure tests pass locally
8. **Use --fill for Simple Changes**: Save time on obvious PRs
9. **Include Screenshots**: For UI changes, add visual documentation
10. **Update After Creation**: You can edit PR details later with `gh pr edit`

This workflow ensures clear, well-documented pull requests that are easy to review and merge.

```

```
