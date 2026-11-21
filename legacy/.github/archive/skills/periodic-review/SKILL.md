---
name: periodic-review
description: Orchestrate a structured periodic review of project health across six areas — code health, security posture, documentation currency, architecture alignment, test coverage, and dependency freshness. Use when asked to run a health check, periodic review, audit, or project assessment.
---

# Periodic Review

A structured, multi-area review process that goes beyond automated checks to assess the overall health of the project. This skill coordinates six review areas, each led by a specialist officer, and produces a consolidated health report.

## When to Trigger

**Recommended cadence:**

- After a major feature lands or a release ships
- Before starting a new development phase or sprint
- When the project has been idle and work is resuming
- Monthly for active projects, quarterly for stable ones
- When asked to "review," "audit," "assess health," or "check the project"

**Trigger events (run immediately):**

- Major dependency upgrade
- Infrastructure or architecture change
- New team member onboarding
- Post-incident review

## Procedure

### Step 0: Automated Baseline

Run the `project-checkup` skill first. This establishes the automated baseline — linting, tests, security scans, build validation. The periodic review builds on top of this with human-judgment areas that tools can't automate.

```bash
bash .github/skills/project-checkup/run-checkup.sh
```

Record the checkup verdict (APPROVED / NEEDS_TREATMENT / QUARANTINE) in the review report.

### Step 1: Code Health (Dr. Crusher)

**Skills:** `project-checkup`, `code-review-standards`

- Review the project-checkup results for lint, test, and build status
- Identify code smells, dead code, and overly complex functions
- Check for TODO/FIXME/HACK comments that have gone stale
- Assess error handling patterns — are errors caught and handled consistently?
- Look for anti-patterns: god functions, deep nesting, copy-paste duplication

**Report as:** GREEN (clean) / YELLOW (issues noted) / RED (blocking problems)

### Step 2: Security Posture (Lt. Worf)

**Skills:** `security-patterns`

- Review dependency vulnerability scan results from project-checkup
- Check for hardcoded secrets, API keys, or credentials in code and configs
- Assess access control patterns — are permissions properly scoped?
- Review secret handling — are credentials properly managed?
- Check for exposed ports, overly permissive firewall rules, or insecure defaults
- Verify TLS/SSH configurations are current

**Report as:** GREEN / YELLOW / RED with severity ratings per finding

### Step 3: Documentation Currency (Guinan)

**Skills:** `document-lifecycle`

- Check README files — do they reflect the current state of the project?
- Review inline documentation — are comments accurate or stale?
- Verify runbooks and operational docs match current procedures
- Check for missing documentation: undocumented modules, config options, or workflows
- Assess onboarding path — could a new contributor get started with current docs?
- Check for broken links and outdated references

**Report as:** GREEN / YELLOW / RED

### Step 4: Architecture Alignment (Lt. Cmdr. La Forge)

**Skills:** `architecture-patterns`

- Review ADRs — are they current? Are recent decisions documented?
- Check for pattern drift — is the codebase following its stated patterns?
- Identify technical debt accumulation since last review
- Assess module boundaries — are concerns properly separated?
- Look for coupling that has grown organically and should be addressed
- Check that infrastructure patterns match documented architecture

**Report as:** GREEN / YELLOW / RED

### Step 5: Test Coverage (Wesley Crusher)

**Skills:** `testing-patterns`

- Run test suite and assess pass/fail status
- Check coverage metrics — are critical paths covered?
- Identify untested modules or functions
- Assess test quality — are tests testing behavior or implementation?
- Check for flaky tests that undermine confidence
- Review test pyramid balance — right ratio of unit/integration/E2E?

**Report as:** GREEN / YELLOW / RED with coverage numbers

### Step 6: Dependency Freshness (Chief O'Brien)

**Skills:** `release-procedures`

- Check for outdated dependencies (major, minor, patch)
- Identify dependencies at end-of-life or no longer maintained
- Review lock file hygiene — is the lock file committed and current?
- Check for version pinning strategy — are versions pinned appropriately?
- Assess upgrade risk — which outdated deps are high-risk to upgrade?
- Verify that tool versions are current (TypeScript, webpack, ESLint)

**Report as:** GREEN / YELLOW / RED with specific upgrade recommendations

### Step 7: Synthesis (Counselor Troi)

After all six areas report, Troi synthesizes findings into an overall assessment:

- Consolidate all area reports into the review template
- Assign an overall health score: **GREEN** / **YELLOW** / **RED**
- Prioritize action items by severity and impact
- Compare to previous review if available — is the project trending healthier or sicker?
- Recommend specific next actions with assigned officers

## Escalation Criteria

| Severity | Action | Timeline |
| -------- | ------ | -------- |
| **RED (Critical)** | Immediate remediation required. Block new feature work until resolved. | This sprint |
| **YELLOW (Warning)** | Add to backlog with priority. Track in next review. | Next 2 sprints |
| **GREEN (Healthy)** | No action needed. Acknowledge in report. | N/A |

## Report Output

Use the [review report template](./references/review-report-template.md) to structure findings. Store completed reports in the project's `plans/` directory with naming convention:

```
plans/periodic-review-YYYY-MM-DD.md
```

## Mission Profile

When orchestrated by Picard, the review follows this parallel execution pattern:

```text
Phase 1: Crusher (code health) || Worf (security) || Wesley (tests) || O'Brien (deps)
Phase 2: La Forge (architecture) || Guinan (documentation)
Phase 3: Troi (synthesize all findings)
Phase 4: Picard (report to user)
```

Phases 1 and 2 are separated because architecture and documentation reviews benefit from seeing code health and dependency results first.
