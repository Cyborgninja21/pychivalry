```prompt
# gh issue edit - Edit GitHub Issue Assistant

When the user asks for help editing GitHub issues, follow this structured workflow:

## Editing Issues

The `gh issue edit` command allows you to modify issue properties including title, body, labels, assignees, milestones, and state.

## Basic Usage

### Edit Issue Title

```bash
# Update title
gh issue edit 42 --title "New improved title"

# Fix typo in title
gh issue edit 42 --title "Parser crashes on malformed event files"
```

### Edit Issue Body

```bash
# Replace entire body
gh issue edit 42 --body "Updated description with more details..."

# Update from file
gh issue edit 42 --body-file updated_description.md
```

## Modify Issue Properties

### Add/Remove Labels

```bash
# Add labels
gh issue edit 42 --add-label bug,urgent

# Remove labels
gh issue edit 42 --remove-label needs-triage

# Replace all labels
gh issue edit 42 --label bug,confirmed
```

### Change Assignees

```bash
# Add assignees
gh issue edit 42 --add-assignee @me,username

# Remove assignees
gh issue edit 42 --remove-assignee olduser

# Clear all assignees
gh issue edit 42 --assignee ""

# Assign to specific user
gh issue edit 42 --assignee @me
```

### Update Milestone

```bash
# Set milestone
gh issue edit 42 --milestone "v1.2.0"

# Clear milestone
gh issue edit 42 --milestone ""
```

### Add to Project

```bash
# Add to project
gh issue edit 42 --add-project "CK3 Language Server"

# Remove from project
gh issue edit 42 --remove-project "Old Project"
```

## Change Issue State

### Close Issue

```bash
# Close as completed
gh issue close 42

# Close with comment
gh issue close 42 --comment "Fixed in #123"

# Close as not planned
gh issue close 42 --reason "not planned"
```

### Reopen Issue

```bash
# Reopen closed issue
gh issue reopen 42

# Reopen with comment
gh issue reopen 42 --comment "Issue reoccurred in v1.2.0"
```

## Complete Edit Workflows

### Triage New Issue

```bash
# 1. Review issue
gh issue view 42

# 2. Update labels and assign
gh issue edit 42 \
  --add-label bug,needs-investigation \
  --remove-label needs-triage \
  --add-assignee @me \
  --milestone "v1.2.0"

# 3. Add comment with triage notes
gh issue comment 42 --body "Triaged. Will investigate parser behavior."
```

### Update Issue After Investigation

```bash
# Change labels to reflect findings
gh issue edit 42 \
  --remove-label needs-investigation \
  --add-label confirmed,high-priority

# Update description with findings
gh issue edit 42 --body "## Issue Confirmed

Parser fails on files with:
- Missing closing braces
- Unexpected EOF
- Invalid character encodings

## Root Cause
Token parser doesn't validate brace matching.

## Fix Plan
Add validation layer before AST construction."
```

### Reassign Issue

```bash
# Transfer to another team member
gh issue edit 42 \
  --remove-assignee @me \
  --add-assignee teammate

# Add transfer note
gh issue comment 42 --body "@teammate - transferring this to you. Parser expertise needed."
```

### Promote Issue Priority

```bash
# Escalate to urgent
gh issue edit 42 \
  --add-label urgent,blocking \
  --milestone "v1.1.1"

# Notify team
gh issue comment 42 --body "⚠️ Promoted to urgent - blocking release."
```

### Move to Different Milestone

```bash
# Defer to next release
gh issue edit 42 --milestone "v1.3.0"

# Add comment explaining deferral
gh issue comment 42 --body "Deferring to v1.3.0 - not critical for current release."
```

## Batch Editing

### Update Multiple Issues

```bash
# Add label to multiple issues
for issue in 42 43 44; do
  gh issue edit $issue --add-label needs-review
done

# Assign milestone to set of issues
ISSUES=$(gh issue list --label bug --json number --jq '.[].number')
for issue in $ISSUES; do
  gh issue edit $issue --milestone "v1.2.0"
done
```

### Clear Stale Assignments

```bash
# Remove old assignee from all their issues
gh issue list --assignee olduser --json number --jq '.[].number' | \
while read issue; do
  gh issue edit $issue --remove-assignee olduser
done
```

### Bulk Label Management

```bash
# Rename label by replacing
gh issue list --label old-label --json number --jq '.[].number' | \
while read issue; do
  gh issue edit $issue --remove-label old-label --add-label new-label
done
```

## Edit Options Reference

```bash
--title TEXT              Set issue title
--body TEXT               Set issue body/description
--body-file FILE          Read body from file
--add-assignee LOGIN      Add assignee(s)
--remove-assignee LOGIN   Remove assignee(s)
--assignee LOGIN          Set assignee(s) (replaces all)
--add-label NAME          Add label(s)
--remove-label NAME       Remove label(s)
--label NAME              Set label(s) (replaces all)
--milestone NAME          Set milestone (empty string clears)
--add-project NAME        Add to project
--remove-project NAME     Remove from project
```

## Close/Reopen Options

```bash
gh issue close NUMBER [options]
  --comment TEXT          Add closing comment
  --reason REASON         Close reason (completed, not planned)

gh issue reopen NUMBER [options]
  --comment TEXT          Add reopening comment
```

## Quick Reference

```bash
# Edit title
gh issue edit 42 --title "New title"

# Edit body
gh issue edit 42 --body "Updated description"

# Add labels
gh issue edit 42 --add-label bug,urgent

# Assign user
gh issue edit 42 --add-assignee @me

# Set milestone
gh issue edit 42 --milestone "v1.2.0"

# Close issue
gh issue close 42

# Reopen issue
gh issue reopen 42
```

## Troubleshooting

### Can't Edit Issue

```bash
# Check permissions
gh auth status

# Verify issue exists
gh issue view 42
```

### Label Not Found

```bash
# Check available labels (view in browser)
gh issue view 42 --web

# Create label if needed (via web or API)
```

### Milestone Not Found

```bash
# List milestones
gh api repos/:owner/:repo/milestones --jq '.[].title'

# Create milestone via web interface
```

### Changes Not Appearing

```bash
# Refresh issue view
gh issue view 42

# Check in browser
gh issue view 42 --web
```

## Best Practices

1. **Be Specific**: Make targeted updates rather than replacing everything
2. **Use Add/Remove**: Prefer --add-label over --label to preserve existing
3. **Comment on Changes**: Explain significant edits
4. **Batch Carefully**: Test on one issue before bulk operations
5. **Verify Before Closing**: Ensure issue is truly resolved
6. **Clear Milestones When Deferring**: Don't leave in wrong milestone
7. **Update Body for Context**: Keep description accurate as issue evolves
8. **Use Consistent Labels**: Follow project labeling conventions
9. **Reassign Thoughtfully**: Notify when transferring issues
10. **Document State Changes**: Explain why closing or reopening

```
