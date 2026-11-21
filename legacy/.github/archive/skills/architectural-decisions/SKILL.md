---
name: architectural-decisions
description: >-
  Author Architectural Decision documents for the docs/architecture/decisions/
  directory. Trigger this skill when asked to create, draft, or write a new
  architectural decision, or when a technology choice, design pattern, or
  infrastructure strategy needs formal documentation.
---

# Architectural Decisions Skill

## Purpose

This skill produces Architectural Decision documents for `docs/architecture/decisions/`. These are **distinct** from the ADRs in `docs/adr/` — different format, different numbering, different conventions.

Use this skill when:

- A technology choice needs to be documented (tool selection, platform choice)
- A design pattern or infrastructure strategy is being formalized
- An existing architectural decision needs to be superseded or deprecated
- Someone asks to "write an architectural decision" or "document a decision"

Do **not** use this skill for the audit-driven ADRs in `docs/adr/` — use the `adr-authoring` skill for those.

## How This Differs from `docs/adr/` ADRs

| Aspect | `docs/adr/` (adr-authoring skill) | `docs/architecture/decisions/` (this skill) |
|--------|-------------------------------------|----------------------------------------------|
| Numbering | 3-digit (001, 002) | 4-digit (0001, 0002) |
| Filename | `adr-NNN-kebab.md` | `NNNN-kebab.md` (no prefix) |
| Title H1 | `# ADR NNN:` (space, no hyphen) | `# ADR-NNNN:` (hyphen) |
| Header fields | Status, Date, Context, Related | Status, Date, Decision Makers, Consulted, Informed |
| Decision format | Numbered sub-decisions with `**Rule:**` + `**Implementation:**` | Prose + numbered principles + code blocks |
| Alternatives | `❌` rejection pairs | Pros / Cons / Why not chosen |
| Depth | 300-500 lines, audit-driven, evidence-heavy | 100-250 lines, more concise |
| Footer | Review History + Notes sections | Last Updated + optional Next Review |
| Index location | `docs/adr/adr-index.md` | `docs/architecture/decisions/README.md` |
| Cross-references | `ADR NNN` (space) | `ADR-NNNN` (hyphen) |

## Canonical Format

### Header Block

```markdown
# ADR-[NNNN]: [Descriptive Title]

**Status:** [Proposed | Accepted | Superseded | Deprecated | Rejected]
**Date:** YYYY-MM-DD
**Decision Makers:** [Names/Roles]
**Consulted:** [Names/Roles]
**Informed:** [Names/Roles]

---
```

- `Status`: Always one of: Proposed, Accepted, Superseded, Deprecated, Rejected
- `Date`: ISO 8601 format
- `Decision Makers`: Required — who made the decision
- `Consulted` and `Informed`: Optional — include when relevant (RACI-inspired)

When superseding, update the old decision's Status to `Superseded by ADR-NNNN` and add the link.

### Section Order

Every architectural decision follows this section order:

#### 1. Context

Problem statement with requirements, challenges, or constraints as bullet lists.

```markdown
## Context

What issue motivates this decision?

**Requirements:**
- Requirement 1
- Requirement 2

**Challenges:**
- Challenge 1
- Challenge 2
```

- Keep it concise — state the problem, list constraints
- Use bold sub-headers for **Requirements:**, **Challenges:**, **Options:** as needed
- Include numbered **Options:** list when presenting choices upfront

#### 2. Decision

What was decided and how it will be implemented.

```markdown
## Decision

Use **[chosen approach]** because [brief rationale].

### 1. Principle or Component Name

Description and rationale.

### 2. Another Principle

Description with code block:

\```hcl
# Example configuration
\```
```

- Lead with a bold summary of the chosen approach
- Use numbered `### N. Title` sub-sections for multi-part decisions
- Include code blocks showing directory structures, configurations, or examples
- Reference the repo's actual structure (src/server/, src/extension.ts, data/, etc.)

#### 3. Consequences

Split into Positive, Negative, and optionally Neutral.

```markdown
## Consequences

### Positive

✅ **Benefit Name**: Description of the benefit
✅ **Another Benefit**: Why this matters

### Negative

⚠️ **Trade-off Name**: Description (mitigated by X)
⚠️ **Another Trade-off**: Impact explanation

### Neutral

🔵 **Impact Name**: Neutral observation
```

- Use `✅` for positive, `⚠️` for negative, `🔵` for neutral
- Bold the benefit/trade-off name, followed by colon and description
- Add `(mitigated by X)` parentheticals on negative items when applicable
- Neutral section is optional

#### 4. Alternatives Considered

Each alternative gets its own sub-section with structured pros/cons.

```markdown
## Alternatives Considered

### Alternative 1: [Name]

**Pros:**
- Pro 1
- Pro 2

**Cons:**
- Con 1
- Con 2

**Why not chosen:** Clear explanation of the rejection reason
```

