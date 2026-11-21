---
name: after-action
description: After-action report skill for producing structured, succinct summaries of completed missions. Use after any multi-step task, implementation, review, or operational mission to give the user a clear picture of what happened, what changed, and what remains. Covers mission debrief, change inventory, officer contributions, decision log, and follow-up items.
---

# After-Action Report

Structured debrief format for summarizing completed missions. The goal is **maximum clarity in minimum words** — the user should be able to read this in under 60 seconds and know exactly what happened.

## When to Produce

Generate an after-action report:
- At the end of any mission that involved 2+ officers or 2+ phases
- After any implementation that changed files in the repository
- After any operational task that modified live systems
- When the user asks "what happened?" or "give me a summary"
- When handing off between Picard and the user at mission end

Do NOT generate for trivial single-step tasks (one file edit, one command run).

## Report Structure

Use this template. Omit sections that don't apply — an empty section is worse than a missing one.

```markdown
## After-Action Report

**Mission:** [One-sentence description of what was requested]
**Classification:** [Mission type and profile used, e.g., "Quick Fix" or "Full Mission"]
**Status:** [Complete | Partial | Blocked]

### What Changed

[Bulleted list of concrete changes. Be specific — file paths, config values, commit SHAs.]

- `path/to/file.ts` — Added rate limiting middleware (feat: add rate limiter, abc1234)
- `path/to/config.yaml` — Updated timeout from 30s to 60s
- `src/server/ck3/validation/` — New scope validator module created

### Who Did What

[One line per officer who contributed. Name, what they did, outcome.]

- **Data** — Researched existing middleware patterns, identified 3 candidates
- **Riker** — Coordinated implementation: dispatched Scotty (code) + Wesley (tests)
- **Scotty** — Implemented rate limiter in `src/middleware/rateLimit.ts` (45 lines)
- **Wesley** — Wrote 12 test cases, all passing
- **Crusher** — Code review: APPROVED, no issues
- **Worf** — Security scan: CLEAR, no vulnerabilities

### Reviews

[Verdicts from review officers. Only include if reviews were conducted.]

| Reviewer | Verdict | Notes |
|----------|---------|-------|
| Crusher | APPROVED | Clean implementation, good error handling |
| Worf | CLEAR | No injection vectors, input properly validated |
| Troi | ALIGNED | Delivers requested functionality |

### Decisions Made

[Any choices that were made during the mission — by the captain, by officers, or by the user.]

- Selected Express middleware pattern over custom HTTP interceptor (La Forge recommendation)
- Chose 100 req/min default limit (user confirmed)

### Outstanding Items

[Anything not finished, deferred, or needing follow-up. Empty = nothing outstanding.]

- [ ] Performance testing under load (Barclay — deferred, not blocking)
- [ ] Update API documentation to reflect rate limit headers (Guinan — next sprint)

### Commits

[List of commits created during this mission, if any.]

| SHA | Message |
|-----|---------|
| `abc1234` | feat: add rate limiter middleware |
| `def5678` | test: add rate limiter test suite |
```

## Writing Guidelines

### Be Concrete, Not Abstract

Bad: "Made improvements to the authentication system."
Good: "Added JWT token refresh logic in `src/auth/refresh.ts`. Tokens now auto-refresh 5 minutes before expiry."

Bad: "Several files were updated."
Good: "Modified 3 files: `src/auth/refresh.ts` (new), `src/auth/middleware.ts` (updated), `src/auth/types.ts` (updated)."

### Be Succinct, Not Verbose

Each bullet should be one line. If you need two sentences, the second sentence probably belongs in a sub-bullet or a different section. The user is busy — respect their time.

### Include the "Why" for Decisions

Don't just state what was decided — state why, in a short clause:
- "Selected Redis over in-memory cache — data must survive restarts"
- "Deferred performance testing — user confirmed not blocking for this PR"

### Status Definitions

| Status | Meaning |
|--------|---------|
| **Complete** | All requested work done, all reviews passed, no blockers |
| **Partial** | Some work done, remaining items listed in Outstanding |
| **Blocked** | Cannot proceed without user input or external dependency |

### Review Verdicts

| Verdict | Meaning |
|---------|---------|
| **APPROVED** | Code review passed, no blocking issues |
| **CLEAR** | Security scan passed, no vulnerabilities found |
| **ALIGNED** | Value assessment confirms implementation matches request |
| **CHANGES REQUESTED** | Issues found, listed in notes — not ready to merge |
| **CRITICAL** | Blocking security or correctness issue — must fix before proceeding |

## Partial Reports

When a mission is still in progress but a checkpoint summary is needed (user asks "where are we?"), use this abbreviated format:

```markdown
## Mission Status

**Mission:** [One sentence]
**Phase:** [Current phase, e.g., "Phase 2: Implementation"]

### Completed
- [What's done so far]

### In Progress
- [Who is working on what right now]

### Remaining
- [What hasn't started yet]

### Blockers
- [Anything preventing progress, if any]
```
