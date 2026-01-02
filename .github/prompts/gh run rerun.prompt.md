```prompt
# gh run rerun - Re-run GitHub Actions Workflow Assistant

When the user asks for help re-running GitHub Actions workflows, follow this structured workflow:

## Re-running Workflows

The `gh run rerun` command allows you to re-execute workflow runs, either entirely or just the failed jobs, useful for transient failures and flaky tests.

## Basic Usage

### Re-run Entire Workflow

```bash
# Re-run all jobs in workflow
gh run rerun 12345678

# Starts fresh run with same parameters
```

### Re-run Failed Jobs Only

```bash
# Re-run only jobs that failed
gh run rerun 12345678 --failed

# Saves time and resources
# More efficient for flaky tests
```

## Re-run Workflows

### Re-run Latest Failed CI

```bash
# Get latest CI run
RUN_ID=$(gh run list --workflow=ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')

# Check if failed
if [ "$(gh run view $RUN_ID --json conclusion --jq '.conclusion')" = "failure" ]; then
  gh run rerun $RUN_ID --failed
fi
```

### Re-run with Debug Logging

```bash
# Enable debug mode (if workflow supports it)
gh run rerun 12345678 --debug

# Shows more detailed logs
# Requires workflow to have debug triggers
```

### Re-run After Fix

```bash
# Workflow failed due to flaky test

# 1. View failure
gh run view 12345678 --log-failed

# 2. Determine if transient (network timeout, race condition)
# 3. Re-run failed jobs
gh run rerun 12345678 --failed

# 4. Monitor
gh run view $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId') --log
```

## Complete Re-run Workflows

### Flaky Test Recovery

```bash
# CI failed on flaky test

# 1. Check which jobs failed
gh run view 12345678 --json jobs --jq '.jobs[] | select(.conclusion=="failure") | .name'

# 2. View error
gh run view 12345678 --log-failed | tail -50

# 3. If transient error (timeout, connection), re-run
gh run rerun 12345678 --failed

# 4. Watch new run
watch -n 5 'gh run list --limit 1'
```

### Deployment Retry

```bash
# Deployment failed due to temporary outage

# 1. Verify outage resolved
# 2. Re-run deployment
gh run rerun 12345678

# 3. Monitor deployment
gh run view $(gh run list --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

### Bulk Re-run Failed Runs

```bash
# Re-run all recent failures

# Get failed run IDs
FAILED_RUNS=$(gh run list --limit 20 --json databaseId,conclusion --jq '.[] | select(.conclusion=="failure") | .databaseId')

# Re-run each
for run_id in $FAILED_RUNS; do
  echo "Re-running $run_id..."
  gh run rerun $run_id --failed
  sleep 5  # Avoid rate limiting
done
```

### Conditional Re-run

```bash
# Re-run if specific job failed

RUN_ID=12345678
FAILED_JOB=$(gh run view $RUN_ID --json jobs --jq '.jobs[] | select(.name=="test" and .conclusion=="failure") | .name')

if [ -n "$FAILED_JOB" ]; then
  echo "Test job failed, re-running..."
  gh run rerun $RUN_ID --failed
else
  echo "Test job passed"
fi
```

## Re-run Strategies

### Strategy 1: Re-run Failed Only (Recommended)

```bash
# Most efficient, only re-executes failures
gh run rerun 12345678 --failed

# Use when:
# - Flaky tests
# - Transient network errors
# - Temporary service outages
# - Random timeouts
```

### Strategy 2: Re-run Entire Workflow

```bash
# Re-executes all jobs
gh run rerun 12345678

# Use when:
# - Suspected state corruption
# - Need full test run
# - Build caching issues
# - Dependency problems
```

### Strategy 3: Debug Re-run

```bash
# Re-run with enhanced logging
gh run rerun 12345678 --debug

# Use when:
# - Intermittent failures
# - Need detailed traces
# - Debugging race conditions
```

## Monitoring Re-runs

### Get New Run ID After Re-run

```bash
# Re-run creates new run
gh run rerun 12345678

# Get new run ID
sleep 5  # Wait for creation
NEW_RUN_ID=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')

# View new run
gh run view $NEW_RUN_ID
```

### Watch Re-run Progress

```bash
# Start re-run
gh run rerun 12345678 --failed

# Monitor
sleep 5
NEW_RUN=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')

# Watch until complete
while [ "$(gh run view $NEW_RUN --json status --jq '.status')" != "completed" ]; do
  clear
  gh run view $NEW_RUN
  sleep 10
done

# Final result
gh run view $NEW_RUN
```

### Compare Original and Re-run

```bash
ORIGINAL=12345678
gh run rerun $ORIGINAL --failed
sleep 5
RERUN=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')

# Compare conclusions
echo "Original: $(gh run view $ORIGINAL --json conclusion --jq '.conclusion')"
echo "Re-run:   $(gh run view $RERUN --json conclusion --jq '.conclusion')"
```

## Best Practices

### When to Re-run Failed Jobs

```bash
# Re-run --failed when:
# - Flaky tests (random failures)
# - Network timeouts
# - Rate limiting errors
# - Temporary service unavailability
# - Known intermittent issues

gh run rerun 12345678 --failed
```

### When to Re-run Entire Workflow

```bash
# Re-run full when:
# - Build cache corruption
# - State management issues
# - Need complete validation
# - Previous run had setup problems

gh run rerun 12345678
```

### When NOT to Re-run

```bash
# Don't re-run if:
# - Code has actual bug (fix first)
# - Test has real failure (fix test)
# - Configuration error (update config)
# - Reproducible failure (investigate first)

# Instead:
# 1. Fix the issue
# 2. Push new commit
# 3. New workflow run automatically triggers
```

## Scripting Re-runs

### Auto-retry Flaky CI

```bash
#!/bin/bash
MAX_RETRIES=3
RUN_ID=$1

for i in $(seq 1 $MAX_RETRIES); do
  CONCLUSION=$(gh run view $RUN_ID --json conclusion --jq '.conclusion')
  
  if [ "$CONCLUSION" = "success" ]; then
    echo "✅ Run successful"
    exit 0
  fi
  
  echo "Attempt $i of $MAX_RETRIES: Re-running failed jobs..."
  gh run rerun $RUN_ID --failed
  
  # Wait for completion
  sleep 30
  RUN_ID=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
  
  while [ "$(gh run view $RUN_ID --json status --jq '.status')" != "completed" ]; do
    sleep 10
  done
done

echo "❌ Failed after $MAX_RETRIES attempts"
exit 1
```

### Re-run Nightly Failed Tests

```bash
#!/bin/bash
# Re-run all failed nightly tests

FAILED_RUNS=$(gh run list \
  --workflow=nightly.yml \
  --limit 10 \
  --json databaseId,conclusion,createdAt \
  --jq '.[] | select(.conclusion=="failure" and (.createdAt | startswith("2026-01"))) | .databaseId')

for run_id in $FAILED_RUNS; do
  echo "Re-running $run_id..."
  gh run rerun $run_id --failed
done
```

## Common Options Reference

```bash
--failed          Re-run only failed jobs
--debug           Enable debug logging (if workflow supports)
```

## Quick Reference

```bash
# Re-run all jobs
gh run rerun 12345678

# Re-run failed jobs only
gh run rerun 12345678 --failed

# Re-run with debug
gh run rerun 12345678 --debug

# Re-run latest failed
gh run rerun $(gh run list --limit 1 --json databaseId,conclusion --jq '.[] | select(.conclusion=="failure") | .databaseId')
```

## Troubleshooting

### Can't Re-run Workflow

```bash
# Check permissions
gh auth status

# Verify run exists
gh run view 12345678

# Some runs can't be re-run (very old, deleted)
```

### Re-run Not Starting

```bash
# Wait a moment
sleep 5
gh run list --limit 1

# Check workflow queue
gh run list --status queued

# May be rate limited
```

### Debug Option Not Working

```bash
# Workflow must support debug mode
# Check workflow file for:
# on:
#   workflow_dispatch:
#     inputs:
#       debug_enabled:
#         type: boolean

# Not all workflows have this
```

## Best Practices

1. **Re-run Failed First**: More efficient than full re-run
2. **Investigate Before Re-running**: Don't blindly retry
3. **Limit Retries**: Max 2-3 attempts for flaky tests
4. **Fix Root Cause**: Don't rely on re-runs for persistent failures
5. **Monitor Re-run Results**: Track success rates
6. **Document Flaky Tests**: Note patterns in re-run needs
7. **Use Retries in Tests**: Better than workflow re-runs
8. **Check Logs First**: Understand failure before re-running
9. **Avoid Rate Limits**: Space out bulk re-runs
10. **Clean Up Old Runs**: Don't re-run very old workflows

## Warning: Re-runs Count Against CI Limits

⚠️ **Re-running workflows consumes CI minutes/credits**

- Each re-run uses compute resources
- Counts toward monthly limits
- Consider fixing flaky tests instead of frequent re-runs
- Use `--failed` to minimize wasted compute

```
