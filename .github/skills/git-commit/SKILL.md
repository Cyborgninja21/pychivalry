---
name: git-commit
description: Git commit workflow for creating clean, atomic, well-messaged commits. Use when committing code changes, checkpointing work, or preparing commits for review. Covers conventional commit format, pre-commit safety checks, co-author attribution, and recovery from hook failures.
---

# Git Commit Workflow

Structured procedure for creating commits that are safe, atomic, and well-documented.

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

### Types

| Type | When | Example |
|------|------|---------|
| `feat` | New functionality | `feat: add rate limiter middleware` |
| `fix` | Bug fix | `fix: resolve Muninn 401 by adding provider override` |
| `refactor` | Code change that neither fixes nor adds | `refactor: extract auth logic into shared module` |
| `chore` | Maintenance, deps, tooling | `chore: update vscode-languageserver to 9.0.1` |
| `docs` | Documentation only | `docs: add MCP tools reference` |
| `test` | Adding or fixing tests | `test: add integration tests for DNS validation` |
| `ci` | CI/CD pipeline changes | `ci: add format-check step to workflow` |
| `style` | Formatting, whitespace (no logic change) | `style: fix YAML indentation in prod configs` |
| `perf` | Performance improvement | `perf: reduce API calls in state refresh` |

### Scope

Optional. Use when the change is confined to a specific area:

```
feat(validation): implement scope chain validator
fix(completions): correct trigger completion ordering
chore(deps): update vscode-languageserver to 9.0.1
```

### Description

- Imperative mood: "add feature" not "added feature" or "adds feature"
- Lowercase first letter
- No period at the end
- Under 72 characters

### Body

Use when the description alone doesn't explain *why*:

```
fix(prod/eljudnir): correct network bridge assignment

The VM was using vmbr0 (management) instead of the services bridge.
This caused DNS resolution failures for internal services.
```

## Pre-Commit Checklist

Run these checks **before every commit**:

### 1. Review staged changes

```bash
git diff --cached --stat        # What files are staged
git diff --cached               # Full diff of staged changes
```

### 2. Check for secrets

Never commit files containing credentials, tokens, or keys. Watch for:

- `.env` files, `credentials.json`, `*.pem`, `*.key`
- Inline tokens, passwords, API keys in code
- Encrypted files that were accidentally decrypted

```bash
# Quick scan for common secret patterns in staged files
git diff --cached | grep -iE '(password|secret|token|api_key|private_key)\s*[:=]' && echo "WARNING: Possible secrets detected"
```

### 3. Check for debug artifacts

```bash
git diff --cached | grep -iE '(console\.log|debugger|TODO:.*remove|FIXME:.*temp)' && echo "WARNING: Debug artifacts detected"
```

### 4. Verify you're on the right branch

```bash
git branch --show-current
```

## Commit Procedure

### Standard commit

```bash
git add <specific files>
git commit -m "$(cat <<'EOF'
feat(scope): description of the change

Optional body explaining why.

Co-Authored-By: Agent Name <noreply@anthropic.com>
EOF
)"
```

### Rules

- **Add specific files by name.** Never use `git add .` or `git add -A` — these can sweep in secrets, build artifacts, or unrelated changes.
- **One logical change per commit.** If you changed the middleware AND updated the tests, that can be one commit if they're tightly coupled. If you also fixed an unrelated typo, that's a separate commit.
- **Always include Co-Authored-By** when an AI agent wrote or substantially modified the code.

## Checkpoint Discipline

When working on multi-step implementations, commit after each discrete unit:

```
feat(auth): add middleware skeleton              # After creating the file
feat(auth): implement token validation logic     # After writing the core logic
feat(auth): wire middleware into app router      # After integration
test(auth): add token validation test suite      # After tests pass
```

This gives a clean rollback trail. If step 3 breaks something, revert to step 2 without losing work.

**Frequency rule:** If you've been working for more than a few minutes without a commit, something is wrong. Commit what you have.

## When Pre-Commit Hooks Fail

If a hook (lint, format, validate) rejects the commit:

1. **The commit did NOT happen.** Your changes are still staged.
2. **Read the hook output** — it tells you what failed and usually how to fix it.
3. **Fix the issue** in your working tree.
4. **Re-stage the fixed files:** `git add <fixed files>`
5. **Create a NEW commit** — do NOT use `--amend` (that would modify the *previous* commit, not the failed one).
6. **Never use `--no-verify`** to skip hooks unless explicitly authorized by the user.

## Co-Author Attribution

Always include when an agent wrote or substantially modified the committed code:

```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Use the model that actually wrote the code, not the model of the agent dispatching the work.

## What NOT to Commit

| Item | Why |
|------|-----|
| `.env`, credentials, keys | Security — use environment variables or secrets manager |
| Build artifacts, `node_modules/` | Regenerated from lock files |
| Large binaries | Use Git LFS or external storage |
| `.vsix` packages | Regenerated from `vsce package` |
