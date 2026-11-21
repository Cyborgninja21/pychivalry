# Branch Creation Assistant

When the user asks for help creating a new branch, follow this structured workflow:

## Branch Naming Conventions

Use consistent, descriptive branch names following these patterns:

### Branch Type Prefixes

- `feature/` - New features or enhancements
- `fix/` or `bugfix/` - Bug fixes
- `hotfix/` - Urgent production fixes
- `refactor/` - Code restructuring without behavior changes
- `docs/` - Documentation updates
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks (dependencies, build config)
- `experimental/` - Experimental or proof-of-concept work

### Naming Format

```
<type>/<short-description>
```

**Examples:**

- `feature/scope-validation`
- `fix/parser-crash-on-eof`
- `refactor/server-architecture`
- `docs/api-documentation`
- `hotfix/critical-memory-leak`

**Guidelines:**

- Use lowercase with hyphens (kebab-case)
- Keep names short but descriptive (2-4 words)
- Avoid issue numbers in branch names (use PR description instead)
- Be specific about what the branch addresses

## Branch Creation Workflow

### 1. **Ensure main is up to date**

```bash
# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main
```

### 2. **Create and switch to new branch**

```bash
# Create new branch from main
git checkout -b <branch-name>

# Verify you're on the new branch
git branch --show-current
```

### 3. **Set up remote tracking (optional but recommended)**

```bash
# Push branch and set up tracking
git push -u origin <branch-name>
```

### 4. **Make initial commit (optional but recommended)**

```bash
# Create initial planning file or empty commit
git commit --allow-empty -m "chore: Initialize <branch-name> branch

Objective: [Brief description of branch purpose]

Planned work:
- [Task 1]
- [Task 2]
- [Task 3]

References: #<issue-number> (if applicable)"
```

## Quick Reference Commands

```bash
# List all branches
git branch -a

# List remote branches only
git branch -r

# Switch between branches
git checkout <branch-name>

# Create branch without switching
git branch <branch-name>

# Delete local branch
git branch -d <branch-name>

# Delete local branch (force)
git branch -D <branch-name>

# Delete remote branch
git push origin --delete <branch-name>

# Rename current branch
git branch -m <new-name>
```

## Common Branch Creation Scenarios

### Feature Branch from Main

```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/log-watcher

# Set up remote tracking
git push -u origin feature/log-watcher

# Make initial commit
git commit --allow-empty -m "chore: Initialize log watcher feature branch

Objective: Implement real-time game.log analysis for CK3 script validation

Planned work:
- File system watcher for game.log
- Log entry parser and classifier
- Integration with existing diagnostic system
- Real-time error highlighting during gameplay

References: #42"
```

### Hotfix Branch from Main

```bash
# Create hotfix branch immediately
git checkout main
git pull origin main
git checkout -b hotfix/critical-parser-crash

# Work on fix...
# Commit fix
git add pychivalry/parser.py
git commit -m "fix: Prevent parser crash on unexpected EOF

- Added null checks in token iterator
- Enhanced error recovery for malformed files
- Added regression test for crash scenario

Critical fix for issue #156"

# Push and create PR immediately
git push -u origin hotfix/critical-parser-crash
```

### Experimental Branch

```bash
# Create experimental branch
git checkout -b experimental/async-parser-rewrite

# Make it clear this is experimental
git commit --allow-empty -m "chore: Begin experimental async parser rewrite

EXPERIMENTAL: This branch explores async/await patterns for parser

Goals:
- Evaluate asyncio benefits for parsing
- Test performance with large files
- Assess complexity vs. benefit trade-offs

Note: May be abandoned if benefits don't justify complexity"

git push -u origin experimental/async-parser-rewrite
```

### Branch from Specific Commit

```bash
# Create branch from specific commit
git checkout -b feature/rollback-safe-feature <commit-hash>

# Or from a tag
git checkout -b hotfix/patch-v1.2 v1.2.0

# Set up remote tracking
git push -u origin feature/rollback-safe-feature
```