- Number each alternative: `### Alternative 1: Name`, `### Alternative 2: Name`
- Always include **Pros:**, **Cons:**, and **Why not chosen:**
- Keep "Why not chosen" to 1-2 sentences

#### 5. Implementation

Practical steps, code examples, and verification.

```markdown
## Implementation

### Structure or Phase Name

\```bash
# Commands or directory structure
\```

### Verification

How to verify the implementation worked:
- Check 1
- Check 2
```

- Include directory structure diagrams in code blocks
- Show configuration examples (HCL, YAML, bash) using language-specific fencing
- Reference Task commands when applicable (`task test:unit`, etc.)
- Include a Verification subsection when appropriate

#### 6. References

Bulleted list of related documentation and external resources.

```markdown
## References

- [Internal Doc Title](relative/path.md)
- [External Resource](https://url)
- [Related ADR](../../adr/adr-NNN-title.md)
```

- Use relative links for internal docs
- Cross-reference `docs/adr/` ADRs when relevant
- Include tool documentation links

#### 7. Footer

```markdown
---

**Last Updated:** YYYY-MM-DD
**Next Review:** YYYY-MM-DD (if applicable)
```

- `Last Updated` is required
- `Next Review` is optional — include for time-sensitive decisions

## Numbering and Naming

- **Number format**: 4-digit zero-padded (0001, 0002, ..., 0009, 0010)
- **Determine next number**: Scan `docs/architecture/decisions/` or check the README table for the highest existing number, then add 1
- **Filename**: `NNNN-kebab-case-title.md` — no `adr-` prefix
- **Title in H1**: `# ADR-NNNN: Title` — with hyphen between ADR and number
- **Location**: `docs/architecture/decisions/`

## Workflow

1. **Determine the next number** — Scan `docs/architecture/decisions/` for the highest-numbered file or check the README table
2. **Create the file** — `docs/architecture/decisions/NNNN-title.md`
3. **Fill in the header** — Status (usually Proposed or Accepted), date, decision makers
4. **Write each section** — Follow the section order above: Context → Decision → Consequences → Alternatives → Implementation → References
5. **Add the footer** — Last Updated date, optional Next Review
6. **Update the README** — Add a row to the ADR List table in `docs/architecture/decisions/README.md`
7. **Update "By Topic"** — If the README has a "By Topic" section, add the new decision under the appropriate category
8. **Commit** — `git commit -m "docs(adr): add ADR-NNNN title"`

## Superseding and Deprecating

### Superseding a Decision

1. Create the new decision with `Related:` or a note in Context referencing the old one
2. Update the old decision's Status: `**Status:** Superseded by [ADR-NNNN](NNNN-title.md)`
3. Update the README table: change the old decision's Status column to "Superseded"
4. Both updates should be in the same commit

### Deprecating a Decision

1. Update the decision's Status: `**Status:** Deprecated`
2. Add a brief note at the top of Context explaining why
3. Update the README table Status column
4. Commit: `git commit -m "docs(adr): deprecate ADR-NNNN title"`

## Topic-Specific Guidance

When the decision concerns a specific area, address these domain considerations:

### LSP Server Decisions

- Subsystem boundaries (core/, lsp/, ck3/, schema/, data/)
- Coordinator pattern for validation
- Document lifecycle and incremental parsing
- Diagnostic pipeline design
- Functional composition over inheritance

### VS Code Extension Client Decisions

- Activation events and extension lifecycle
- Command registration and contribution points
- Configuration schema design
- Client-server transport via vscode-languageclient

### CK3 Game Data Decisions

- Schema definitions and YAML data structure
- Game data extraction and parsing strategies
- Validation rule authoring
- CK3 script language constructs and scope chains
- Mod-loading and workspace scanning

### Build & Tooling Decisions

- Webpack dual entry points (extension.ts, server.ts)
- TypeScript strict mode settings
- ESLint rule selection and configuration
- Taskfile vs npm script boundaries
- Bundle size management

### CI/CD Decisions

- Action version pinning
- Timeout and concurrency settings
- Cross-platform matrix testing
- Extension packaging and publishing

### Cross-Cutting Decisions

- Type safety patterns (`unknown` over `any`)
- Logging strategy (project logger, no `console.log`)
- Error handling conventions
- Testing strategy (unit vs integration vs VS Code extension tests)

## Quality Criteria

A well-written architectural decision:

- [ ] Has a clear, descriptive title
- [ ] States the problem concisely in Context
- [ ] Explains the chosen approach with rationale in Decision
- [ ] Lists real trade-offs, not just benefits, in Consequences
- [ ] Evaluates at least 2 alternatives with honest pros/cons
- [ ] Includes practical implementation details with code examples
- [ ] References related documentation
- [ ] Uses correct numbering and naming conventions
- [ ] Updates the README index after creation
- [ ] Includes only evidence that can be cited from the repo or user context

## Template

See [references/decision-template.md](references/decision-template.md) for a ready-to-copy template with guidance comments.
