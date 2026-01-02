```prompt
# gh run list - List GitHub Actions Workflow Runs Assistant

When the user asks for help listing GitHub Actions workflow runs, follow this structured workflow:

## Listing Workflow Runs

The `gh run list` command displays all workflow runs for the repository, with powerful filtering by workflow, branch, status, and actor.

## Basic Usage

### List All Runs

```bash
# List recent workflow runs
gh run list

# Output shows: status, conclusion, name, branch, event, ID, elapsed time
```

### List with Limit

```bash
# Show only 10 most recent
gh run list --limit 10

# Show 50 runs
gh run list --limit 50
```

## Filtering Runs

### By Workflow

```bash
# Runs for specific workflow
gh run list --workflow=ci.yml

# By workflow name
gh run list --workflow="CI"

# Multiple workflows
gh run list --workflow=ci.yml,deploy.yml
```

### By Branch

```bash
# Runs on main branch
gh run list --branch main

# Runs on feature branch
gh run list --branch feature/new-parser

# Runs on current branch
BRANCH=$(git branch --show-current)
gh run list --branch "$BRANCH"
```

### By Status

```bash
# In progress runs
gh run list --status in_progress

# Queued runs
gh run list --status queued

# Completed runs
gh run list --status completed
```

### By Conclusion

```bash
# Failed runs
gh run list --status completed | grep "failure"

# Or use API
gh api repos/:owner/:repo/actions/runs --jq '.workflow_runs[] | select(.conclusion=="failure")'

# Success runs
gh run list --status completed | grep "success"
```

### By Actor (Who Triggered)

```bash
# Runs triggered by you
gh run list --user @me

# Runs triggered by specific user
gh run list --user username
```

### By Event

```bash
# Push-triggered runs
gh run list --event push

# Pull request runs
gh run list --event pull_request

# Manual workflow dispatch
gh run list --event workflow_dispatch

# Scheduled runs
gh run list --event schedule
```

## JSON Output

### Basic JSON

```bash
# Get runs as JSON
gh run list --json databaseId,status,conclusion,name,headBranch,event

# All available fields
gh run list --json databaseId,displayTitle,status,conclusion,workflowName,headBranch,event,createdAt,updatedAt,url
```

### Extract Specific Data

```bash
# Get run IDs
gh run list --json databaseId --jq '.[].databaseId'

# Get failed run IDs
gh run list --json databaseId,conclusion --jq '.[] | select(.conclusion=="failure") | .databaseId'

# Count runs by status
gh run list --json status --jq 'group_by(.status) | map({status: .[0].status, count: length})'
```

## Complete Filtering Workflows

### Find Failed CI Runs

```bash
# Recent CI failures
gh run list --workflow=ci.yml --branch main --limit 20 | grep "failure"

# Get failed run IDs for investigation
gh run list --workflow=ci.yml --json databaseId,conclusion --jq '.[] | select(.conclusion=="failure") | .databaseId'
```

### Monitor Current Runs

```bash
# Check in-progress runs
gh run list --status in_progress

# Watch specific workflow
watch -n 5 'gh run list --workflow=ci.yml --limit 5'
```

### Branch-Specific Runs

```bash
# All runs on feature branch
gh run list --branch feature/log-watcher

# Latest run on branch
gh run list --branch feature/log-watcher --limit 1
```

### Find Runs to Re-run

```bash
# Get failed runs from last day
gh run list --created ">=2026-01-01" --json databaseId,conclusion,workflowName \
  --jq '.[] | select(.conclusion=="failure")'

# Re-run them
for run_id in $(gh run list --json databaseId,conclusion --jq '.[] | select(.conclusion=="failure") | .databaseId'); do
  gh run rerun $run_id --failed
done
```

### Deployment Status

```bash
# Check deployment workflow
gh run list --workflow=deploy.yml --branch main --limit 5

