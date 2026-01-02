````prompt
# gh pr view - View Pull Request Details Assistant

When the user asks for help viewing pull request details, follow this structured workflow:

## Viewing Pull Requests

The `gh pr view` command displays detailed information about pull requests in your terminal or opens them in your browser.

## Basic Usage

### View Latest PR in Current Repository

```bash
# View most recent PR
gh pr view
````

### View Specific PR by Number

```bash
# View PR #42
gh pr view 42
```

### View PR by URL

```bash
# View PR from URL
gh pr view https://github.com/user/repo/pull/42
```

## Viewing Options

### 1. **Terminal View (Default)**

```bash
# View PR details in terminal
gh pr view 42

# Output shows:
# - Title
# - State (open/closed/merged)
# - Author
# - Labels
# - Assignees
# - Reviewers
# - Milestone
# - Projects
# - Description
# - CI status
```

### 2. **View with Comments**

```bash
# Include all comments in output
gh pr view 42 --comments

# Shows:
# - PR description
# - All review comments
# - Regular comments
# - System messages
```

### 3. **View Diff/Changes**

```bash
# View file changes
gh pr view 42 --diff

# Shows git diff of all changes
# Useful for quick code review in terminal
```

### 4. **Open in Web Browser**

```bash
# Open PR in default browser
gh pr view 42 --web

# Most useful for:
# - Adding inline code comments
# - Viewing rich media (images, videos)
# - Using GitHub's full UI features
```

## Viewing PR Status and Checks

### View CI/CD Status

```bash
# View PR with check statuses
gh pr view 42

# The default view shows check status at bottom:
# ✓ CI / build (pass)
# ✓ CI / test (pass)
# ✗ CI / lint (fail)
```

### Detailed Check Information

```bash
# For more detailed check info, use:
gh pr checks 42

# Shows:
# - All workflow runs
# - Individual job statuses
# - Links to logs
```

## JSON Output for Scripting

### Basic JSON Output

```bash
# Get PR data as JSON
gh pr view 42 --json title,body,state,author

# Extract specific fields
gh pr view 42 --json number,title --jq '.title'
```

### Useful JSON Queries

```bash
# Get PR status
gh pr view 42 --json state --jq '.state'

# Get author
gh pr view 42 --json author --jq '.author.login'

# Get all labels
gh pr view 42 --json labels --jq '.labels[].name'

# Get assignees
gh pr view 42 --json assignees --jq '.assignees[].login'

# Get review state
gh pr view 42 --json reviews --jq '.reviews[] | "\(.author.login): \(.state)"'

# Check if merged
gh pr view 42 --json merged --jq '.merged'
```

## Complete Viewing Workflows

### Quick PR Review

```bash
# 1. List open PRs
gh pr list

# 2. View specific PR
gh pr view 42

# 3. Check files changed
gh pr view 42 --diff | less

# 4. View comments
gh pr view 42 --comments

# 5. Open in browser for full review
gh pr view 42 --web
```

### Check PR Before Merging

```bash
# 1. View PR summary
gh pr view 42

# 2. Check CI status
gh pr checks 42

# 3. View approval status
gh pr view 42 --json reviews --jq '.reviews[] | select(.state=="APPROVED") | .author.login'

# 4. View diff one more time
gh pr view 42 --diff

# 5. Merge if ready
gh pr merge 42 --squash
```

### Monitor PR Activity

```bash
# View PR with comments to see latest activity
gh pr view 42 --comments | tail -n 20

# Check when PR was last updated
gh pr view 42 --json updatedAt --jq '.updatedAt'

