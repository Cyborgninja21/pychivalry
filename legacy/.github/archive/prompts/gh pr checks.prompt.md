```prompt
# gh pr checks - View PR CI/CD Checks Assistant

When the user asks for help viewing PR checks and CI/CD status, follow this structured workflow:

## Viewing PR Checks

The `gh pr checks` command displays the status of CI/CD checks (GitHub Actions, external CI) for a pull request.

## Basic Usage

### View Checks for PR

```bash
# View checks for specific PR
gh pr checks 42

# View checks for current branch's PR
gh pr checks
```

Output shows:
- Check name
- Status (✓ pass, ✗ fail, * pending)
- Elapsed time
- Link to logs

### Watch Checks in Real-Time

```bash
# Watch checks update live
gh pr checks 42 --watch

# Useful for monitoring CI progress
# Updates every few seconds
# Press Ctrl+C to exit
```

## Check Status Interpretation

### Status Symbols

```bash
✓ - Check passed
✗ - Check failed
* - Check pending/in progress
- - Check skipped
```

### Example Output

```bash
$ gh pr checks 42

All checks have passed
✓ CI / build (2m 34s)
✓ CI / test (5m 12s)
✓ CI / lint (1m 5s)
✓ CodeQL (3m 45s)
✓ Dependency Review (45s)
```

Or with failures:

```bash
$ gh pr checks 42

Some checks were not successful
✓ CI / build (2m 34s)
✗ CI / test (5m 12s)
✓ CI / lint (1m 5s)
* CI / deploy (in progress)
```

## Complete Check Workflows

### Monitor CI Progress

```bash
# 1. Push changes
git push

# 2. Watch checks
gh pr checks --watch

# 3. If failure, view logs
gh run view --log

# 4. Fix and re-run
# ... fix code ...
git push
gh pr checks --watch
```

### Pre-Merge Verification

```bash
# Verify all checks pass before merging
gh pr checks 42

# If all pass, proceed with merge
if gh pr checks 42 | grep -q "All checks have passed"; then
  gh pr merge 42 --squash --delete-branch
else
  echo "❌ Checks not passing. Cannot merge."
fi
```

### Debug Failed Checks

```bash
# 1. View which checks failed
gh pr checks 42

# 2. Get run ID from check name
gh run list --workflow="CI"

# 3. View detailed logs
gh run view <run-id> --log

# 4. View specific job
gh run view <run-id> --job="test" --log
```

## Scripting with Checks

### Check if All Pass

```bash
# Exit code based approach
if gh pr checks 42 > /dev/null 2>&1; then
  echo "✅ All checks passed"
else
  echo "❌ Some checks failed"
fi
```

### Wait for Checks to Complete

```bash
# Poll until checks complete
while gh pr checks 42 | grep -q "in progress"; do
  echo "⏳ Waiting for checks..."
  sleep 30
done

echo "✅ All checks completed"
gh pr checks 42
```

### Auto-merge When Checks Pass

```bash
# Enable auto-merge (merges when checks pass)
gh pr merge 42 --auto --squash

# Check will merge automatically when:
# - All required checks pass
# - PR is approved
# - No merge conflicts
```

## Integration with Other Commands

### Combine with PR View

```bash
# View PR and checks together
gh pr view 42 && echo "\n=== Checks ===" && gh pr checks 42
```

### Trigger Re-run

```bash
# If checks fail due to flakiness
# Get run ID and re-run
gh run list --workflow="CI" | head -1
gh run rerun <run-id>

# Watch re-run
gh pr checks 42 --watch
```

## Common Check Scenarios

### All Passing

```bash
$ gh pr checks 42
All checks have passed
✓ CI / build (2m 34s)
✓ CI / test (5m 12s)
✓ CI / lint (1m 5s)

# Safe to merge
```

### Some Failing

```bash
$ gh pr checks 42
Some checks were not successful
✓ CI / build (2m 34s)
✗ CI / test (5m 12s)
✓ CI / lint (1m 5s)

# View test logs
gh run view --log | grep "FAILED"
```

### In Progress

```bash
$ gh pr checks 42
* CI / build (in progress)
* CI / test (pending)
- CI / lint (pending)

# Wait or watch
gh pr checks 42 --watch
```

## Quick Reference

```bash
# View checks
gh pr checks 42

# Watch in real-time
gh pr checks 42 --watch

# Check current branch
gh pr checks

# Combine with other commands
gh pr view 42 && gh pr checks 42
```

## Troubleshooting

### No Checks Shown

```bash
# Ensure workflows are configured
ls -la .github/workflows/

# Check if PR triggered workflows
gh run list --branch <pr-branch>
```

### Checks Stuck "Pending"

```bash
# View workflow runs
gh run list

# Check if workflow is running
gh run view <run-id>

# May need to re-trigger
gh workflow run <workflow-name>
```

### Can't View Logs

```bash
# Check permissions
gh auth status

# View in browser
gh pr view 42 --web
```

## Best Practices

1. **Watch for Long-Running Checks**: Use `--watch` to monitor
2. **Investigate Failures Immediately**: Don't let them linger
3. **Re-run Flaky Tests**: Some failures are transient
4. **Check Before Merge**: Always verify checks pass
5. **Use Auto-merge**: Let GitHub merge when ready
6. **Monitor Required Checks**: Ensure critical checks pass
7. **Debug Locally First**: Reproduce failures locally
8. **Don't Bypass Checks**: Maintain quality standards
9. **Set Reasonable Timeouts**: Prevent hung workflows
10. **Document Check Requirements**: Make expectations clear

```
