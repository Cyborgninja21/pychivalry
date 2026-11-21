```prompt
# gh issue list - List GitHub Issues Assistant

When the user asks for help listing and searching GitHub issues, follow this structured workflow:

## Listing Issues

The `gh issue list` command displays issues from the current or specified repository with powerful filtering and formatting options.

## Basic Usage

### List All Open Issues

```bash
# List open issues in current repo
gh issue list

# Output shows: number, title, labels, author, updated time
```

### List with Limit

```bash
# Show only first 10 issues
gh issue list --limit 10

# Show first 50
gh issue list --limit 50
```

## Filtering Issues

### By State

```bash
# Open issues (default)
gh issue list --state open

# Closed issues
gh issue list --state closed

# All issues (open + closed)
gh issue list --state all
```

### By Label

```bash
# Issues with specific label
gh issue list --label bug

# Multiple labels (AND logic)
gh issue list --label bug --label urgent

# Issues with any of these labels
gh issue list --label "bug,enhancement"
```

### By Assignee

```bash
# Issues assigned to you
gh issue list --assignee @me

# Issues assigned to specific user
gh issue list --assignee username

# Unassigned issues
gh issue list --assignee ""
```

### By Author

```bash
# Issues created by you
gh issue list --author @me

# Issues created by specific user
gh issue list --author username
```

### By Milestone

```bash
# Issues in specific milestone
gh issue list --milestone "v1.2.0"

# Issues without milestone
gh issue list --milestone ""
```

### By Search Query

```bash
# Search in title and body
gh issue list --search "parser crash"

# Complex search
gh issue list --search "scope validation in:title"
```

## Output Formatting

### JSON Output

```bash
# Get issues as JSON
gh issue list --json number,title,state,labels

# All available fields
gh issue list --json number,title,state,author,assignees,labels,milestone,url,createdAt,updatedAt,closedAt
```

### Custom Output with jq

```bash
# Extract specific fields
gh issue list --json number,title,state --jq '.[] | "\(.number): \(.title) [\(.state)]"'

# List only issue numbers
gh issue list --json number --jq '.[].number'

# Issues created this month
gh issue list --json number,title,createdAt --jq '.[] | select(.createdAt | startswith("2026-01"))'
```

### Table Format

```bash
# Custom columns
gh issue list --json number,title,labels,updatedAt | \
  jq -r '.[] | [.number, .title, (.labels | map(.name) | join(",")), .updatedAt] | @tsv'
```

## Complete Filtering Workflows

### Bug Triage

```bash
# All open bugs
gh issue list --label bug --state open

# High priority bugs
gh issue list --label bug --label urgent --state open

# Unassigned bugs
gh issue list --label bug --assignee "" --state open

# Old bugs (use JSON + jq for date filtering)
gh issue list --label bug --json number,title,createdAt --jq '.[] | select(.createdAt < "2025-01-01")'
```

### Sprint Planning

```bash
# Current milestone issues
gh issue list --milestone "v1.2.0" --state open

# Unassigned issues in milestone
gh issue list --milestone "v1.2.0" --assignee "" --state open

# My assigned issues
gh issue list --milestone "v1.2.0" --assignee @me --state open
```

### Status Reports

```bash
# Issues closed this week (approximate)
gh issue list --state closed --limit 50 | head -20

# My recent activity
gh issue list --assignee @me --state all --limit 20

# Issues I created
gh issue list --author @me --state all
```

### Label-Based Filtering

```bash
# All feature requests
gh issue list --label enhancement

# Documentation tasks
gh issue list --label documentation --state open

# Security issues
gh issue list --label security --state all
```

## Scripting with Issue List

### Count Issues by Label

```bash
# Count open bugs
gh issue list --label bug --json number --jq '. | length'

# Count by multiple labels
echo "Bugs: $(gh issue list --label bug --json number --jq 'length')"
echo "Enhancements: $(gh issue list --label enhancement --json number --jq 'length')"
echo "Docs: $(gh issue list --label documentation --json number --jq 'length')"
```

### Find Stale Issues

```bash
# Issues not updated in 90 days
gh issue list --json number,title,updatedAt --jq \
  '.[] | select((now - (.updatedAt | fromdateiso8601)) > 7776000) | "\(.number): \(.title)"'
