---
name: project-checkup
description: Run a comprehensive health check on the project including linting, tests, security scanning, dependency audits, and code quality metrics. Use this when asked to assess project health, run diagnostics, perform a checkup, or validate that the codebase is in good shape before a release or deployment.
---

# Project Checkup

Perform a full diagnostic assessment of the project's health. This skill automates the discovery and execution of available checks, then produces a structured report.

## When to Use

- Before a deployment or release
- After a major implementation to validate overall project health
- When asked to "check", "audit", "diagnose", or "assess" the project
- As part of a code review or quality gate

## Procedure

### Step 1: Discover the Project Stack

Examine the repository root to determine which tools and frameworks are in use:

- Look for `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `Gemfile`, `Taskfile.yml`, `Makefile`, etc.
- Identify available task runners (Taskfile, Make, npm scripts, etc.)
- Note the primary language(s) and framework(s)

### Step 2: Run the Checkup Script

Execute the [checkup script](./run-checkup.sh) to auto-detect and run available checks:

```bash
bash .github/skills/project-checkup/run-checkup.sh
```

The script will:
1. Detect available package managers and task runners
2. Run linters if configured
3. Run tests if configured
4. Run security/dependency audits if available
5. Output results in a structured format

If the script cannot run (permissions, missing tools), fall back to running checks manually based on what was discovered in Step 1.

### Step 3: Produce the Diagnostic Report

Use the [report template](./report-template.md) to structure findings. Fill in each section with results from the checks. Every finding must include:

- **Location** — file path and line number where applicable
- **Severity** — CRITICAL / HIGH / MEDIUM / LOW
- **Description** — what the issue is
- **Prescription** — how to fix it

### Step 4: Deliver the Verdict

Conclude with one of:

| Verdict | Meaning |
| ------- | ------- |
| **APPROVED** | All checks pass. Project is healthy. |
| **NEEDS_TREATMENT** | Issues found that should be addressed. |
| **QUARANTINE** | Critical issues that block deployment. |

## Notes

- Do not skip checks that are available. Run everything that exists.
- If a tool is not installed, note it as "unavailable" rather than failing silently.
- Always report clean results too — a clean bill of health has value.
