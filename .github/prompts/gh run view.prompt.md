```prompt
# gh run view - View GitHub Actions Run Details Assistant

When the user asks for help viewing workflow run details and logs, follow this structured workflow:

## Viewing Workflow Runs

The `gh run view` command displays detailed information about a specific workflow run including jobs, steps, status, and logs.

## Basic Usage

### View Run by ID

```bash
# View specific run
gh run view 12345678

# Latest run
gh run view $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
```

### View in Terminal

```bash
# Show run overview
gh run view 12345678

# Output includes:
# - Run status and conclusion
# - Workflow name
# - Triggered by
# - Branch
# - Commit
# - All jobs with status
# - Duration
```

### View in Browser

```bash
# Open run in web browser
gh run view 12345678 --web

# Quick way to see full UI
```

## View Run Logs

### All Logs

```bash
# View complete logs for all jobs
gh run view 12345678 --log

# Logs from all jobs in sequential order
```

### Failed Job Logs

```bash
# Show only failed jobs
gh run view 12345678 --log-failed

# Useful for quickly finding errors
```

### Specific Job Logs

```bash
# View logs for specific job
gh run view 12345678 --job "build"

# With logs
gh run view 12345678 --job "build" --log
```

## JSON Output

### Get Run Details as JSON

```bash
# Full run data
gh run view 12345678 --json

# Specific fields
gh run view 12345678 --json status,conclusion,workflowName,headBranch,jobs
```

### Extract Specific Information

```bash
# Get run status
gh run view 12345678 --json status --jq '.status'

# Get conclusion
gh run view 12345678 --json conclusion --jq '.conclusion'

# List all jobs
gh run view 12345678 --json jobs --jq '.jobs[] | .name'

# Get failed jobs
gh run view 12345678 --json jobs --jq '.jobs[] | select(.conclusion=="failure") | .name'
```

## Complete Viewing Workflows

### Debug Failed Run

```bash
# 1. View run overview
gh run view 12345678

# 2. Check which jobs failed
gh run view 12345678 --json jobs --jq '.jobs[] | select(.conclusion=="failure") | .name'

# 3. View failed job logs
gh run view 12345678 --log-failed

# 4. View specific job in detail
gh run view 12345678 --job "test" --log

# 5. Open in browser for full context
gh run view 12345678 --web
```

### Monitor Running Workflow

```bash
# Watch run status
while [ "$(gh run view 12345678 --json status --jq '.status')" != "completed" ]; do
  clear
  gh run view 12345678
  echo ""
  echo "Waiting... (Ctrl+C to stop)"
  sleep 5
done

# Final status
gh run view 12345678
```

### Compare Runs

```bash
# View two runs side by side
echo "=== Run 12345678 ==="
gh run view 12345678

echo "=== Run 12345679 ==="
gh run view 12345679

# Compare conclusions
gh run view 12345678 --json conclusion --jq '.conclusion'
gh run view 12345679 --json conclusion --jq '.conclusion'
```

### Extract Error Messages

```bash
# Get logs and grep for errors
gh run view 12345678 --log-failed | grep -i "error"

# Find specific error pattern
gh run view 12345678 --log | grep -A 5 "FAILED"

# Extract Python tracebacks
gh run view 12345678 --log | grep -A 20 "Traceback"
```

### Check Specific Job Details

```bash
# View job names
gh run view 12345678 --json jobs --jq '.jobs[] | .name'

# View specific job
gh run view 12345678 --job "lint"

# Get job status
gh run view 12345678 --json jobs --jq '.jobs[] | select(.name=="test") | .conclusion'

# View job duration
gh run view 12345678 --json jobs --jq '.jobs[] | "\(.name): \(.conclusion) in \(.durationMs / 1000)s"'
```

## Log Analysis

### Save Logs to File

```bash
# Save all logs
gh run view 12345678 --log > run-12345678.log

# Save failed logs only
gh run view 12345678 --log-failed > failed-12345678.log

# Analyze offline
grep "error" run-12345678.log
```

### Search Logs

```bash
# Find specific error
gh run view 12345678 --log | grep "ModuleNotFoundError"

# Case insensitive search
gh run view 12345678 --log | grep -i "timeout"

# Count occurrences
gh run view 12345678 --log | grep -c "warning"
```

### Filter by Job

```bash
# List available jobs
gh run view 12345678 --json jobs --jq '.jobs[] | .name'

# View specific job log
gh run view 12345678 --job "build" --log

# Compare job logs
gh run view 12345678 --job "test-python-3.9" --log > py39.log
gh run view 12345678 --job "test-python-3.10" --log > py310.log
diff py39.log py310.log
```

## Run Status Information

### Check Run Status

```bash
# Quick status check
gh run view 12345678 --json status,conclusion --jq '{status, conclusion}'