# Latest deployment
gh run list --workflow=deploy.yml --branch main --limit 1
```

## Scripting with Run List

### Count Runs by Status

```bash
#!/bin/bash
echo "Workflow Run Status:"
echo "==================="
echo "In Progress: $(gh run list --status in_progress --json databaseId --jq 'length')"
echo "Queued: $(gh run list --status queued --json databaseId --jq 'length')"
echo "Completed: $(gh run list --status completed --json databaseId --jq 'length')"
```

### Find Flaky Tests

```bash
# Get last 50 runs with conclusions
gh run list --workflow=ci.yml --limit 50 --json databaseId,conclusion,createdAt \
  --jq '.[] | "\(.databaseId): \(.conclusion) at \(.createdAt)"'

# Analyze pattern
gh run list --workflow=ci.yml --limit 50 --json conclusion \
  --jq 'group_by(.conclusion) | map({conclusion: .[0].conclusion, count: length})'
```

### Generate Run Report

```bash
#!/bin/bash
echo "# GitHub Actions Report"
echo "Generated: $(date)"
echo ""
echo "## Recent Runs"
gh run list --limit 20 --json displayTitle,status,conclusion,headBranch,createdAt \
  --jq '.[] | "- [\(.status)] \(.displayTitle) on \(.headBranch) - \(.conclusion // "running")"'
```

### Wait for Run Completion

```bash
# Get latest run ID
RUN_ID=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')

# Wait until completed
while [ "$(gh run view $RUN_ID --json status --jq '.status')" != "completed" ]; do
  echo "Waiting for run $RUN_ID..."
  sleep 10
done

echo "Run completed!"
gh run view $RUN_ID
```

## Common Options Reference

```bash
--workflow FILE/NAME  Filter by workflow file or name
--branch NAME         Filter by branch
--status STATUS       Filter by status (queued, in_progress, completed)
--user LOGIN          Filter by actor (@me, username)
--event EVENT         Filter by trigger event (push, pull_request, workflow_dispatch)
--created DATE        Filter by creation date (>=2026-01-01, <2026-02-01)
--limit NUM           Maximum number to show
--json FIELDS         Output as JSON with specified fields
--jq EXPRESSION       Process JSON with jq
```

## JSON Fields Reference

```bash
databaseId         Run ID
displayTitle       Run title/name
status             queued, in_progress, completed
conclusion         success, failure, cancelled, skipped
workflowName       Workflow name
headBranch         Branch that triggered run
event              Trigger event type
createdAt          Creation timestamp
updatedAt          Last update timestamp
url                Run URL
```

## Quick Reference

```bash
# List all runs
gh run list

# Specific workflow
gh run list --workflow=ci.yml

# Specific branch
gh run list --branch main

# In progress
gh run list --status in_progress

# Failed runs (via grep)
gh run list --workflow=ci.yml | grep failure

# JSON output
gh run list --json databaseId,status,conclusion

# Latest run
gh run list --limit 1
```

## Troubleshooting

### No Runs Shown

```bash
# Check if workflows exist
ls -la .github/workflows/

# List all workflows
gh workflow list

# Remove filters
gh run list --limit 50
```

### Wrong Workflow Name

```bash
# List available workflows
gh workflow list

# Use workflow file name
gh run list --workflow=ci.yml
```

### Old Runs Not Showing

```bash
# Increase limit
gh run list --limit 100

# Check retention settings (runs auto-delete after 90 days by default)
```

### Status Filter Not Working

```bash
# Valid statuses: queued, in_progress, completed
# Use exact values
gh run list --status completed

# For conclusions (success/failure), use JSON + jq
gh run list --json conclusion --jq '.[] | select(.conclusion=="failure")'
```

## Best Practices

1. **Use Limits**: Don't fetch more runs than needed
2. **Filter Early**: Use --workflow, --branch to narrow results
3. **Leverage JSON**: Essential for scripting and analysis
4. **Monitor Failed Runs**: Set up alerts for failures
5. **Track Flakiness**: Monitor conclusion patterns over time
6. **Use Descriptive Workflow Names**: Makes filtering easier
7. **Check In-Progress**: Useful for detecting hung workflows
8. **Combine Filters**: --workflow + --branch + --status for precision
9. **Script Status Checks**: Automate run monitoring
10. **Archive Important Logs**: Download before retention expiry

```