```

### Generate Issue Report

```bash
# Markdown report of open issues
echo "# Open Issues Report"
echo "Generated: $(date)"
echo ""
echo "## Bugs"
gh issue list --label bug --json number,title --jq '.[] | "- #\(.number): \(.title)"'
echo ""
echo "## Enhancements"
gh issue list --label enhancement --json number,title --jq '.[] | "- #\(.number): \(.title)"'
```

### Bulk Operations Preparation

```bash
# Get all issues without milestone
ISSUES=$(gh issue list --milestone "" --json number --jq '.[].number')

# Process each
for issue in $ISSUES; do
  echo "Issue #$issue needs milestone"
  # gh issue edit $issue --milestone "v1.2.0"
done
```

## Common Workflows

### Daily Standup Prep

```bash
# What I'm working on
gh issue list --assignee @me --state open

# What I closed recently
gh issue list --assignee @me --state closed --limit 5
```

### Project Status Check

```bash
# Milestone progress
TOTAL=$(gh issue list --milestone "v1.2.0" --state all --json number --jq 'length')
CLOSED=$(gh issue list --milestone "v1.2.0" --state closed --json number --jq 'length')
OPEN=$(gh issue list --milestone "v1.2.0" --state open --json number --jq 'length')

echo "Milestone v1.2.0: $CLOSED/$TOTAL complete ($OPEN remaining)"
```

### Find Issues to Work On

```bash
# Good first issues
gh issue list --label "good first issue" --state open

# Help wanted
gh issue list --label "help wanted" --state open

# Unassigned in my area
gh issue list --label "parser" --assignee "" --state open
```

## Common Options Reference

```bash
--state STATE         Filter by state (open, closed, all)
--label LABEL         Filter by label(s)
--assignee LOGIN      Filter by assignee (@me, username, "")
--author LOGIN        Filter by author
--milestone NAME      Filter by milestone
--search QUERY        Search in title/body
--limit NUM           Maximum number to show
--json FIELDS         Output as JSON with specified fields
--jq EXPRESSION       Process JSON with jq
```

## JSON Fields Reference

```bash
number          Issue number
title           Issue title
state           open/closed
author          Issue creator
assignees       Assigned users
labels          Applied labels
milestone       Associated milestone
url             Issue URL
createdAt       Creation timestamp
updatedAt       Last update timestamp
closedAt        Close timestamp (if closed)
body            Issue description
comments        Comment count
```

## Quick Reference

```bash
# List open issues
gh issue list

# List bugs
gh issue list --label bug

# My issues
gh issue list --assignee @me

# Closed issues
gh issue list --state closed

# JSON output
gh issue list --json number,title,state

# Search
gh issue list --search "parser"
```

## Troubleshooting

### No Issues Shown

```bash
# Check if filters are too restrictive
gh issue list --state all

# Verify you're in correct repo
gh repo view
```

### Too Many Results

```bash
# Use limit
gh issue list --limit 10

# Add more filters
gh issue list --label bug --state open --limit 20
```

### JSON Parsing Errors

```bash
# Verify JSON output first
gh issue list --json number,title | jq .

# Check jq syntax
echo '[]' | jq '.[] | .number'
```

## Best Practices

1. **Use Filters Effectively**: Narrow results with labels, state, assignee
2. **Limit Results**: Don't fetch more than needed
3. **Leverage JSON**: Use for scripting and automation
4. **Save Common Queries**: Create aliases for frequent searches
5. **Combine with jq**: Powerful data transformation
6. **Check State**: Remember to filter by state (open/closed/all)
7. **Use @me**: Quick way to see your issues
8. **Search Carefully**: Use search for text matching
9. **Monitor Milestones**: Track progress toward goals
10. **Automate Reports**: Script regular status updates

```