# See who reviewed
gh pr view 42 --json reviews --jq '.reviews[] | "\(.author.login) at \(.submittedAt)"'
```

## Available JSON Fields

Use with `--json` flag:

```bash
--json additions          # Lines added
--json assignees          # Assigned users
--json author             # PR author
--json autoMergeRequest   # Auto-merge status
--json baseRefName        # Base branch
--json body               # PR description
--json closed             # Is closed
--json closedAt           # When closed
--json comments           # Comment count
--json commits            # Commit count
--json createdAt          # Creation time
--json deletions          # Lines deleted
--json files              # Changed files
--json headRefName        # Head branch
--json id                 # PR ID
--json isDraft            # Is draft
--json labels             # Labels
--json latestReviews      # Recent reviews
--json maintainerCanModify # Can maintainers edit
--json mergeCommit        # Merge commit SHA
--json mergeable          # Can be merged
--json mergedAt           # When merged
--json mergedBy           # Who merged
--json milestone          # Milestone
--json number             # PR number
--json projectCards       # Project boards
--json reactionGroups     # Reactions
--json reviewDecision     # APPROVED/CHANGES_REQUESTED/REVIEW_REQUIRED
--json reviewRequests     # Pending reviews
--json reviews            # All reviews
--json state              # OPEN/CLOSED/MERGED
--json statusCheckRollup  # CI check summary
--json title              # PR title
--json updatedAt          # Last update time
--json url                # PR URL
```

## Filtering and Formatting

### Custom Output Format

```bash
# Show PR number and title
gh pr view 42 --json number,title --jq '"\(.number): \(.title)"'

# Show PR state with emoji
gh pr view 42 --json state --jq 'if .state == "MERGED" then "✅ Merged" elif .state == "OPEN" then "🔵 Open" else "❌ Closed" end'

# Show PR summary
gh pr view 42 --json number,title,author,state --jq '"PR #\(.number): \(.title)\nAuthor: \(.author.login)\nState: \(.state)"'
```

### Check PR Approval Status

```bash
# Check if PR is approved
gh pr view 42 --json reviewDecision --jq '.reviewDecision'
# Output: APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED

# Count approvals
gh pr view 42 --json reviews --jq '[.reviews[] | select(.state=="APPROVED")] | length'

# List who approved
gh pr view 42 --json reviews --jq '.reviews[] | select(.state=="APPROVED") | .author.login'
```

## Common Use Cases

### 1. **Quick Status Check**

```bash
# One-liner to check PR status
gh pr view 42 --json state,reviewDecision,statusCheckRollup \
  --jq '"State: \(.state)\nReview: \(.reviewDecision)\nChecks: \(.statusCheckRollup.state)"'
```

### 2. **Find PR by Branch**

```bash
# View PR for current branch
gh pr view

# View PR for specific branch
gh pr list --head feature/my-branch --json number --jq '.[0].number' | \
  xargs gh pr view
```

### 3. **Export PR Data**

```bash
# Export PR to JSON file
gh pr view 42 --json title,body,author,reviews,comments > pr-42.json

# Export PR diff
gh pr view 42 --diff > pr-42.diff
```

### 4. **Check If PR Can Be Merged**

```bash
# Check mergeable status
gh pr view 42 --json mergeable,reviewDecision,statusCheckRollup \
  --jq 'if .mergeable == "MERGEABLE" and .reviewDecision == "APPROVED" and .statusCheckRollup.state == "SUCCESS" then "✅ Ready to merge" else "❌ Not ready" end'
```

## Quick Reference

```bash
# View latest PR
gh pr view

# View specific PR
gh pr view 42

# View with comments
gh pr view 42 --comments

# View diff
gh pr view 42 --diff

# Open in browser
gh pr view 42 --web

# JSON output
gh pr view 42 --json title,state,author

# Custom format with jq
gh pr view 42 --json title --jq '.title'
```

## Troubleshooting

### "No pull requests found"

```bash
# Ensure you're in a git repository
git status

# List all PRs to find the right one
gh pr list

# View PR by full URL
gh pr view https://github.com/user/repo/pull/42
```

### "Not found" error

```bash
# Check if PR number is correct
gh pr list | grep 42

# Try viewing in browser
gh pr view 42 --web
```

### Can't see full diff

```bash
# Pipe to less for pagination
gh pr view 42 --diff | less

# Or use --web for rich diff view
gh pr view 42 --web
```

## Best Practices

1. **Use `gh pr view` for Quick Checks**: Faster than opening browser
2. **Use `--comments` for Context**: See review discussions
3. **Use `--diff` for Code Review**: Review changes in terminal
4. **Use `--web` for Complex Reviews**: Better for inline comments
5. **Use `--json` for Automation**: Script PR status checks
6. **Check Before Merge**: Always view PR before merging
7. **Monitor CI Status**: Ensure checks pass
8. **Review Comments**: Don't miss reviewer feedback
9. **Verify Approvals**: Check review decision
10. **Use `jq` for Filtering**: Extract exactly what you need

This workflow ensures efficient PR review and monitoring throughout the development lifecycle.

```

```