# Is run completed?
if [ "$(gh run view 12345678 --json status --jq '.status')" = "completed" ]; then
  echo "Run finished"
else
  echo "Run still in progress"
fi

# Was run successful?
if [ "$(gh run view 12345678 --json conclusion --jq '.conclusion')" = "success" ]; then
  echo "✅ Success"
else
  echo "❌ Failed"
fi
```

### Get Run Metadata

```bash
# Workflow details
gh run view 12345678 --json workflowName,event,headBranch,createdAt,updatedAt

# Who triggered
gh run view 12345678 --json headBranch,event,triggeredBy --jq '{branch: .headBranch, event, triggeredBy}'

# Commit info
gh run view 12345678 --json headSha,headCommit --jq '{sha: .headSha, message: .headCommit.message}'
```

## Common Options Reference

```bash
--web                Open run in browser
--log                Show logs for all jobs
--log-failed         Show logs for failed jobs only
--job NAME           View specific job
--json [FIELDS]      Output as JSON
--jq EXPRESSION      Process JSON with jq
```

## JSON Fields Reference

```bash
status              queued, in_progress, completed
conclusion          success, failure, cancelled, skipped, timed_out
workflowName        Name of the workflow
event               Trigger event (push, pull_request, etc.)
headBranch          Branch that triggered run
headSha             Commit SHA
headCommit          Commit details (message, author, etc.)
createdAt           When run was created
updatedAt           Last update time
jobs                Array of job objects
  - name            Job name
  - status          Job status
  - conclusion      Job conclusion
  - startedAt       Job start time
  - completedAt     Job completion time
  - durationMs      Job duration in milliseconds
```

## Quick Reference

```bash
# View run
gh run view 12345678

# View logs
gh run view 12345678 --log

# Failed logs only
gh run view 12345678 --log-failed

# Specific job
gh run view 12345678 --job "test"

# Open in browser
gh run view 12345678 --web

# JSON output
gh run view 12345678 --json status,conclusion

# Check status
gh run view 12345678 --json status --jq '.status'
```

## Troubleshooting

### Run Not Found

```bash
# List recent runs
gh run list --limit 20

# Check run ID
gh run list | grep "12345678"
```

### Can't View Logs

```bash
# Check permissions
gh auth status

# Try browser view
gh run view 12345678 --web

# Logs may be expired (90-day retention)
```

### Job Name Not Found

```bash
# List available jobs
gh run view 12345678 --json jobs --jq '.jobs[] | .name'

# Use exact job name
gh run view 12345678 --job "test-python-3.9"
```

### JSON Parsing Error

```bash
# Test JSON output
gh run view 12345678 --json | jq .

# Verify jq syntax
echo '{"status":"completed"}' | jq '.status'
```

## Best Practices

1. **Use --log-failed First**: Quickly find problems
2. **Save Logs**: Download important logs before retention expires
3. **Check Browser for UI**: Some info clearer in web interface
4. **Use JSON for Scripting**: Automate status checks
5. **Monitor Long Runs**: Watch status during execution
6. **Search Logs Efficiently**: Use grep, awk for analysis
7. **Compare with Previous Runs**: Identify new failures
8. **Check All Jobs**: Don't assume first failure is root cause
9. **Extract Specific Errors**: Grep for error messages
10. **Archive Failure Logs**: Keep for future reference

## Advanced Usage

### Auto-rerun Failed Runs

```bash
# Check if run failed
if [ "$(gh run view 12345678 --json conclusion --jq '.conclusion')" = "failure" ]; then
  echo "Run failed, rerunning..."
  gh run rerun 12345678 --failed
else
  echo "Run successful"
fi
```

### Generate Report

```bash
#!/bin/bash
RUN_ID=$1
echo "# Workflow Run Report: $RUN_ID"
echo ""
echo "## Overview"
gh run view $RUN_ID --json workflowName,status,conclusion,headBranch,createdAt,updatedAt \
  --jq '"**Workflow:** \(.workflowName)
**Status:** \(.status)
**Conclusion:** \(.conclusion)
**Branch:** \(.headBranch)
**Created:** \(.createdAt)"'

echo ""
echo "## Jobs"
gh run view $RUN_ID --json jobs --jq '.jobs[] | "- **\(.name)**: \(.conclusion // .status)"'

echo ""
echo "## Failed Jobs"
gh run view $RUN_ID --log-failed
```

### Wait and View

```bash
# Wait for completion then show results
RUN_ID=$1
while [ "$(gh run view $RUN_ID --json status --jq '.status')" != "completed" ]; do
  sleep 10
done
gh run view $RUN_ID
gh run view $RUN_ID --log-failed
```

```
