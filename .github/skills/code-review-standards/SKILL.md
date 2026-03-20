---
name: code-review-standards
description: Code review checklist, severity definitions, and document templates. Load when performing code reviews or defining review criteria.
---

# Code Review Standards

Systematic approach to code review. Use this skill when:
- Performing code reviews
- Defining review criteria for a project
- Understanding severity levels for findings
- Creating code review documents

---

## Review Focus Areas

Use this checklist when reviewing implementation code:

| Category | What to Review |
|----------|----------------|
| **Architecture Alignment** | Does implementation match Architect's design? Follows system-architecture.md patterns? |
| **SOLID Principles** | SRP, OCP, LSP, ISP, DIP violations (load `engineering-standards` for detection patterns) |
| **DRY/YAGNI/KISS** | Duplication, speculative generalization, over-complexity |
| **TDD Compliance** | TDD Compliance table present in implementation doc? All rows show test-first? |
| **Code Smells** | Long Method, Large Class, Feature Envy, etc. (see `engineering-standards`) |
| **Documentation & Comments** | Appropriate inline comments explaining "why" (not "what"), function docstrings, module-level docs, complex logic explained |
| **Naming & Clarity** | Self-documenting names, appropriate abstractions, readable code |
| **Error Handling** | Defensive coding, graceful failures, appropriate exceptions |
| **Security Quick Scan** | Obvious vulnerabilities (injection, exposed secrets, hardcoded creds) |
| **Performance** | Obvious inefficiencies, N+1 patterns, memory leaks |
| **Observability** | Appropriate logging, telemetry for debugging |

---

## Severity Levels

| Severity | Definition | Action |
|----------|------------|--------|
| **CRITICAL** | Security vulnerability, data loss risk, architectural violation | REJECT - must fix |
| **HIGH** | Anti-pattern, significant maintainability issue, missing tests | REJECT - must fix |
| **MEDIUM** | Code smell, minor design issue, unclear code | Fix recommended, may approve with comments |
| **LOW** | Style preference, minor optimization opportunity | Note for future, approve |
| **INFO** | Observation, suggestion for improvement | FYI only |

### When to Reject

- Any CRITICAL finding → REJECT
- Any HIGH finding → REJECT
- 3+ MEDIUM findings in same file → Consider REJECT
- Pattern of MEDIUM findings across files → Consider REJECT

---

## Finding Format

When documenting findings, use this format:

```markdown
**[SEVERITY] [Category]**: [Brief title]
- **Location**: `path/to/file.py:L42-L55`
- **Issue**: [What's wrong and why it matters]
- **Recommendation**: [Specific fix suggestion]
```

**Example:**
```markdown
**[HIGH] Documentation**: Missing docstrings on public API
- **Location**: `src/api/handlers.py:L15-L45`
- **Issue**: Public functions `create_user()` and `delete_user()` lack docstrings. Future maintainers won't understand expected inputs/outputs.
- **Recommendation**: Add Google-style docstrings with Args, Returns, and Raises sections.
```

---

## Code Review Document Template

Create in `agent-output/code-review/` matching plan name:

```markdown
# Code Review: [Plan Name]

**Plan Reference**: `agent-output/planning/[plan-name].md`
**Implementation Reference**: `agent-output/implementation/[plan-name]-implementation.md`
**Date**: [date]
**Reviewer**: Code Reviewer

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| YYYY-MM-DD | [Who handed off] | [What was requested] | [Brief summary] |

## Architecture Alignment

**System Architecture Reference**: `agent-output/architecture/system-architecture.md`
**Alignment Status**: ALIGNED / MINOR_DEVIATIONS / MAJOR_DEVIATIONS

[Assessment of how implementation aligns with architectural decisions]

## TDD Compliance Check

**TDD Table Present**: Yes / No
**All Rows Complete**: Yes / No
**Concerns**: [Any issues with TDD compliance]

## Findings

### Critical
[List of critical findings, or "None"]

### High
[List of high findings, or "None"]

### Medium
[List of medium findings, or "None"]

### Low/Info
[List of low/info findings, or "None"]

## Positive Observations

[Acknowledge good patterns, well-written code, or improvements]

## Verdict

**Status**: APPROVED / APPROVED_WITH_COMMENTS / REJECTED
**Rationale**: [Brief explanation]

## Required Actions

[If rejected: specific list of fixes required]
[If approved with comments: optional improvements]

## Next Steps

[Handoff to Implementer for fixes / Handoff to QA for testing]
```

---

## Review Best Practices

1. **Be constructive**: Explain WHY something is an issue, not just THAT it's an issue
2. **Be specific**: File paths, line numbers, code snippets
3. **Provide solutions**: Concrete fix suggestions, not just criticism
4. **Acknowledge good work**: Note positive patterns when you see them
5. **Prioritize**: Focus on impactful issues, not nitpicks
6. **Context matters**: Consider the plan's constraints and timeline
