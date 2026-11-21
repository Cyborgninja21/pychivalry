---
name: analysis-methodology
description: Systematic methodology for converting unknowns to knowns through structured investigation. Use when performing root-cause analysis, debugging complex issues, conducting codebase audits, or any investigative task requiring evidence-based findings. Provides confidence-level classification (Proven/Observed/Inferred), gap tracking templates, investigation techniques (log tracing, component isolation, binary search debugging, POC execution, upstream tracing), and a structured handoff protocol for multi-agent workflows.
---

# Analysis Methodology

A systematic approach to converting unknowns to knowns through structured investigation.

## Core Principle

**Objective**: Every analysis session should reduce uncertainty. If an unknown cannot be resolved, document *why* and *what is needed* to close it.

---

## Confidence Levels

Classify every finding by its evidence strength:

| Level | Label | Meaning | Example |
|---|---|---|---|
| 1 | **Proven** | Verified by code execution, POC, or reproducible test. | "Running `npm test -- --filter=X` confirms the error." |
| 2 | **Observed** | Seen in logs, monitoring, or direct inspection, but not isolated. | "The error appears in production logs at 3am." |
| 3 | **Inferred** | Derived from documentation, patterns, or logical deduction. | "The API docs suggest this should return 404." |

**Rule**: Findings at Level 3 (Inferred) should be flagged for upgrade to Level 1 (Proven) before being used for decisions.

---

## Gap Tracking Template

Use this structure to surface remaining unknowns:

```markdown
## Remaining Gaps

| # | Unknown | Blocker | Required Action | Owner |
|---|---------|---------|-----------------|-------|
| 1 | Why does X fail under load? | Cannot reproduce locally. | Need staging access or load test harness. | [TBD] |
| 2 | Does API Y support pagination? | Docs unclear. | Contact vendor or run POC against sandbox. | [TBD] |
```

**Behaviors**:
- Populate this table during investigation, not just at the end.
- Surface the table to the user in chat before handoff.
- Mark items as "Resolved" (with link to finding) or "Deferred" (with rationale).

---

## Investigation Techniques

Use these patterns to move unknowns to knowns:

### Log Tracing
- Add targeted logging to isolate behavior.
- Compare expected vs actual log sequences.

### Component Isolation
- Reproduce behavior with minimal dependencies.
- Use mocks/stubs to eliminate variables.

### Binary Search Debugging
- Narrow the failure window by bisecting commits, config changes, or code paths.
- Halve the search space with each step.

### POC Execution
- Write minimal, runnable code to prove or disprove a behavior.
- POCs must be reproducible by others (check in or share).

### Upstream Tracing
- Follow data/control flow backward to find the root cause.
- Ask: "Where did this value *come from*?"

---

## Analysis Document Structure

Recommended sections for analysis outputs:

1. **Changelog** — Date, handoff context, outcome summary.
2. **Value Statement & Objective** — Why this analysis matters.
3. **Context** — Background, scope, constraints.
4. **Methodology** — What techniques were used (reference above).
5. **Findings** — Factual results, classified by Confidence Level.
6. **Gap Tracking Table** — (see template above).
7. **Analysis Recommendations** — Next steps *to deepen inquiry* (not solutions).
8. **Open Questions** — Unresolved items requiring user/agent input.

---

## Handoff Protocol

Before handing off to another agent or user:

1. **List resolved unknowns** — What was determined and at what confidence level.
2. **List remaining gaps** — Use the Gap Tracking Table.
3. **State blockers explicitly** — What prevents further progress.
4. **Communicate in chat** — Do not rely solely on the document; surface gaps directly.
