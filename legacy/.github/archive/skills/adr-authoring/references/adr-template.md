# ADR NNN: [Descriptive Title]
<!-- Replace NNN with zero-padded ID (e.g., 008) and supply a concise, action-oriented title. -->

**Status:** [Proposed | Accepted | Deprecated | Superseded]
**Date:** [YYYY-MM-DD]
**Context:** ck3-language-support [Area or subsystem]
**Related:** [ADR 001, ADR 002, docs/... | Optional]
<!-- List related ADRs/docs; use "ADR NNN" format and repo-relative doc paths. -->

---

## Context
<!-- Describe the driving problem. Include audit quotes, failure logs, and evidence from this repo. -->
- **Problem Summary:** [What broke or needs standardization?]
- **Scope:** [Components impacted: server subsystems, extension client, webpack config, CK3 schemas, GitHub Actions, etc.]
- **Evidence:**

  ```bash
  # paste log excerpts / task output showing the issue
  ```

- **Code References:**

  ```typescript
  # cite snippets from source files, config, workflows, etc.
  ```

> Quote audit findings or stakeholder requirements here.

## Decision
<!-- Capture numbered sub-decisions. Each includes a Rule + Implementation snippet. -->
### 1. [Sub-Decision Title]

**Rule:** [One-sentence policy statement.]
**Implementation:**

```typescript
# show the code/config/enforcement for this rule (TypeScript/JSON/bash)
```

### 2. [Sub-Decision Title]

**Rule:** [...]
**Implementation:**

```json
// additional enforcement example (ESLint config, Taskfile, CI job)
```

## Alternatives Considered
<!-- Document at least two alternatives with ❌ reasoning pairs. -->
### Alternative 1: [Title]

- ❌ **Approach:** [Describe what this alternative proposed.]
- ❌ **Rejected Because:** [List concrete reasons referencing repo constraints.]

### Alternative 2: [Title]

- ❌ **Approach:** [...]
- ❌ **Rejected Because:** [...]

## Consequences
<!-- Break outcomes into Positive/Negative/(Neutral)/Mitigations with emojis. -->
### Positive (✅)

- [Benefit #1]
- [Benefit #2]

### Negative (⚠️)

- [Risk/Cost #1]
- [Risk/Cost #2]

### Neutral (🔵)

- [Optional side effect]

### Mitigations

- [How risks are reduced: guardrails, monitoring, docs]

## Implementation
<!-- Provide rollout plan with enforcement points. -->
1. **Taskfile Updates:**

   ```yaml
   # add/modify Taskfile targets enforcing this ADR
   ```

2. **CI/CD Enforcement:**

   ```yaml
   # workflow/job snippet pinning validators, ESLint, TypeScript compiler checks, etc.
   ```

3. **Linting & Hooks:** Reference `.pre-commit-config.yaml`, `.eslintrc.json`, `tsconfig.json` strict checks.
4. **Testing:** Detail VS Code extension tests, unit tests, integration tests, or GitHub Actions jobs verifying compliance.

## Examples
<!-- Provide full, working examples pulled from or modeled on repo paths. -->
### Example 1: [Title]

```typescript
// e.g., src/server/ck3/validation/scopes.ts implementing the decision
```

### Example 2: [Title]

```json
// e.g., .eslintrc.json or tsconfig.json enforcing the decision
```

## References
<!-- Bullet list of related ADRs, docs, external standards. -->
- [Related ADR if applicable]
- [.github/copilot-instructions.md](../../../copilot-instructions.md)
- [.github/instructions/typescript.instructions.md](../../../instructions/typescript.instructions.md)
- [External Spec or Blog]

---

## Review History
<!-- Chronological bullets capturing reviews and updates. -->
- [YYYY-MM-DD] – [Reviewer / Agent] – [Action taken]

---

## Notes
<!-- Success metrics, monitoring hooks, future revisit dates. -->
- **Success Metrics:** [e.g., "$\text{Task Success Rate} > 99\%$ after rollout"]
- **Follow-ups:** [Next ADR, telemetry tasks]
- **Sunset Criteria:** [When to revisit or deprecate]