## Branch Creation Best Practices

1. **Always start from updated main:**

   - Prevents merge conflicts later
   - Ensures you have latest code

2. **Use descriptive names:**

   - Future you will thank present you
   - Team members understand purpose immediately

3. **One feature per branch:**

   - Easier to review
   - Simpler to merge or revert
   - Clear commit history

4. **Set up remote tracking early:**

   - Enables collaboration
   - Provides backup of work
   - Makes PR creation easier

5. **Make initial planning commit:**

   - Documents branch purpose
   - Outlines planned work
   - Creates branch history starting point

6. **Keep branches short-lived:**
   - Merge within days, not weeks
   - Reduces merge conflicts
   - Maintains code freshness

## Branch Protection and Workflow

### Protected Branches

Main branches should be protected on GitHub/GitLab:

- `main` or `master`
- `develop` (if using git-flow)
- `production` (if separate from main)

**Protection rules:**

- Require pull request reviews
- Require status checks to pass
- Prohibit force pushes
- Require up-to-date branches before merge

### Working Branch Guidelines

- **Regular commits:** Commit logical units of work frequently
- **Push regularly:** Push to remote at least daily
- **Stay updated:** Merge main into feature branch regularly
- **Clean history:** Consider squashing before merge if many WIP commits

## Troubleshooting

### Branch already exists

```bash
# If you forgot the branch exists
git checkout <branch-name>  # Just switch to it

# If you want to restart
git branch -D <branch-name>  # Delete local
git push origin --delete <branch-name>  # Delete remote
git checkout -b <branch-name>  # Recreate
```

### Wrong branch name

```bash
# Rename branch
git branch -m <old-name> <new-name>

# Update remote
git push origin -u <new-name>
git push origin --delete <old-name>
```

### Created branch from wrong base

```bash
# Reset branch to correct base
git checkout <branch-name>
git reset --hard main  # Or other correct base

# Or recreate the branch
git checkout main
git branch -D <branch-name>
git checkout -b <branch-name>
```

### Accidentally committed to main

```bash
# Create branch with current work
git branch feature/accidental-work

# Reset main to origin
git checkout main
git reset --hard origin/main

# Switch to new branch with your work
git checkout feature/accidental-work
```

## Integration with Project Workflow

After creating a branch:

1. **Update project board:**

   - Move related issue to "In Progress"
   - Link branch to issue

2. **Communicate with team:**

   - Notify team of new branch (if collaborative)
   - Request early feedback on approach

3. **Set up development environment:**

   - Run `Install All Dependencies` task
   - Verify tests pass before starting work

4. **Plan work incrementally:**

   - Break feature into small, testable commits
   - Push regularly for backup and visibility

5. **Create draft PR early:**
   - Enables early feedback
   - Documents progress
   - Shows work is in progress

## Example Branch Creation Session

```bash
# Complete workflow example
git checkout main
git pull origin main
git checkout -b feature/semantic-tokens-enhancement
git push -u origin feature/semantic-tokens-enhancement

# Create initial plan
cat > BRANCH_PLAN.md << 'EOF'
# Semantic Tokens Enhancement Plan

## Objective
Improve semantic token accuracy for CK3 script highlighting

## Tasks
- [ ] Add scope-aware token classification
- [ ] Implement effect/trigger distinction
- [ ] Add variable reference highlighting
- [ ] Update tests
- [ ] Update documentation

## Timeline
Estimated: 3-5 days
EOF

git add BRANCH_PLAN.md
git commit -m "chore: Initialize semantic tokens enhancement branch

Objective: Improve token accuracy with scope and context awareness

Planned work documented in BRANCH_PLAN.md

References: #67"

git push

# Ready to start work!
```

This workflow ensures organized, trackable, and maintainable branch management throughout the project lifecycle.
