```prompt
# gh pr review - Review Pull Request Assistant

When the user asks for help reviewing pull requests, follow this structured workflow:

## Reviewing Pull Requests

The `gh pr review` command allows you to approve, request changes, or comment on PRs directly from the command line.

## Basic Usage

### Review Types

```bash
# Approve PR
gh pr review 42 --approve

# Request changes
gh pr review 42 --request-changes

# Comment without approval/rejection
gh pr review 42 --comment
```

## Review with Feedback

### 1. **Approve with Comment**

```bash
gh pr review 42 --approve --body "LGTM! Great implementation of scope validation.

Code quality is excellent and tests are comprehensive."
```

### 2. **Request Changes with Details**

```bash
gh pr review 42 --request-changes --body "Good progress, but needs some fixes:

## Required Changes
- Add type hints to new functions
- Extract magic numbers to constants
- Add docstrings for public methods

## Testing
- Add unit tests for edge cases
- Update integration tests

## Documentation
- Update CHANGELOG.md
- Add usage examples"
```

### 3. **Comment Only (No Approval/Rejection)**

```bash
gh pr review 42 --comment --body "A few suggestions:

- Consider using dataclass for scope context
- Performance looks good
- Documentation is clear

Nice work overall!"
```

## Review from File

```bash
# Read review feedback from file
gh pr review 42 --approve --body-file review_comments.md
```

## Complete Review Workflows

### Thorough Code Review

```bash
# 1. Checkout PR for testing
gh pr checkout 42

# 2. Run tests
pytest tests/ -v

# 3. Check code quality
flake8 pychivalry/
mypy pychivalry/

# 4. Review changes
git diff main...HEAD

# 5. Submit review
gh pr review 42 --approve --body "✅ Code Review Complete

## Testing
- All tests pass (142/142)
- Manually tested with sample files
- Performance verified

## Code Quality
- Type hints complete
- Documentation clear
- Follows project conventions

Approved for merge!"

# 6. Return to your branch
git checkout main
```

### Request Changes Workflow

```bash
# 1. Review code
gh pr view 42 --diff | less

# 2. Request changes with checklist
gh pr review 42 --request-changes --body "Please address these items:

## Code Quality
- [ ] Add type hints to scope_validator.py
- [ ] Extract SCOPE_TYPES constant
- [ ] Fix indentation in line 234

## Testing  
- [ ] Add test for empty scope chain
- [ ] Add test for invalid scope type
- [ ] Update integration test fixtures

## Documentation
- [ ] Add docstring to validate_scope_chain()
- [ ] Update CHANGELOG.md
- [ ] Add example to README

Please update when complete!"
```

### Quick Approval

```bash
# Simple approval for straightforward changes
gh pr review 42 --approve --body "LGTM! ✅"
```

## Review Multiple PRs

```bash
# Review multiple PRs in batch
for pr in 42 43 44; do
  gh pr view $pr --diff | less
  gh pr review $pr --approve --body "Approved"
done
```

## Review Best Practices Checklist

```bash
# Before reviewing, check:

# 1. View PR description
gh pr view 42

# 2. Check CI status
gh pr checks 42

# 3. Review file changes
gh pr view 42 --diff

# 4. Checkout and test locally
gh pr checkout 42
pytest tests/
npm test

# 5. Check code quality
# - Type hints present
# - Documentation complete
# - Tests comprehensive
# - No obvious bugs

# 6. Submit review
gh pr review 42 --approve --body "Thorough review complete. All checks pass."
```

## Review Options Reference

```bash
--approve              Approve PR
--request-changes      Request changes before merge
--comment              Comment without approval/rejection
--body TEXT            Review feedback
--body-file FILE       Read feedback from file
```

## Quick Reference

```bash
# Approve
gh pr review 42 --approve

# Approve with comment
gh pr review 42 --approve --body "LGTM!"

# Request changes
gh pr review 42 --request-changes --body "Please fix..."

# Comment only
gh pr review 42 --comment --body "Nice work!"

# Review from file
gh pr review 42 --approve --body-file review.md
```

## Troubleshooting

### Can't Submit Review

```bash
# Check permissions
gh auth status

# Ensure PR exists and is open
gh pr view 42
```

### Review Not Showing

```bash
# Refresh PR view
gh pr view 42 --web

# Check if review was submitted
gh pr view 42 --json reviews
```

## Best Practices

1. **Test Locally**: Checkout and run tests before reviewing
2. **Be Specific**: Provide clear, actionable feedback
3. **Be Constructive**: Focus on improvement, not criticism
4. **Check Everything**: Code, tests, docs, performance
5. **Use Checklists**: Ensure nothing is missed
6. **Approve Quickly**: Don't block good PRs unnecessarily
7. **Request Changes Clearly**: Use markdown formatting
8. **Follow Up**: Check if requested changes are addressed
9. **Praise Good Work**: Acknowledge excellent code
10. **Review Timely**: Don't leave PRs waiting

```
